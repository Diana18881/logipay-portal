import { NextResponse, type NextRequest } from "next/server";

// View-only demo sessions (token "<tenant>.ro-…") may look at everything but change nothing.
const allowed = new Set(["/api/auth/logout", "/api/auth/login", "/api/auth/register", "/api/auth/demo"]);

export function proxy(request: NextRequest) {
  if (request.method === "GET" || request.method === "HEAD" || allowed.has(request.nextUrl.pathname)) return NextResponse.next();
  const token = request.cookies.get("logipay_session")?.value || "";
  if (/^[a-z0-9]+\.ro-/.test(token))
    return NextResponse.json({ error: "Demo-Modus: nur Ansicht. Registrieren Sie Ihre Firma kostenlos, um alles selbst auszuprobieren." }, { status: 403 });
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
