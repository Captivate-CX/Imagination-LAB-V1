"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, daysLeft, fileUrl, formatDate, prepareUpload } from "@/lib/client";
import type { Library, Project, ProjectSummary } from "@/lib/types";
import { StatusNotice } from "./StatusNotice";

export function Studio() {
  const router = useRouter();
  const [library, setLibrary] = useState<Library | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [loadError, setLoadError] = useState("");

  const [brand, setBrand] = useState("");
  const [campaign, setCampaign] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<Library>("/api/library")
      .then((lib) => {
        setLibrary(lib);
        setPicked(lib.assetTypes.filter((a) => a.enabled).map((a) => a.id));
      })
      .catch((e) => setLoadError(e.message));
    api<ProjectSummary[]>("/api/projects")
      .then(setProjects)
      .catch((e) => setLoadError(e.message));
  }, []);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const takeFile = useCallback(async (f: File | undefined) => {
    setError("");
    if (!f) return;
    if (!f.type.startsWith("image/")) return setError("The key visual must be an image: JPG, PNG or WebP.");
    try {
      setFile(await prepareUpload(f));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const variants = library?.settings.variantsPerAsset ?? 3;
  const canSubmit = Boolean(file && picked.length && (brand.trim() || campaign.trim())) && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !file) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("kv", file);
      form.set("brand", brand);
      form.set("campaign", campaign);
      form.set("assetIds", JSON.stringify(picked));
      const project = await api<Project>("/api/projects", { method: "POST", body: form });
      router.push(`/projects/${project.id}?start=1`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function remove(p: ProjectSummary) {
    if (!confirm(`Delete "${p.title}" and all its designs? This can't be undone.`)) return;
    try {
      await api(`/api/projects/${p.id}`, { method: "DELETE" });
      setProjects((list) => list?.filter((x) => x.id !== p.id) ?? null);
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div className="studio">
      <section className="studio-new" aria-labelledby="new-heading">
        <h1 id="new-heading" className="display-xl">
          Drop in a key visual. Walk away with a tool kit.
        </h1>
        <p className="lede">
          Each POSM type is generated {variants} times, a quality agent picks the closest match to the key
          visual, and the picks become a branded PDF.
        </p>
        <StatusNotice />

        <form onSubmit={submit} className="new-form">
          <div className="field-row">
            <label className="field">
              <span>Brand</span>
              <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Knorr" maxLength={80} />
            </label>
            <label className="field">
              <span>Campaign</span>
              <input
                value={campaign}
                onChange={(e) => setCampaign(e.target.value)}
                placeholder="Lunch Sorted"
                maxLength={120}
              />
            </label>
          </div>

          <div
            className={`bubble-drop${dragging ? " is-dragging" : ""}${preview ? " has-file" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              takeFile(e.dataTransfer.files?.[0]);
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="visually-hidden"
              id="kv-input"
              onChange={(e) => takeFile(e.target.files?.[0])}
            />
            {preview ? (
              <div className="bubble-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Key visual preview" />
                <button type="button" className="link-button" onClick={() => inputRef.current?.click()}>
                  Replace key visual
                </button>
              </div>
            ) : (
              <label htmlFor="kv-input" className="bubble-empty">
                <strong>Upload the key visual</strong>
                <span>Drag the campaign poster here, or click to choose a file. JPG, PNG or WebP.</span>
              </label>
            )}
            <span className="bubble-tail" aria-hidden />
          </div>

          <fieldset className="posm-pick">
            <legend>POSM to generate</legend>
            {!library && !loadError && <p className="muted">Loading prompt library…</p>}
            <div className="chip-row">
              {library?.assetTypes.map((a) => (
                <label key={a.id} className="chip">
                  <input
                    type="checkbox"
                    checked={picked.includes(a.id)}
                    onChange={(e) =>
                      setPicked((p) => (e.target.checked ? [...p, a.id] : p.filter((x) => x !== a.id)))
                    }
                  />
                  <span>
                    {a.name} <small>{a.aspectRatio}</small>
                  </span>
                </label>
              ))}
              <Link href="/prompts" className="chip chip-add">
                Add a POSM type
              </Link>
            </div>
            {picked.length > 0 && (
              <p className="muted small">
                This runs {picked.length * variants} image generations and {picked.length} quality{" "}
                {picked.length === 1 ? "check" : "checks"}.
              </p>
            )}
          </fieldset>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary btn-lg" disabled={!canSubmit}>
            {busy ? "Uploading…" : "Generate designs"}
          </button>
          {!canSubmit && !busy && (
            <p className="muted small">Add a brand or campaign name, a key visual and at least one POSM type.</p>
          )}
        </form>
      </section>

      <section className="studio-recent" aria-labelledby="recent-heading">
        <h2 id="recent-heading" className="display-md">
          Recent tool kits
        </h2>
        {loadError && <p className="error">{loadError}</p>}
        {projects === null && !loadError && <p className="muted">Loading…</p>}
        {projects?.length === 0 && (
          <p className="empty-note">Nothing here yet. Your first tool kit will appear here once you generate it.</p>
        )}
        <ul className="recent-list">
          {projects?.map((p) => {
            const left = daysLeft(p.expiresAt);
            return (
              <li key={p.id} className="recent-item">
                <Link href={`/projects/${p.id}`} className="recent-link">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fileUrl(p.kvPath)} alt="" className="recent-thumb" loading="lazy" />
                  <span className="recent-text">
                    <span className="recent-title">{p.title}</span>
                    <span className="recent-meta">
                      {formatDate(p.createdAt)}, {p.assetNames.join(" + ")}
                    </span>
                    <span className={`recent-expiry${left <= 3 ? " is-soon" : ""}`}>
                      {left === 0 ? "Deletes today" : `Deletes in ${left} ${left === 1 ? "day" : "days"}`}
                      {p.hasPdf ? ". PDF ready" : ""}
                    </span>
                  </span>
                </Link>
                <button type="button" className="icon-button" onClick={() => remove(p)} aria-label={`Delete ${p.title}`}>
                  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden>
                    <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
