import { listHistory, restoreHistory } from "@/lib/library";
import { respond } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return respond(() => listHistory());
}

export async function POST(req: Request) {
  return respond(async () => {
    const { path } = (await req.json()) as { path: string };
    return restoreHistory(path);
  });
}
