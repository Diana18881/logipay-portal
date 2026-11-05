// Layout check: opens every public page and every portal section of the demo (office and driver)
// at phone, tablet and desktop width and looks for things a person would call "broken":
// page wider than the screen, squeezed columns, text lying on top of other text, broken images, script errors.
// Usage: node tests/ui.mjs [BASE]   (needs puppeteer-core and Google Chrome / CHROME_PATH)
import fs from "node:fs";
import puppeteer from "puppeteer-core";

const BASE = (process.argv[2] || process.env.BASE || "http://localhost:3000").replace(/\/$/, "");
const OUT = process.env.UI_OUT || "ui-report";
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const WIDTHS = [390, 820, 1440];
const PUBLIC = ["/", "/registrieren", "/login", "/impressum", "/datenschutz", "/agb", "/avv", "/app"];
const OFFICE = ["overview", "staff", "personnel", "absences", "vehicles", "planning", "tracking", "tachograph", "tuev", "workshop", "expenses", "payroll", "messages", "documents", "reports", "tasks", "notifications", "users", "security"];
const DRIVER = ["driverFlow", "planning", "vehicles", "expenses", "messages", "documents", "absences", "payroll"];

fs.mkdirSync(OUT, { recursive: true });
const problems = [];
let checked = 0;

function inspect() {
  const vw = document.documentElement.clientWidth;
  const found = [];
  const label = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : ""}`;
  const visible = (el) => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && Number(cs.opacity) > 0.05; };
  const skip = (el) => el.closest("[aria-hidden='true'], .chaos, .movie, .lp-marquee, .cookie-notice, .app-splash, .tour-screens, .maplibregl-map, .fleet-map, svg");

  if (document.documentElement.scrollWidth > vw + 1) found.push(`Seite breiter als der Bildschirm (${document.documentElement.scrollWidth}px statt ${vw}px)`);

  for (const img of document.images) if (img.complete && img.naturalWidth === 0 && visible(img) && img.getAttribute("src")) found.push(`Bild lädt nicht: ${img.getAttribute("src").slice(0, 80)}`);

  for (const el of document.querySelectorAll("main *, .workspace *, .site *")) {
    if (skip(el) || !visible(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.display.includes("grid") && el.children.length >= 3 && !/nav|calendar|timesheet|week|days|tabs|chips|bars|kpi|legend|steps/i.test(String(el.className))) {
      const tracks = cs.gridTemplateColumns.split(" ").map(parseFloat).filter(Boolean);
      if (tracks.filter((track) => track < 70).length >= 3 && el.textContent.trim().length > 20) found.push(`Gequetschte Spalten in ${label(el)} (${tracks.map(Math.round).join("/")} px)`);
    }
  }

  // Text on top of other text: compare visible text leaves that are not nested in each other.
  const leaves = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.textContent.trim() || node.textContent.trim().length < 2) continue;
    const el = node.parentElement;
    if (!el || skip(el) || !visible(el)) continue;
    if (el.closest("select, option, input, textarea, [role='tooltip']")) continue;
    const closed = el.closest("details:not([open])");
    if (closed && !el.closest("summary")) continue;
    const range = document.createRange(); range.selectNodeContents(node);
    for (const raw of range.getClientRects()) {
      // Cut the text box to what its scrolling/clipping parents actually show.
      let r = { left: raw.left, right: raw.right, top: raw.top, bottom: raw.bottom };
      for (let p = el; p && p !== document.body; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
        const c = p.getBoundingClientRect();
        r = { left: Math.max(r.left, c.left), right: Math.min(r.right, c.right), top: Math.max(r.top, c.top), bottom: Math.min(r.bottom, c.bottom) };
      }
      r.width = r.right - r.left; r.height = r.bottom - r.top;
      if (r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < innerHeight * 6) leaves.push({ el, r });
    }
  }
  const isFloating = (el) => { for (let p = el; p && p !== document.body; p = p.parentElement) { const pos = getComputedStyle(p).position; if (pos === "fixed" || pos === "sticky") return true; } return false; };
  const reported = new Set();
  for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) {
    const a = leaves[i], b = leaves[j];
    if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
    const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (w <= 3 || h <= 3) continue;
    const share = (w * h) / Math.min(a.r.width * a.r.height, b.r.width * b.r.height);
    if (share < 0.3 || isFloating(a.el) || isFloating(b.el)) continue;
    const key = `${a.el.textContent.trim().slice(0, 30)}|${b.el.textContent.trim().slice(0, 30)}`;
    if (reported.has(key)) continue;
    reported.add(key);
    found.push(`Text überlappt: „${a.el.textContent.trim().slice(0, 40)}“ und „${b.el.textContent.trim().slice(0, 40)}“`);
    if (reported.size > 5) break;
  }
  return found;
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });

async function visit(page, path, name, width) {
  const errors = [];
  const onError = (error) => errors.push(`Skriptfehler: ${String(error.message || error).slice(0, 160)}`);
  const onConsole = (msg) => { if (msg.type() === "error" && !/favicon|Failed to load resource: the server responded with a status of 40[134]/.test(msg.text())) errors.push(`Konsole: ${msg.text().slice(0, 160)}`); };
  page.on("pageerror", onError); page.on("console", onConsole);
  try {
    const response = await page.goto(BASE + path, { waitUntil: "networkidle2", timeout: 45000 });
    if (!response || response.status() >= 400) errors.push(`HTTP ${response ? response.status() : "keine Antwort"}`);
    await page.keyboard.press("Escape").catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 900));
    errors.push(...await page.evaluate(inspect));
  } catch (error) {
    errors.push(`Seite lädt nicht: ${String(error.message || error).slice(0, 160)}`);
  }
  page.off("pageerror", onError); page.off("console", onConsole);
  checked++;
  const file = `${OUT}/${name.replace(/[^a-z0-9-]+/gi, "_")}-${width}.png`;
  if (errors.length) {
    await page.screenshot({ path: file, fullPage: true }).catch(() => {});
    problems.push({ name, width, errors, file });
    console.log(`FAIL  ${name} @${width}px\n      ${errors.join("\n      ")}`);
  } else console.log(`PASS  ${name} @${width}px`);
}

for (const width of WIDTHS) {
  const viewport = { width, height: width < 700 ? 844 : 1000, isMobile: width < 700, hasTouch: width < 1100 };
  // Public pages, without the cookie notice in the way.
  const visitor = await browser.newPage(); await visitor.setViewport(viewport);
  await visitor.goto(BASE + "/", { waitUntil: "domcontentloaded" }); await visitor.evaluate(() => { try { localStorage.setItem("logipay_cookie_notice", "1"); } catch { /* ignore */ } });
  for (const path of PUBLIC) await visit(visitor, path, `Seite ${path}`, width);
  await visitor.close();
  for (const [role, sections, demo] of [["Büro", OFFICE, "/api/auth/demo"], ["Fahrer", DRIVER, "/api/auth/demo?as=fahrer"]]) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage(); await page.setViewport(viewport);
    await page.goto(BASE + demo, { waitUntil: "networkidle2" });
    for (const section of sections) await visit(page, `/?section=${section}`, `${role} ${section}`, width);
    await context.close();
  }
}
await browser.close();

fs.writeFileSync(`${OUT}/report.json`, JSON.stringify({ base: BASE, checked, problems }, null, 2));
console.log(`\n${checked - problems.length}/${checked} Ansichten ohne Fehler`);
process.exit(problems.length ? 1 : 0);
