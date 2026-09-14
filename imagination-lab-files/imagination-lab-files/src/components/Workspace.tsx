"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, createLimiter, daysLeft, fileUrl, formatDate, formatDateTime } from "@/lib/client";
import {
  projectTitle,
  type AssetState,
  type Library,
  type Project,
  type ProjectState,
  type QcResult,
  type Selection,
  type ToolkitLayout,
  type Variant,
} from "@/lib/types";
import { AssetRow } from "./AssetRow";
import { Lightbox } from "./Lightbox";

const EMPTY: AssetState = { variants: [], qc: null, selection: null };

export function Workspace({ id }: { id: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const [state, setState] = useState<ProjectState | null>(null);
  const [library, setLibrary] = useState<Library | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [building, setBuilding] = useState(false);
  const [toolkitNote, setToolkitNote] = useState("");
  const [layoutChanged, setLayoutChanged] = useState(false);
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);
  const [editingNames, setEditingNames] = useState(false);

  const stateRef = useRef<ProjectState | null>(null);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const limit = useRef(createLimiter(6)).current;
  const autoStarted = useRef(false);

  const count = library?.settings.variantsPerAsset ?? 3;
  const anyBusy = Object.values(busy).some(Boolean);

  const setFlag = useCallback((key: string, on: boolean) => {
    setBusy((b) => ({ ...b, [key]: on }));
  }, []);

  const patchAsset = useCallback((assetId: string, fn: (a: AssetState) => AssetState) => {
    setState((s) => (s ? { ...s, assets: { ...s.assets, [assetId]: fn(s.assets[assetId] ?? EMPTY) } } : s));
  }, []);

  // Load project + library
  useEffect(() => {
    window.scrollTo(0, 0);
    Promise.all([api<ProjectState>(`/api/projects/${id}`), api<Library>("/api/library")])
      .then(([s, lib]) => {
        setState(s);
        setLibrary(lib);
      })
      .catch((e) => setLoadError(e.message));
  }, [id]);

  // Warn before closing the tab mid-generation: the browser drives the pipeline.
  useEffect(() => {
    if (!anyBusy) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [anyBusy]);

  const generateOne = useCallback(
    async (assetId: string, n: number): Promise<Variant | null> => {
      const key = `${assetId}:${n}`;
      setFlag(key, true);
      try {
        const v = await limit(() =>
          api<Variant>(`/api/projects/${id}/generate`, { method: "POST", json: { assetId, n } }),
        );
        patchAsset(assetId, (a) => {
          const variants = [...a.variants];
          variants[n - 1] = v;
          return { ...a, variants, qc: null, selection: null };
        });
        return v;
      } catch (e) {
        const failed: Variant = {
          n,
          status: "error",
          error: (e as Error).message,
          model: "",
          promptUpdatedAt: "",
          createdAt: new Date().toISOString(),
          durationMs: 0,
        };
        patchAsset(assetId, (a) => {
          const variants = [...a.variants];
          variants[n - 1] = failed;
          return { ...a, variants };
        });
        return failed;
      } finally {
        setFlag(key, false);
      }
    },
    [id, limit, patchAsset, setFlag],
  );

  const runQc = useCallback(
    async (assetId: string) => {
      const key = `qc:${assetId}`;
      setFlag(key, true);
      try {
        const r = await api<{ qc: QcResult; selection: Selection | null }>(`/api/projects/${id}/qc`, {
          method: "POST",
          json: { assetId },
        });
        patchAsset(assetId, (a) => ({ ...a, qc: r.qc, selection: r.selection }));
      } catch (e) {
        patchAsset(assetId, (a) => ({
          ...a,
          qc: { status: "error", error: (e as Error).message, model: "", judged: [], createdAt: new Date().toISOString() },
        }));
      } finally {
        setFlag(key, false);
      }
    },
    [id, patchAsset, setFlag],
  );

  const runAsset = useCallback(
    async (assetId: string, mode: "missing" | "all") => {
      const current = stateRef.current?.assets[assetId] ?? EMPTY;
      const nums = Array.from({ length: count }, (_, i) => i + 1);
      const todo = nums.filter((n) => mode === "all" || current.variants[n - 1]?.status !== "done");
      const kept = nums.filter((n) => !todo.includes(n) && current.variants[n - 1]?.status === "done").length;
      if (!todo.length) {
        if (!current.qc && kept > 0) await runQc(assetId);
        return;
      }
      const results = await Promise.all(todo.map((n) => generateOne(assetId, n)));
      const finished = kept + results.filter((v) => v?.status === "done").length;
      if (finished > 0) await runQc(assetId);
    },
    [count, generateOne, runQc],
  );

  const runEverything = useCallback(async () => {
    const s = stateRef.current;
    if (!s) return;
    await Promise.all(s.project.assets.map((a) => runAsset(a.id, "missing")));
  }, [runAsset]);

  // Fresh projects start generating as soon as they open.
  useEffect(() => {
    if (!state || !library || autoStarted.current) return;
    if (search.get("start") === "1") {
      autoStarted.current = true;
      router.replace(`/projects/${id}`, { scroll: false });
      runEverything();
    }
  }, [state, library, search, router, id, runEverything]);

  async function choose(assetId: string, n: number) {
    const previous = stateRef.current?.assets[assetId]?.selection ?? null;
    patchAsset(assetId, (a) => ({ ...a, selection: { n, by: "user", at: new Date().toISOString() } }));
    try {
      const sel = await api<Selection>(`/api/projects/${id}/select`, { method: "POST", json: { assetId, n } });
      patchAsset(assetId, (a) => ({ ...a, selection: sel }));
    } catch (e) {
      patchAsset(assetId, (a) => ({ ...a, selection: previous }));
      alert((e as Error).message);
    }
  }

  async function updateProject(patch: Record<string, string>) {
    const p = await api<Project>(`/api/projects/${id}`, { method: "PATCH", json: patch });
    const fresh = await api<ProjectState>(`/api/projects/${id}`);
    setState({ ...fresh, project: p });
  }

  async function setLayout(layout: ToolkitLayout) {
    setState((s) => (s ? { ...s, project: { ...s.project, toolkit: { ...s.project.toolkit, layout } } } : s));
    setLayoutChanged(true);
    try {
      await api(`/api/projects/${id}`, { method: "PATCH", json: { layout } });
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function buildToolkit() {
    setBuilding(true);
    setToolkitNote("");
    try {
      const r = await api<{ project: Project; skipped: string[] }>(`/api/projects/${id}/toolkit`, { method: "POST" });
      setState((s) => (s ? { ...s, project: r.project } : s));
      setLayoutChanged(false);
      if (r.skipped.length) setToolkitNote(`Left out because nothing is chosen yet: ${r.skipped.join(", ")}.`);
    } catch (e) {
      setToolkitNote((e as Error).message);
    } finally {
      setBuilding(false);
    }
  }

  async function removeProject() {
    if (!state) return;
    if (!confirm(`Delete "${projectTitle(state.project)}" and all its designs? This can't be undone.`)) return;
    await api(`/api/projects/${id}`, { method: "DELETE" });
    router.push("/");
  }

  const summary = useMemo(() => {
    if (!state) return null;
    const assets = state.project.assets;
    let designsDone = 0;
    let chosen = 0;
    let checked = 0;
    let latestChange = 0;
    for (const a of assets) {
      const s = state.assets[a.id] ?? EMPTY;
      for (const v of s.variants) {
        if (v?.status === "done") {
          designsDone++;
          latestChange = Math.max(latestChange, new Date(v.createdAt).getTime());
        }
      }
      if (s.qc?.status === "done") checked++;
      if (s.selection) {
        chosen++;
        latestChange = Math.max(latestChange, new Date(s.selection.at).getTime());
      }
    }
    const pdf = state.project.toolkit.pdf;
    const stale = Boolean(pdf && (latestChange > new Date(pdf.builtAt).getTime() || layoutChanged));
    return { total: assets.length * count, designsDone, chosen, checked, assetCount: assets.length, stale };
  }, [state, count, layoutChanged]);

  if (loadError) {
    return (
      <div className="page-message">
        <h1 className="display-lg">Can&apos;t open this project</h1>
        <p>{loadError}</p>
        <Link href="/" className="btn btn-primary">
          Back to the studio
        </Link>
      </div>
    );
  }
  if (!state || !library || !summary) return <div className="page-message muted">Opening project…</div>;

  const { project } = state;
  const title = projectTitle(project);
  const pdf = project.toolkit.pdf;
  const missingAssets = library.assetTypes.filter((t) => !project.assets.some((a) => a.id === t.id));
  const left = daysLeft(project.expiresAt);

  return (
    <div className="workspace">
      <div className="ws-head">
        {editingNames ? (
          <NameEditor
            brand={project.brand}
            campaign={project.campaign}
            onCancel={() => setEditingNames(false)}
            onSave={async (brand, campaign) => {
              await updateProject({ brand, campaign });
              setEditingNames(false);
            }}
          />
        ) : (
          <div className="ws-title">
            <h1 className="display-lg">{title}</h1>
            <button type="button" className="link-button" onClick={() => setEditingNames(true)}>
              Rename
            </button>
          </div>
        )}
        <div className="ws-actions">
          {(anyBusy || summary.designsDone < summary.total || summary.checked < summary.assetCount) && (
            <button type="button" className="btn btn-primary" onClick={runEverything} disabled={anyBusy}>
              {anyBusy ? "Working…" : summary.designsDone < summary.total ? "Generate missing designs" : "Run missing quality checks"}
            </button>
          )}
        </div>
      </div>

      <ol className="pipeline" aria-label="Progress">
        <li className="is-done">
          <span className="pipe-num">1</span>
          <span>Key visual uploaded</span>
        </li>
        <li className={summary.designsDone === summary.total ? "is-done" : anyBusy ? "is-active" : ""}>
          <span className="pipe-num">2</span>
          <span>
            {summary.designsDone} of {summary.total} designs generated
          </span>
        </li>
        <li className={summary.checked === summary.assetCount ? "is-done" : ""}>
          <span className="pipe-num">3</span>
          <span>
            {summary.chosen} of {summary.assetCount} chosen
          </span>
        </li>
        <li className={pdf && !summary.stale ? "is-done" : ""}>
          <span className="pipe-num">4</span>
          <span>{pdf ? (summary.stale ? "Tool kit out of date" : "Tool kit ready") : "Tool kit not built"}</span>
        </li>
      </ol>

      <div className="ws-body">
        <aside className="kv-panel" aria-label="Key visual">
          <button
            type="button"
            className="kv-frame"
            onClick={() => setZoom({ src: fileUrl(project.kv.path), alt: "Key visual" })}
            aria-label="Enlarge key visual"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fileUrl(project.kv.path)} alt="Key visual" />
          </button>
          <dl className="kv-facts">
            <div>
              <dt>Created</dt>
              <dd>{formatDate(project.createdAt)}</dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>
                {project.kv.width} × {project.kv.height}px
              </dd>
            </div>
            <div>
              <dt>Kept until</dt>
              <dd className={left <= 3 ? "is-soon" : ""}>
                {formatDate(project.expiresAt)} ({left} {left === 1 ? "day" : "days"})
              </dd>
            </div>
          </dl>
          <button type="button" className="link-button danger" onClick={removeProject}>
            Delete project
          </button>
        </aside>

        <div className="asset-list">
          {project.assets.map((a) => (
            <AssetRow
              key={a.id}
              asset={a}
              state={state.assets[a.id] ?? EMPTY}
              count={count}
              busy={busy}
              inLibrary={library.assetTypes.some((t) => t.id === a.id)}
              onGenerate={(n) => generateOne(a.id, n)}
              onRun={(mode) => runAsset(a.id, mode)}
              onQc={() => runQc(a.id)}
              onChoose={(n) => choose(a.id, n)}
              onZoom={(src, alt) => setZoom({ src, alt })}
              onRemove={async () => {
                if (!confirm(`Remove ${a.name} and its designs from this project?`)) return;
                await updateProject({ removeAssetId: a.id });
              }}
            />
          ))}

          {missingAssets.length > 0 && (
            <div className="add-asset">
              <label>
                <span>Add a POSM type to this project</span>
                <select
                  value=""
                  onChange={async (e) => {
                    const assetId = e.target.value;
                    if (!assetId) return;
                    await updateProject({ addAssetId: assetId });
                    runAsset(assetId, "missing");
                  }}
                >
                  <option value="">Choose…</option>
                  {missingAssets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.aspectRatio})
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <section className="toolkit" aria-labelledby="toolkit-heading">
            <div className="toolkit-head">
              <h2 id="toolkit-heading" className="display-md">
                Tool kit
              </h2>
              <p className="muted">
                Cover, key visual, one page per POSM type, closing page. Uses the Imagination Lab template.
              </p>
            </div>

            <div className="toolkit-controls">
              <fieldset className="segmented">
                <legend className="visually-hidden">Pages show</legend>
                <label>
                  <input
                    type="radio"
                    name="layout"
                    checked={project.toolkit.layout === "chosen"}
                    onChange={() => setLayout("chosen")}
                  />
                  <span>Chosen design only</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="layout"
                    checked={project.toolkit.layout === "all"}
                    onChange={() => setLayout("all")}
                  />
                  <span>All designs, chosen in the middle</span>
                </label>
              </fieldset>

              <button
                type="button"
                className="btn btn-primary"
                onClick={buildToolkit}
                disabled={building || summary.chosen === 0 || anyBusy}
              >
                {building ? "Building PDF…" : pdf ? "Rebuild tool kit PDF" : "Build tool kit PDF"}
              </button>
              {pdf && (
                <a className="btn btn-quiet" href={fileUrl(pdf.path, `${title} - Imagination Lab tool kit.pdf`)}>
                  Download PDF
                </a>
              )}
            </div>

            {summary.chosen === 0 && <p className="muted small">Choose at least one design to build the tool kit.</p>}
            {summary.chosen > 0 && summary.chosen < summary.assetCount && (
              <p className="muted small">
                POSM types with no chosen design will be left out of the PDF.
              </p>
            )}
            {toolkitNote && <p className="notice small">{toolkitNote}</p>}
            {pdf && summary.stale && (
              <p className="notice small">Designs or choices changed after this PDF was built. Rebuild to update it.</p>
            )}

            {pdf && (
              <div className="pdf-preview">
                <p className="muted small">
                  Built {formatDateTime(pdf.builtAt)}, {pdf.pages} pages.{" "}
                  <a href={fileUrl(pdf.path)} target="_blank" rel="noopener noreferrer">
                    Open in a new tab
                  </a>
                </p>
                <iframe key={pdf.path} src={fileUrl(pdf.path)} title="Tool kit PDF preview" />
              </div>
            )}
          </section>
        </div>
      </div>

      {zoom && <Lightbox src={zoom.src} alt={zoom.alt} onClose={() => setZoom(null)} />}
    </div>
  );
}

function NameEditor(props: {
  brand: string;
  campaign: string;
  onSave: (brand: string, campaign: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [brand, setBrand] = useState(props.brand);
  const [campaign, setCampaign] = useState(props.campaign);
  const [saving, setSaving] = useState(false);
  return (
    <form
      className="name-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          await props.onSave(brand, campaign);
        } catch (err) {
          alert((err as Error).message);
          setSaving(false);
        }
      }}
    >
      <label className="field">
        <span>Brand</span>
        <input value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={80} autoFocus />
      </label>
      <label className="field">
        <span>Campaign</span>
        <input value={campaign} onChange={(e) => setCampaign(e.target.value)} maxLength={120} />
      </label>
      <button type="submit" className="btn btn-primary" disabled={saving}>
        Save names
      </button>
      <button type="button" className="btn btn-quiet" onClick={props.onCancel}>
        Cancel
      </button>
    </form>
  );
}
