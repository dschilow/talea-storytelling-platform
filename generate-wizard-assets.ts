#!/usr/bin/env bun
/**
 * Generate Wizard Assets (run once)
 * =================================
 * Triggers the admin endpoint that pre-generates the Talea-styled illustrations
 * used by the avatar wizard (character types, hair, eyes, features, ...).
 *
 * The endpoint is admin-only, so you must pass a valid admin Clerk session
 * token. Grab it from your browser while logged in as an admin:
 *   - DevTools → Application → look for the Clerk session JWT, OR
 *   - run `await window.Clerk.session.getToken()` in the browser console.
 *
 * Usage (PowerShell):
 *   $env:ADMIN_TOKEN="<clerk-jwt>"; bun run generate-wizard-assets.ts
 *
 * Optional:
 *   $env:FORCE="1"   → regenerate everything, even assets that already exist
 *   $env:GROUP="hairColor"  → only (re)generate one group
 *   $env:BACKEND_URL="https://..."  → override backend URL
 *
 * Idempotent: assets that already exist are skipped unless FORCE=1.
 */

const BACKEND_URL =
  process.env.BACKEND_URL || "https://backend-2-production-3de1.up.railway.app";
const ENDPOINT = `${BACKEND_URL}/ai/generate-wizard-assets`;

const token = process.env.ADMIN_TOKEN;
const force = ["1", "true", "yes"].includes((process.env.FORCE || "").toLowerCase());
const group = process.env.GROUP || undefined;

async function main() {
  console.log("🎨 Talea Wizard Asset Generator\n");
  console.log(`   Endpoint: ${ENDPOINT}`);
  console.log(`   Force:    ${force}`);
  console.log(`   Group:    ${group ?? "all"}\n`);

  if (!token) {
    console.error("❌ Missing ADMIN_TOKEN env var (admin Clerk session JWT).");
    console.error('   PowerShell: $env:ADMIN_TOKEN="<jwt>"; bun run generate-wizard-assets.ts');
    process.exit(1);
  }

  console.log("⏳ Generating… this calls Runware once per asset and can take a few minutes.\n");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ force, group }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`❌ HTTP ${res.status}`);
    console.error(text);
    process.exit(1);
  }

  const data = (await res.json()) as {
    generated: string[];
    skipped: string[];
    failed: { id: string; reason: string }[];
    manifest: { count: number };
  };

  console.log("📊 Result:");
  console.log(`   ✅ generated: ${data.generated.length}`);
  console.log(`   ⏭️  skipped:   ${data.skipped.length}`);
  console.log(`   ❌ failed:    ${data.failed.length}`);
  console.log(`   📦 manifest total: ${data.manifest.count}\n`);

  if (data.generated.length) console.log("   Generated:\n     " + data.generated.join("\n     "));
  if (data.failed.length) {
    console.log("\n   Failures:");
    for (const f of data.failed) console.log(`     - ${f.id}: ${f.reason}`);
  }

  console.log("\n🎉 Done. The wizard will pick up the images automatically via /ai/wizard-assets.");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
