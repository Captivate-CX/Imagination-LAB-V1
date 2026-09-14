"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";

interface Status {
  storage: string;
  mockAi: boolean;
  geminiKey: boolean;
  retentionDays: number;
}

/** Tells the team when the app isn't fully connected yet. Silent when everything is set up. */
export function StatusNotice() {
  const [status, setStatus] = useState<Status | null>(null);
  useEffect(() => {
    api<Status>("/api/status").then(setStatus).catch(() => {});
  }, []);
  if (!status) return null;

  const notes: string[] = [];
  if (status.mockAi) notes.push("Test mode is on: designs are crops of the key visual and Gemini isn't called. Set MOCK_AI to false to generate for real.");
  else if (!status.geminiKey) notes.push("No Gemini API key is set, so generation will fail. Add GEMINI_API_KEY in Vercel and redeploy.");
  if (status.storage === "local-folder") notes.push("Files are saved to a local folder. Connect a Vercel Blob store before deploying.");
  if (!notes.length) return null;

  return (
    <div className="notice" role="status">
      {notes.map((n) => (
        <p key={n}>{n}</p>
      ))}
    </div>
  );
}
