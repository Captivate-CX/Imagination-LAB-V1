import { NextResponse, type NextRequest } from "next/server";

/**
 * Optional shared password. Set APP_PASSWORD in Vercel to turn it on; the
 * browser will ask for it once (any username works).
 */
export function proxy(request: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const supplied = decoded.slice(decoded.indexOf(":") + 1);
      if (supplied === password) return NextResponse.next();
    } catch {
      // fall through to the challenge
    }
  }
  return new NextResponse("Password required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Imagination Lab", charset="UTF-8"' },
  });
}

export const config = {
  // Everything except Next's static files and the daily clean-up job (which uses CRON_SECRET).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/cron).*)"],
};
