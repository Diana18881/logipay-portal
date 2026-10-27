import { env, runAsTenant } from "@logipay/env";
import { createSession, ensureAuthDatabase, sessionCookie } from "../../../../lib/auth";
import { DEMO_TENANT, ensureControlDatabase, getCompany } from "../../../../lib/tenants";

// One click from the website into the demo company, view-only, as office or as driver.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const asDriver = url.searchParams.get("as") === "fahrer";
  await ensureControlDatabase();
  if (!(await getCompany(DEMO_TENANT))) return Response.redirect(new URL("/login", url), 302);
  return runAsTenant(DEMO_TENANT, async () => {
    await ensureAuthDatabase();
    const user = await env.DB.prepare("SELECT id FROM users WHERE email=? AND active=1").bind(asDriver ? "driver@logipay.demo" : "director@logipay.demo").first<{ id: number }>();
    if (!user) return Response.redirect(new URL("/login", url), 302);
    const session = await createSession(user.id, { readOnly: true });
    const headers = new Headers({ location: asDriver ? "/?section=driverFlow" : "/", "Set-Cookie": sessionCookie(session.token, session.expiresAt, url.protocol === "https:") });
    return new Response(null, { status: 302, headers });
  });
}
