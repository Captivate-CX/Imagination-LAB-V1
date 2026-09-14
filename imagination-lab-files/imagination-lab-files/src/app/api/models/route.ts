import { listModels } from "@/lib/gemini";
import { respond } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return respond(() => listModels());
}
