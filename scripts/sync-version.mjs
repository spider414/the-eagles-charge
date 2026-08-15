#!/usr/bin/env node
/**
 * Sync the marketing version (versionName / CFBundleShortVersionString) and
 * build number (versionCode / CFBundleVersion) across:
 *   - package.json           -> "version"
 *   - iOS Info.plist         -> CFBundleShortVersionString + CFBundleVersion
 *   - iOS project.pbxproj    -> MARKETING_VERSION + CURRENT_PROJECT_VERSION
 *   - Android build.gradle   -> versionName + versionCode
 *
 * Version resolution order:
 *   1. env APP_VERSION / APP_BUILD (used by CI on tag push, e.g. v1.2.3-4)
 *   2. package.json "version" + env APP_BUILD (defaults build to 1)
 *
 * Missing native folders are skipped silently — safe to run before
 * `npx cap add ios|android`.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = resolve(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

const version = process.env.APP_VERSION || pkg.version || "1.0.0";
const build = String(process.env.APP_BUILD || process.env.GITHUB_RUN_NUMBER || "1");

// keep package.json in sync (only version, not build)
if (pkg.version !== version) {
  pkg.version = version;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
}

function patch(file, replacer) {
  if (!existsSync(file)) return false;
  const orig = readFileSync(file, "utf8");
  const next = replacer(orig);
  if (next !== orig) writeFileSync(file, next);
  return true;
}

// ---- iOS Info.plist ----
const infoPlist = resolve(root, "ios/App/App/Info.plist");
patch(infoPlist, (s) =>
  s
    .replace(
      /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]*(<\/string>)/,
      `$1${version}$2`,
    )
    .replace(
      /(<key>CFBundleVersion<\/key>\s*<string>)[^<]*(<\/string>)/,
      `$1${build}$2`,
    ),
);

// ---- iOS project.pbxproj ----
const pbxproj = resolve(root, "ios/App/App.xcodeproj/project.pbxproj");
patch(pbxproj, (s) =>
  s
    .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`)
    .replace(
      /CURRENT_PROJECT_VERSION = [^;]+;/g,
      `CURRENT_PROJECT_VERSION = ${build};`,
    ),
);

// ---- Android build.gradle ----
const gradle = resolve(root, "android/app/build.gradle");
patch(gradle, (s) =>
  s
    .replace(/versionName\s+"[^"]*"/, `versionName "${version}"`)
    .replace(/versionName\s*=\s*"[^"]*"/, `versionName = "${version}"`)
    .replace(/versionCode\s+\d+/, `versionCode ${build}`)
    .replace(/versionCode\s*=\s*\d+/, `versionCode = ${build}`)
    .replace(/applicationId\s*=?\s*"[^"]*"/, `applicationId "${APP_ID}"`)
    .replace(/namespace\s*=?\s*"[^"]*"/, `namespace "${APP_ID}"`),
);

console.log(`✓ Synced version=${version} build=${build}`);