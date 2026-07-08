#!/usr/bin/env node
// Fails the build if index.html or public/manifest.json contain any
// PWA install-related meta tags or standalone settings. This app ships
// as a native Capacitor build — no browser "Install app" UI is allowed.
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const errors = [];

const htmlPath = resolve(root, "index.html");
if (existsSync(htmlPath)) {
  const html = readFileSync(htmlPath, "utf8");
  const forbiddenMeta = [
    /<meta\s+[^>]*name=["']apple-mobile-web-app-capable["'][^>]*>/i,
    /<meta\s+[^>]*name=["']apple-mobile-web-app-status-bar-style["'][^>]*>/i,
    /<meta\s+[^>]*name=["']apple-mobile-web-app-title["'][^>]*>/i,
    /<meta\s+[^>]*name=["']mobile-web-app-capable["'][^>]*>/i,
    /<meta\s+[^>]*name=["']application-name["'][^>]*>/i,
  ];
  for (const re of forbiddenMeta) {
    const m = html.match(re);
    if (m) errors.push(`index.html: forbidden install-related meta tag found: ${m[0]}`);
  }
}

for (const manifestName of ["manifest.json", "manifest.webmanifest"]) {
  const p = resolve(root, "public", manifestName);
  if (!existsSync(p)) continue;
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    errors.push(`public/${manifestName}: invalid JSON (${e.message})`);
    continue;
  }
  const display = manifest.display;
  const forbiddenDisplays = ["standalone", "fullscreen", "minimal-ui"];
  if (display && forbiddenDisplays.includes(display)) {
    errors.push(
      `public/${manifestName}: "display": "${display}" enables PWA install prompt. Use "browser".`
    );
  }
  if (manifest.display_override && Array.isArray(manifest.display_override)) {
    const bad = manifest.display_override.filter((d) => forbiddenDisplays.includes(d));
    if (bad.length) {
      errors.push(
        `public/${manifestName}: "display_override" contains install-enabling values: ${bad.join(", ")}`
      );
    }
  }
  if (manifest.prefer_related_applications === false && manifest.related_applications) {
    // ok — related_applications alone is fine
  }
}

if (errors.length) {
  console.error("PWA install-prompt guard failed:\n" + errors.map((e) => "  - " + e).join("\n"));
  process.exit(1);
}
console.log("PWA install-prompt guard: OK (no install-related meta tags or standalone settings).");