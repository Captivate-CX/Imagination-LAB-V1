import { Suspense } from "react";
import { Workspace } from "@/components/Workspace";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="page-message muted">Opening project…</div>}>
      <Workspace id={id} />
    </Suspense>
  );
}
