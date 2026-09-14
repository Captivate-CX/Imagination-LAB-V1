"use client";

import { useState } from "react";
import { fileUrl } from "@/lib/client";
import type { AssetState, ProjectAsset, Variant } from "@/lib/types";

interface Props {
  asset: ProjectAsset;
  state: AssetState;
  count: number;
  busy: Record<string, boolean>;
  inLibrary: boolean;
  onGenerate: (n: number) => void;
  onRun: (mode: "missing" | "all") => void;
  onQc: () => void;
  onChoose: (n: number) => void;
  onZoom: (src: string, alt: string) => void;
  onRemove: () => void;
}

export function AssetRow(p: Props) {
  const { asset, state, count, busy } = p;
  const [showIssues, setShowIssues] = useState(false);
  const nums = Array.from({ length: count }, (_, i) => i + 1);
  const generating = nums.some((n) => busy[`${asset.id}:${n}`]);
  const checking = Boolean(busy[`qc:${asset.id}`]);
  const done = nums.filter((n) => state.variants[n - 1]?.status === "done");
  const missing = nums.length - done.length;
  const qc = state.qc;
  const scoreFor = (n: number) => qc?.designs?.find((d) => d.design === n);

  return (
    <section className="asset-row" aria-labelledby={`asset-${asset.id}`}>
      <header className="asset-head">
        <div>
          <h2 id={`asset-${asset.id}`} className="display-md">
            {asset.name}
          </h2>
          <p className="muted small">
            {asset.aspectRatio} format.{" "}
            {generating
              ? "Generating designs…"
              : checking
                ? "Quality agent is comparing the designs…"
                : state.selection
                  ? `Design ${state.selection.n} chosen ${state.selection.by === "qc" ? "by the quality agent" : "by you"}.`
                  : done.length
                    ? "No design chosen yet."
                    : "Not generated yet."}
          </p>
        </div>
        <div className="asset-actions">
          {missing > 0 && missing < count && (
            <button type="button" className="btn btn-quiet" disabled={generating || !p.inLibrary} onClick={() => p.onRun("missing")}>
              Generate missing
            </button>
          )}
          <button
            type="button"
            className="btn btn-quiet"
            disabled={generating || checking || !p.inLibrary}
            onClick={() => {
              if (done.length && !confirm(`Replace all ${count} ${asset.name} designs with new ones?`)) return;
              p.onRun("all");
            }}
          >
            {done.length ? `Regenerate all ${count}` : `Generate ${count} designs`}
          </button>
          <button
            type="button"
            className="btn btn-quiet"
            disabled={generating || checking || done.length < 2}
            onClick={p.onQc}
          >
            {qc ? "Re-run quality check" : "Run quality check"}
          </button>
        </div>
      </header>

      {!p.inLibrary && (
        <p className="notice small">
          This POSM type is no longer in the prompt library, so it can&apos;t be regenerated.{" "}
          <button type="button" className="link-button" onClick={p.onRemove}>
            Remove it from this project
          </button>
        </p>
      )}

      <div className="tiles" style={{ "--cols": count } as React.CSSProperties}>
        {nums.map((n) => (
          <Tile
            key={n}
            n={n}
            asset={asset}
            variant={state.variants[n - 1] ?? null}
            running={Boolean(busy[`${asset.id}:${n}`])}
            chosen={state.selection?.n === n ? state.selection.by : null}
            qcPick={qc?.status === "done" && qc.winner === n}
            score={scoreFor(n)?.score}
            locked={checking}
            onGenerate={() => p.onGenerate(n)}
            onChoose={() => p.onChoose(n)}
            onZoom={p.onZoom}
          />
        ))}
      </div>

      {qc?.status === "done" && (
        <div className="verdict">
          <p>
            <strong>Quality agent:</strong> {qc.verdict || `Design ${qc.winner} is the closest match.`}
          </p>
          {qc.designs && qc.designs.some((d) => d.issues.length || d.summary) && (
            <>
              <button type="button" className="link-button" onClick={() => setShowIssues((s) => !s)} aria-expanded={showIssues}>
                {showIssues ? "Hide issues table" : "Show issues table"}
              </button>
              {showIssues && (
                <table className="issues">
                  <thead>
                    <tr>
                      <th scope="col">Design</th>
                      <th scope="col">Score</th>
                      <th scope="col">Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qc.designs.map((d) => (
                      <tr key={d.design}>
                        <th scope="row">{d.design}</th>
                        <td>{d.score}/10</td>
                        <td>
                          {d.summary && <p className="issue-summary">{d.summary}</p>}
                          {d.issues.length ? (
                            <ul>
                              {d.issues.map((i, k) => (
                                <li key={k}>
                                  <span className={`sev sev-${i.severity}`}>{i.severity}</span> {i.issue}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="muted">No issues found.</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      )}
      {qc?.status === "error" && (
        <p className="error small">
          Quality check failed: {qc.error}{" "}
          <button type="button" className="link-button" onClick={p.onQc} disabled={checking}>
            Try again
          </button>
        </p>
      )}
    </section>
  );
}

function Tile(props: {
  n: number;
  asset: ProjectAsset;
  variant: Variant | null;
  running: boolean;
  chosen: "qc" | "user" | null;
  qcPick: boolean;
  score?: number;
  locked: boolean;
  onGenerate: () => void;
  onChoose: () => void;
  onZoom: (src: string, alt: string) => void;
}) {
  const { n, asset, variant, running, chosen } = props;
  const label = `${asset.name} design ${n}`;

  if (running) {
    return (
      <div className="tile is-running" aria-live="polite">
        <div className="tile-frame">
          <span className="tile-state">Imagining design {n}…</span>
        </div>
        <div className="tile-foot">
          <span>Design {n}</span>
        </div>
      </div>
    );
  }

  if (!variant) {
    return (
      <div className="tile is-empty">
        <div className="tile-frame">
          <button type="button" className="btn btn-quiet" onClick={props.onGenerate}>
            Generate design {n}
          </button>
        </div>
        <div className="tile-foot">
          <span>Design {n}</span>
        </div>
      </div>
    );
  }

  if (variant.status === "error") {
    return (
      <div className="tile is-error">
        <div className="tile-frame">
          <p className="tile-error">{variant.error}</p>
          <button type="button" className="btn btn-quiet" onClick={props.onGenerate}>
            Try again
          </button>
        </div>
        <div className="tile-foot">
          <span>Design {n}</span>
        </div>
      </div>
    );
  }

  const src = fileUrl(variant.imagePath!);
  return (
    <div className={`tile${chosen ? " is-chosen" : ""}`}>
      <button
        type="button"
        className="tile-frame tile-pick"
        onClick={props.onChoose}
        disabled={props.locked}
        aria-pressed={Boolean(chosen)}
        aria-label={chosen ? `${label}, chosen` : `Choose ${label}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={label} loading="lazy" />
        {chosen && (
          <span className="sticker" aria-hidden>
            Chosen
          </span>
        )}
      </button>
      <div className="tile-foot">
        <span>
          Design {n}
          {props.score !== undefined && props.score > 0 ? <span className="score"> {props.score}/10</span> : null}
          {props.qcPick && chosen !== "qc" ? <span className="muted"> agent&apos;s pick</span> : null}
        </span>
        <span className="tile-tools">
          <button type="button" className="link-button" onClick={() => props.onZoom(src, label)}>
            Enlarge
          </button>
          <a className="link-button" href={fileUrl(variant.imagePath!, `${asset.name} design ${n}.${variant.imagePath!.split(".").pop()}`)}>
            Download
          </a>
        </span>
      </div>
      {variant.modelNotes && (
        <details className="model-notes">
          <summary>Model notes</summary>
          <p>{variant.modelNotes}</p>
        </details>
      )}
    </div>
  );
}
