import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const portalUrl = new URL("../app/portal.tsx", import.meta.url);
const operationsUrl = new URL("../app/operations-panels.tsx", import.meta.url);
const cssUrl = new URL("../app/globals.css", import.meta.url);
const layoutUrl = new URL("../app/layout.tsx", import.meta.url);
const portalApiUrl = new URL("../app/api/portal/route.ts", import.meta.url);

test("provides a dedicated role-protected trip chat inbox", async () => {
  const [portal, operations] = await Promise.all([
    readFile(portalUrl, "utf8"),
    readFile(operationsUrl, "utf8"),
  ]);

  assert.match(portal, /id: "messages", label: "Nachrichten"/);
  assert.match(portal, /roles: \["management", "dispatcher", "driver"\]/);
  assert.match(portal, /view="chat"/);
  assert.match(portal, /unreadChatCount/);
  assert.match(operations, /view\?: "operations" \| "chat"/);
  assert.match(operations, /className="chat-center"/);
  assert.match(operations, /markTripMessagesRead/);
  assert.match(operations, /accept="image\/\*,audio\/\*"/);
});

test("ships the refreshed responsive LOGIPAY visual system", async () => {
  const [css, layout] = await Promise.all([
    readFile(cssUrl, "utf8"),
    readFile(layoutUrl, "utf8"),
  ]);

  assert.match(css, /\.overview-command-card/);
  assert.match(css, /\.top-chat-button/);
  assert.match(css, /\.chat-inbox/);
  assert.match(css, /\.chat-conversation/);
  assert.match(css, /@media screen and \(max-width: 760px\)/);
  assert.match(layout, /LOGIPAY/);
  assert.doesNotMatch(layout, /Starter Project|sandbox-preview/);
});

test("includes the operations command center, global search and driver 360 dossier", async () => {
  const [portal, css, portalApi] = await Promise.all([
    readFile(portalUrl, "utf8"),
    readFile(cssUrl, "utf8"),
    readFile(portalApiUrl, "utf8"),
  ]);

  assert.match(portal, /className="smart-status-grid"/);
  assert.match(portal, /className=\{`global-search/);
  assert.match(portal, /function DispatchBoard/);
  assert.match(portal, /application\/x-logipay/);
  assert.match(portal, /FAHRER 360°/);
  assert.match(portal, /Touren & Kommunikation/);
  assert.match(css, /\.dispatch-board/);
  assert.match(css, /\.dossier-kpis/);
  assert.match(css, /\.global-search-results/);
  assert.match(portalApi, /action === "movePlanningResource"/);
  assert.match(portalApi, /env\.DB\.batch/);
});
