import { storageMode } from "@/lib/storage";
import { MOCK_AI } from "@/lib/gemini";
import { RETENTION_DAYS } from "@/lib/projects";
import { respond } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return respond(async () => ({
    storage: storageMode(),
    mockAi: MOCK_AI,
    geminiKey: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    retentionDays: RETENTION_DAYS,
  }));
}
