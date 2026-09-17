"use client";

import { useEffect, useMemo, useState } from "react";
import { api, fileUrl, formatDateTime, prepareUpload } from "@/lib/client";
import { ASPECT_RATIOS, IMAGE_SIZES, type AspectRatio, type AssetType, type Library, type ReferenceImage } from "@/lib/types";

type Section = { kind: "asset"; id: string } | { kind: "qc" } | { kind: "settings" } | { kind: "history" };

interface HistoryItem {
  path: string;
  updatedAt: string;
  note: string;
  assetCount: number;
}

export function PromptLibrary() {
  const [saved, setSaved] = useState<Library | null>(null);
  const [draft, setDraft] = useState<Library | null>(null);
  const [section, setSection] = useState<Section>({ kind: "asset", id: "wobbler" });
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    api<Library>("/api/library")
      .then((lib) => {
        setSaved(lib);
        setDraft(structuredClone(lib));
        if (lib.assetTypes[0]) setSection({ kind: "asset", id: lib.assetTypes[0].id });
      })
      .catch((e) => setMessage({ kind: "error", text: e.message }));
  }, []);

  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (!draft) {
    return <div className="page-message muted">{message?.text ?? "Loading prompt library…"}</div>;
  }

  const updateAsset = (id: string, patch: Partial<AssetType>) =>
    setDraft((d) => (d ? { ...d, assetTypes: d.assetTypes.map((a) => (a.id === id ? { ...a, ...patch } : a)) } : d));

  /** Moves a POSM type up or down. This order is the order of pages in the tool kit PDF. */
  const moveAsset = (id: string, direction: -1 | 1) =>
    setDraft((d) => {
      if (!d) return d;
      const from = d.assetTypes.findIndex((a) => a.id === id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= d.assetTypes.length) return d;
      const assetTypes = [...d.assetTypes];
      [assetTypes[from], assetTypes[to]] = [assetTypes[to], assetTypes[from]];
      return { ...d, assetTypes };
    });

  async function save() {
    if (!draft) return;
    setSaving(true);
    setMessage(null);
    try {
      const lib = await api<Library>("/api/library", { method: "PUT", json: { library: draft, note } });
      setSaved(lib);
      setDraft(structuredClone(lib));
      setNote("");
      setMessage({ kind: "ok", text: "Prompt library saved. New generations use these prompts." });
    } catch (e) {
      setMessage({ kind: "error", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  const current = section.kind === "asset" ? draft.assetTypes.find((a) => a.id === section.id) : undefined;

  return (
    <div className="library">
      <nav className="library-rail" aria-label="Prompt library sections">
        <h1 className="display-md">Prompt library</h1>
        <p className="rail-label">POSM types</p>
        <p className="rail-hint">In tool kit page order. Use the arrows to rearrange.</p>
        <ul>
          {draft.assetTypes.map((a, i) => (
            <li key={a.id} className="rail-row">
              <button
                type="button"
                className="rail-item"
                aria-current={section.kind === "asset" && section.id === a.id ? "true" : undefined}
                onClick={() => setSection({ kind: "asset", id: a.id })}
              >
                <span>
                  <span className="rail-pos">{i + 1}</span>
                  {a.name}
                </span>
                <small>{a.aspectRatio}</small>
              </button>
              <span className="rail-moves">
                <button
                  type="button"
                  className="move-button"
                  onClick={() => moveAsset(a.id, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${a.name} up`}
                  title="Move up"
                >
                  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
                    <path d="M8 4l4 6H4z" fill="currentColor" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="move-button"
                  onClick={() => moveAsset(a.id, 1)}
                  disabled={i === draft.assetTypes.length - 1}
                  aria-label={`Move ${a.name} down`}
                  title="Move down"
                >
                  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
                    <path d="M8 12L4 6h8z" fill="currentColor" />
                  </svg>
                </button>
              </span>
            </li>
          ))}
        </ul>
        {adding ? (
          <AddAssetForm
            existing={draft.assetTypes}
            onCancel={() => setAdding(false)}
            onAdd={(a) => {
              setDraft((d) => (d ? { ...d, assetTypes: [...d.assetTypes, a] } : d));
              setSection({ kind: "asset", id: a.id });
              setAdding(false);
            }}
          />
        ) : (
          <button type="button" className="btn btn-quiet rail-add" onClick={() => setAdding(true)}>
            Add POSM type
          </button>
        )}
        <p className="rail-label">Pipeline</p>
        <ul>
          <li>
            <button type="button" className="rail-item" aria-current={section.kind === "qc" ? "true" : undefined} onClick={() => setSection({ kind: "qc" })}>
              Quality agent
            </button>
          </li>
          <li>
            <button type="button" className="rail-item" aria-current={section.kind === "settings" ? "true" : undefined} onClick={() => setSection({ kind: "settings" })}>
              Models and settings
            </button>
          </li>
          <li>
            <button type="button" className="rail-item" aria-current={section.kind === "history" ? "true" : undefined} onClick={() => setSection({ kind: "history" })}>
              Saved versions
            </button>
          </li>
        </ul>
      </nav>

      <div className="library-editor">
        {current && (
          <AssetEditor
            key={current.id}
            asset={current}
            onChange={(patch) => updateAsset(current.id, patch)}
            onDelete={() => {
              if (!confirm(`Delete the ${current.name} POSM type? Existing projects keep their designs.`)) return;
              setDraft((d) => (d ? { ...d, assetTypes: d.assetTypes.filter((a) => a.id !== current.id) } : d));
              const next = draft.assetTypes.find((a) => a.id !== current.id);
              setSection(next ? { kind: "asset", id: next.id } : { kind: "qc" });
            }}
          />
        )}

        {section.kind === "qc" && (
          <div className="editor-section">
            <h2 className="display-md">Quality agent</h2>
            <p className="muted">
              One prompt checks every POSM type. It receives the key visual plus all the designs for one POSM type,
              picks the best, and lists issues. These placeholders are filled in automatically:{" "}
              <code>{"{brand}"}</code>, <code>{"{campaign}"}</code>, <code>{"{asset_type}"}</code>,{" "}
              <code>{"{design_count}"}</code>.
            </p>
            <label className="field">
              <span>Prompt</span>
              <textarea
                className="prompt-box"
                value={draft.qcPrompt}
                onChange={(e) => setDraft({ ...draft, qcPrompt: e.target.value })}
                rows={18}
                spellCheck
              />
            </label>
            <p className="muted small">
              The app adds a short instruction asking for the answer as structured data (winner, verdict, issues table),
              so the verdict and table can be shown on screen.
            </p>
          </div>
        )}

        {section.kind === "settings" && <SettingsEditor draft={draft} setDraft={setDraft} />}

        {section.kind === "history" && (
          <HistoryPanel
            onRestored={(lib) => {
              setSaved(lib);
              setDraft(structuredClone(lib));
              setMessage({ kind: "ok", text: "Version restored." });
            }}
          />
        )}
      </div>

      <div className={`save-bar${dirty ? " is-dirty" : ""}`} role="region" aria-label="Save changes">
        {message && <p className={message.kind === "ok" ? "save-ok" : "error"}>{message.text}</p>}
        {dirty ? (
          <>
            <span className="save-state">Unsaved changes</span>
            <input
              className="save-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What changed? (optional, shows in saved versions)"
              maxLength={140}
            />
            <button type="button" className="btn btn-quiet" onClick={() => setDraft(structuredClone(saved!))} disabled={saving}>
              Discard
            </button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save prompt library"}
            </button>
          </>
        ) : (
          !message && (
            <span className="save-state muted">
              All changes saved{saved && new Date(saved.updatedAt).getTime() > 0 ? `, ${formatDateTime(saved.updatedAt)}` : ""}.
            </span>
          )
        )}
      </div>
    </div>
  );
}

function AssetEditor({
  asset,
  onChange,
  onDelete,
}: {
  asset: AssetType;
  onChange: (patch: Partial<AssetType>) => void;
  onDelete: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [refLabel, setRefLabel] = useState("");
  const [refError, setRefError] = useState("");

  async function upload(file: File | undefined) {
    if (!file) return;
    setRefError("");
    setUploading(true);
    try {
      const prepared = await prepareUpload(file);
      const form = new FormData();
      form.set("file", prepared);
      form.set("label", refLabel.trim() || file.name);
      const ref = await api<ReferenceImage>("/api/library/references", { method: "POST", body: form });
      onChange({ references: [...asset.references, ref] });
      setRefLabel("");
    } catch (e) {
      setRefError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="editor-section">
      <div className="editor-head">
        <h2 className="display-md">{asset.name || "Untitled POSM type"}</h2>
        <button type="button" className="link-button danger" onClick={onDelete}>
          Delete POSM type
        </button>
      </div>

      <div className="field-row">
        <label className="field">
          <span>Name</span>
          <input value={asset.name} onChange={(e) => onChange({ name: e.target.value })} maxLength={40} />
        </label>
        <label className="field field-narrow">
          <span>Aspect ratio</span>
          <select value={asset.aspectRatio} onChange={(e) => onChange({ aspectRatio: e.target.value as AspectRatio })}>
            {ASPECT_RATIOS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <span className="ratio-preview" aria-hidden style={{ aspectRatio: asset.aspectRatio.replace(":", " / ") }} />
      </div>
      <p className="muted small">
        The aspect ratio is set on the image model directly, so it&apos;s more reliable than asking for it in the prompt.
      </p>

      <label className="check">
        <input type="checkbox" checked={asset.enabled} onChange={(e) => onChange({ enabled: e.target.checked })} />
        <span>Tick this POSM type by default for new tool kits</span>
      </label>

      <label className="field">
        <span>Prompt</span>
        <textarea
          className="prompt-box"
          value={asset.prompt}
          onChange={(e) => onChange({ prompt: e.target.value })}
          rows={24}
          spellCheck
        />
      </label>
      <p className="muted small">
        Sent with the key visual as Image 1{asset.references.length ? " and the reference files below as Image 2 onwards" : ""}.
        {" "}{asset.prompt.length.toLocaleString("en-GB")} characters.
      </p>

      <div className="refs">
        <h3>Reference files</h3>
        <p className="muted small">
          Extra images sent with every generation, such as a blank display unit drawing. Use the same file name your
          prompt mentions.
        </p>
        {asset.references.length > 0 && (
          <ul className="ref-list">
            {asset.references.map((r) => (
              <li key={r.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fileUrl(r.path)} alt="" />
                <input
                  value={r.label}
                  aria-label="File name used in the prompt"
                  onChange={(e) =>
                    onChange({
                      references: asset.references.map((x) => (x.id === r.id ? { ...x, label: e.target.value } : x)),
                    })
                  }
                />
                <button
                  type="button"
                  className="link-button danger"
                  onClick={() => onChange({ references: asset.references.filter((x) => x.id !== r.id) })}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="ref-add">
          <input
            value={refLabel}
            onChange={(e) => setRefLabel(e.target.value)}
            placeholder='File name used in the prompt, e.g. "02. Blank Gondola.png"'
            aria-label="Name for the new reference file"
          />
          <label className={`btn btn-quiet${uploading ? " is-disabled" : ""}`}>
            {uploading ? "Uploading…" : "Upload reference image"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="visually-hidden"
              disabled={uploading}
              onChange={(e) => upload(e.target.files?.[0])}
            />
          </label>
        </div>
        {refError && <p className="error small">{refError}</p>}
      </div>
    </div>
  );
}

function AddAssetForm({
  existing,
  onAdd,
  onCancel,
}: {
  existing: AssetType[];
  onAdd: (a: AssetType) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [ratio, setRatio] = useState<AspectRatio>("3:4");
  const [from, setFrom] = useState("");
  return (
    <form
      className="add-asset-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36) || "posm";
        let id = slug;
        let i = 2;
        while (existing.some((a) => a.id === id)) id = `${slug}-${i++}`;
        const source = existing.find((a) => a.id === from);
        onAdd({
          id,
          name: name.trim(),
          aspectRatio: ratio,
          prompt:
            source?.prompt ??
            `Role & Objective: You are an expert shopper marketing designer. See the attached Brand Key Visual (KV). Create a photorealistic ${name.trim()} design based on it.\n\n`,
          references: source ? [...source.references] : [],
          enabled: true,
        });
      }}
    >
      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Shelf strip" autoFocus maxLength={40} />
      </label>
      <label className="field">
        <span>Aspect ratio</span>
        <select value={ratio} onChange={(e) => setRatio(e.target.value as AspectRatio)}>
          {ASPECT_RATIOS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Start from</span>
        <select value={from} onChange={(e) => setFrom(e.target.value)}>
          <option value="">A short starter prompt</option>
          {existing.map((a) => (
            <option key={a.id} value={a.id}>
              A copy of the {a.name} prompt
            </option>
          ))}
        </select>
      </label>
      <div className="add-asset-actions">
        <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
          Add
        </button>
        <button type="button" className="btn btn-quiet" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function SettingsEditor({ draft, setDraft }: { draft: Library; setDraft: (l: Library) => void }) {
  const [models, setModels] = useState<{ id: string; image: boolean }[] | null>(null);
  const [modelError, setModelError] = useState("");
  const s = draft.settings;
  const set = (patch: Partial<Library["settings"]>) => setDraft({ ...draft, settings: { ...s, ...patch } });

  async function loadModels() {
    setModelError("");
    try {
      setModels(await api<{ id: string; image: boolean }[]>("/api/models"));
    } catch (e) {
      setModelError((e as Error).message);
    }
  }

  return (
    <div className="editor-section">
      <h2 className="display-md">Models and settings</h2>
      <p className="muted">
        Gemini 3.1 Pro reads images but can&apos;t create them, so designs are made by a Gemini image model and the
        quality check uses Gemini 3.1 Pro.
      </p>
      <div className="field-row">
        <label className="field">
          <span>Image model (makes the designs)</span>
          <input value={s.imageModel} onChange={(e) => set({ imageModel: e.target.value.trim() })} list="image-models" />
        </label>
        <label className="field">
          <span>Quality check model</span>
          <input value={s.qcModel} onChange={(e) => set({ qcModel: e.target.value.trim() })} list="all-models" />
        </label>
      </div>
      <datalist id="image-models">
        {models?.filter((m) => m.image).map((m) => <option key={m.id} value={m.id} />)}
      </datalist>
      <datalist id="all-models">
        {models?.filter((m) => !m.image).map((m) => <option key={m.id} value={m.id} />)}
      </datalist>
      <p className="small">
        <button type="button" className="link-button" onClick={loadModels}>
          Load the model names available to your Gemini key
        </button>
        {models && <span className="muted"> {models.length} found. Pick from the suggestions in each box.</span>}
      </p>
      {modelError && <p className="error small">{modelError}</p>}

      <div className="field-row">
        <label className="field field-narrow">
          <span>Image size</span>
          <select value={s.imageSize} onChange={(e) => set({ imageSize: e.target.value as Library["settings"]["imageSize"] })}>
            {IMAGE_SIZES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="field field-narrow">
          <span>Designs per POSM type</span>
          <select value={s.variantsPerAsset} onChange={(e) => set({ variantsPerAsset: Number(e.target.value) })}>
            {[2, 3, 4].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted small">
        2K is a good balance for the PDF. 4K takes longer and costs more per image, and can hit the 5 minute request limit.
      </p>
    </div>
  );
}

function HistoryPanel({ onRestored }: { onRestored: (lib: Library) => void }) {
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    api<HistoryItem[]>("/api/library/history").then(setItems).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="editor-section">
      <h2 className="display-md">Saved versions</h2>
      <p className="muted">
        Each save keeps the previous version here (the last 40). Restoring a version saves it as the current library, and
        what you had becomes a version too.
      </p>
      {error && <p className="error">{error}</p>}
      {items?.length === 0 && <p className="empty-note">No earlier versions yet. They appear after your second save.</p>}
      <ul className="history-list">
        {items?.map((h) => (
          <li key={h.path}>
            <span>
              <strong>{new Date(h.updatedAt).getTime() > 0 ? formatDateTime(h.updatedAt) : "Starting prompts"}</strong>
              <span className="muted"> {h.note || `${h.assetCount} POSM types`}</span>
            </span>
            <button
              type="button"
              className="btn btn-quiet"
              disabled={Boolean(busy)}
              onClick={async () => {
                if (!confirm("Restore this version? Unsaved edits will be lost.")) return;
                setBusy(h.path);
                try {
                  onRestored(await api<Library>("/api/library/history", { method: "POST", json: { path: h.path } }));
                  setItems(await api<HistoryItem[]>("/api/library/history"));
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy("");
                }
              }}
            >
              {busy === h.path ? "Restoring…" : "Restore"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
