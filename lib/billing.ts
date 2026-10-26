import { env, tenantDatabase } from "@logipay/env";
import { ensureControlDatabase, getCompany, updateCompany, type Company, type CompanyStatus } from "./tenants";

// Subscription billing through Stripe's REST API: one subscription per company, quantity = active drivers.

const STRIPE_API = "https://api.stripe.com/v1";

export function pricePerDriverCents() {
  return Number(process.env.LOGIPAY_PRICE_PER_DRIVER_CENTS || 900);
}

export function billingConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function encode(params: Record<string, string | number | boolean | undefined>) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined) body.append(key, String(value));
  return body;
}

async function stripe<T = Record<string, unknown>>(path: string, params?: Record<string, string | number | boolean | undefined>, method = params ? "POST" : "GET") {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe ist noch nicht verbunden.");
  const response = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: { authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded" },
    body: params ? encode(params) : undefined,
  });
  const result = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(result.error?.message || `Stripe-Fehler ${response.status}`);
  return result;
}

/** Active drivers are the billed seats; at least one seat is charged. */
export async function countSeats(companyId: string) {
  const row = await tenantDatabase(companyId).prepare(
    "SELECT COUNT(*) AS count FROM staff WHERE status='active'",
  ).first<{ count: number }>().catch(() => null);
  return Math.max(1, Number(row?.count || 0));
}

async function ensureCustomer(company: Company, email: string) {
  if (company.stripe_customer_id) return company.stripe_customer_id;
  const customer = await stripe<{ id: string }>("/customers", {
    name: company.name,
    email,
    "metadata[company_id]": company.id,
    preferred_locales: "de",
  });
  await updateCompany(company.id, { stripe_customer_id: customer.id });
  return customer.id;
}

export async function createCheckout(company: Company, email: string, origin: string) {
  const customer = await ensureCustomer(company, email);
  const seats = await countSeats(company.id);
  const trialEnd = company.trial_ends_at ? Math.floor(new Date(company.trial_ends_at).getTime() / 1000) : 0;
  const keepTrial = company.status === "trialing" && trialEnd > Math.floor(Date.now() / 1000) + 3600 * 48;
  const session = await stripe<{ url: string }>("/checkout/sessions", {
    mode: "subscription",
    customer,
    client_reference_id: company.id,
    locale: "de",
    "line_items[0][quantity]": seats,
    "line_items[0][price_data][currency]": "eur",
    "line_items[0][price_data][unit_amount]": pricePerDriverCents(),
    "line_items[0][price_data][recurring][interval]": "month",
    "line_items[0][price_data][product_data][name]": "LOGIPAY – pro aktivem Fahrer",
    "line_items[0][price_data][tax_behavior]": "exclusive",
    "subscription_data[metadata][company_id]": company.id,
    "subscription_data[trial_end]": keepTrial ? trialEnd : undefined,
    "metadata[company_id]": company.id,
    billing_address_collection: "required",
    "tax_id_collection[enabled]": true,
    "customer_update[name]": "auto",
    "customer_update[address]": "auto",
    allow_promotion_codes: true,
    success_url: `${origin}/abo?status=ok`,
    cancel_url: `${origin}/abo`,
  });
  return session.url;
}

export async function createPortalSession(company: Company, origin: string) {
  if (!company.stripe_customer_id) throw new Error("Noch kein Abonnement vorhanden.");
  const session = await stripe<{ url: string }>("/billing_portal/sessions", {
    customer: company.stripe_customer_id,
    return_url: `${origin}/abo`,
    locale: "de",
  });
  return session.url;
}

type Subscription = {
  id: string;
  status: string;
  customer: string;
  trial_end: number | null;
  metadata?: { company_id?: string };
  items: { data: { id: string; quantity: number }[] };
};

function mapStatus(status: string): CompanyStatus {
  if (status === "active") return "active";
  if (status === "trialing") return "trialing";
  if (status === "past_due" || status === "unpaid" || status === "incomplete") return "past_due";
  return "canceled";
}

async function applySubscription(subscription: Subscription, companyId?: string) {
  const id = companyId || subscription.metadata?.company_id;
  if (!id || !(await getCompany(id, true))) return;
  await updateCompany(id, {
    status: mapStatus(subscription.status),
    stripe_subscription_id: subscription.status === "canceled" ? null : subscription.id,
    stripe_customer_id: subscription.customer,
    trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : undefined,
  });
}

/** Keeps the subscription quantity equal to the number of active drivers. */
export async function syncSeats(companyId: string) {
  const company = await getCompany(companyId, true);
  if (!company || company.is_demo) return;
  const seats = await countSeats(companyId);
  if (seats !== company.seats) await updateCompany(companyId, { seats });
  if (!billingConfigured() || !company.stripe_subscription_id) return;
  const subscription = await stripe<Subscription>(`/subscriptions/${company.stripe_subscription_id}`);
  const item = subscription.items.data[0];
  if (item && item.quantity !== seats) await stripe(`/subscription_items/${item.id}`, { quantity: seats, proration_behavior: "create_prorations" });
}

async function hmacHex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

/** Verifies the Stripe-Signature header (t=…,v1=…) against the raw request body. */
export async function verifyWebhook(payload: string, header: string | null) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(",").map((part) => part.split("=") as [string, string]));
  const timestamp = Number(parts.t);
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const expected = await hmacHex(secret, `${timestamp}.${payload}`);
  return header.split(",").some((part) => part.startsWith("v1=") && safeEqual(part.slice(3), expected));
}

export async function handleStripeEvent(event: { id: string; type: string; data: { object: Record<string, unknown> } }) {
  await ensureControlDatabase();
  const seen = await env.CONTROL.prepare("INSERT OR IGNORE INTO billing_events (id, type, company_id, created_at) VALUES (?, ?, NULL, ?)")
    .bind(event.id, event.type, new Date().toISOString()).run();
  if (!seen.meta.changes) return;
  const object = event.data.object;
  if (event.type === "checkout.session.completed" && typeof object.subscription === "string") {
    const subscription = await stripe<Subscription>(`/subscriptions/${object.subscription}`);
    await applySubscription(subscription, String(object.client_reference_id || ""));
  } else if (event.type.startsWith("customer.subscription.")) {
    await applySubscription(object as unknown as Subscription);
  } else if (event.type === "invoice.payment_failed" && typeof object.subscription === "string") {
    const subscription = await stripe<Subscription>(`/subscriptions/${object.subscription}`);
    await applySubscription(subscription);
  }
}

export async function cancelSubscription(subscriptionId: string) {
  if (!billingConfigured()) return;
  await stripe(`/subscriptions/${subscriptionId}`, undefined, "DELETE");
}
