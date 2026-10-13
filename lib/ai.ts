// AI requests go through Vercel AI Gateway; the model is chosen via the AI_MODEL environment variable.
const GATEWAY_MESSAGES_URL = "https://ai-gateway.vercel.sh/v1/messages";

function aiToken() {
  return process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || "";
}

export function aiConfigured() {
  return Boolean(process.env.AI_MODEL && aiToken());
}

export type AiContentPart =
  | { type: "text"; text: string }
  | { type: "image" | "document"; source: { type: "base64"; media_type: string; data: string } };

export async function aiMessages(request: {
  max_tokens: number;
  system?: string;
  messages: { role: "user" | "assistant"; content: string | AiContentPart[] }[];
}) {
  const response = await fetch(GATEWAY_MESSAGES_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${aiToken()}` },
    body: JSON.stringify({ model: process.env.AI_MODEL, ...request }),
  });
  if (!response.ok) return { ok: false as const, status: response.status, text: "" };
  const result = await response.json() as { content?: { type: string; text?: string }[] };
  const text = (result.content || []).filter((part) => part.type === "text").map((part) => part.text).join("\n").trim();
  return { ok: true as const, status: response.status, text };
}
