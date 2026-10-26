import { handleStripeEvent, verifyWebhook } from "../../../../lib/billing";

export async function POST(request: Request) {
  const payload = await request.text();
  if (!(await verifyWebhook(payload, request.headers.get("stripe-signature"))))
    return Response.json({ error: "Ungültige Signatur" }, { status: 400 });
  try {
    await handleStripeEvent(JSON.parse(payload));
    return Response.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook failed", error);
    return Response.json({ error: "Verarbeitung fehlgeschlagen" }, { status: 500 });
  }
}
