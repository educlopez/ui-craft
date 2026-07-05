// URL scanning: fetches or puppeteer-renders a live page and scans its HTML.
// Split out of the former monolithic scripts/detect.mjs — no behavior change.

import { VERSION } from "./constants.mjs";
import { loadConfig, scanFile } from "./engine.mjs";

// --- URL scanning -----------------------------------------------------------
// Scans a live page instead of source files. Two engines:
//
//   puppeteer (optional dependency) — loads the page in headless Chromium and
//     scans the JS-rendered DOM (`page.content()`), so SPA output is covered.
//   fetch (zero-dep fallback) — plain HTTP GET of the server-rendered HTML.
//     No JS execution: client-rendered markup is invisible to this engine.
//
// puppeteer is resolved via dynamic import so it stays a soft dependency —
// the core detector keeps its zero-dependency promise. Line numbers in
// findings refer to the fetched/rendered HTML, not any source file.

export const URL_RE = /^https?:\/\//i;

async function loadPuppeteer() {
  try {
    const mod = await import("puppeteer");
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

async function fetchRenderedHtml(url, { engine = "auto", timeoutMs = 20000 } = {}) {
  if (engine === "puppeteer" || engine === "auto") {
    const puppeteer = await loadPuppeteer();
    if (puppeteer) {
      const browser = await puppeteer.launch({ headless: true });
      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1440, height: 900 });
        await page.goto(url, { waitUntil: "networkidle2", timeout: timeoutMs });
        const html = await page.content();
        return { html, engine: "puppeteer" };
      } finally {
        await browser.close();
      }
    }
    if (engine === "puppeteer") {
      throw new Error(
        'puppeteer is not installed. Run `npm install puppeteer` (or drop --engine puppeteer to fall back to static fetch)',
      );
    }
  }
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "user-agent": `ui-craft-detect/${VERSION}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const html = await res.text();
  return { html, engine: "fetch" };
}

/**
 * Scan a live URL and return findings over its (rendered) HTML.
 *
 * @param {string} url - http(s) URL to scan.
 * @param {{ config?: object, engine?: "auto"|"puppeteer"|"fetch", timeoutMs?: number }} [opts]
 *   engine: "auto" (default) uses puppeteer when installed, else static fetch.
 * @returns {Promise<{ version: string, engine?: string, summary: object, findings: object[], error?: string }>}
 *   Same shape as scan(); findings' `file` field is the URL and `line` numbers
 *   refer to the fetched HTML document.
 */
export async function scanUrl(url, { config: configOverride, engine = "auto", timeoutMs = 20000 } = {}) {
  let config = configOverride ?? null;
  if (config === null) {
    ({ config } = await loadConfig(process.cwd()));
  }

  let html;
  let usedEngine;
  try {
    ({ html, engine: usedEngine } = await fetchRenderedHtml(url, { engine, timeoutMs }));
  } catch (err) {
    return {
      version: VERSION,
      summary: { files_scanned: 0, files_flagged: 0, errors: 0, warnings: 0, auto_fixed: 0 },
      findings: [],
      error: `cannot fetch "${url}": ${err.message}`,
    };
  }

  // The URL is the reported "file"; scanFile only uses the path for reporting.
  const findings = scanFile(url, html, config);
  const errors = findings.filter((f) => f.severity === "critical").length;
  const majors = findings.filter((f) => f.severity === "major").length;
  const warnings = findings.filter((f) => f.severity === "warn").length;

  return {
    version: VERSION,
    engine: usedEngine,
    summary: {
      files_scanned: 1,
      files_flagged: findings.length > 0 ? 1 : 0,
      errors,
      warnings: majors + warnings,
      auto_fixed: 0,
    },
    findings,
  };
}

