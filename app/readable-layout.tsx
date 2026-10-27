"use client";

import { useEffect } from "react";

// Keeps the many older screens readable on every device without touching each one:
// - table cells get their column name as data-label, so phones can show rows as cards;
// - text smaller than 12px is raised to 12px.
const SKIP_TABLES = ".month-lines, .import-preview table, .calendar-grid table";

function enhance(root: HTMLElement) {
  for (const table of root.querySelectorAll<HTMLTableElement>("table")) {
    if (table.matches(SKIP_TABLES)) continue;
    const headers = [...table.querySelectorAll("thead th")].map((th) => (th.textContent || "").trim());
    if (!headers.length) continue;
    table.classList.add("rt");
    for (const row of table.querySelectorAll("tbody tr")) {
      [...row.children].forEach((cell, index) => {
        const label = headers[index] || "";
        if (cell.getAttribute("data-label") !== label) cell.setAttribute("data-label", label);
      });
    }
  }
  for (const element of root.querySelectorAll<HTMLElement>("small, span, p, b, strong, em, label, td, th, a, button, li, div")) {
    if (element.dataset.rf) continue;
    const size = parseFloat(getComputedStyle(element).fontSize);
    if (size && size < 12 && element.textContent?.trim()) element.style.fontSize = "12px";
    element.dataset.rf = "1";
  }
}

export function ReadableLayout() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".app-shell");
    if (!root) return;
    let frame = 0;
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => enhance(root)); };
    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true });
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);
  return null;
}
