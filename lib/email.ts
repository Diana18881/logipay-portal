// Transactional e-mail through Resend (provisioned via the Vercel Marketplace).

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(message: { to: string; subject: string; text: string; html: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.VERCEL_ENV) throw new Error("E-Mail-Versand ist noch nicht eingerichtet.");
    // Local development without a mail service: print instead of sending.
    console.log(`[email] to=${message.to} subject=${message.subject}\n${message.text}`);
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || "LOGIPAY <onboarding@resend.dev>", to: [message.to], subject: message.subject, text: message.text, html: message.html }),
  });
  if (!response.ok) throw new Error(`E-Mail konnte nicht gesendet werden (${response.status})`);
}
