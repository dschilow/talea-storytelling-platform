/** Zeigt Tarif, Guthaben, Stimmen-Slots und die verfügbaren Stimmen (ohne den Schlüssel auszugeben). */
import { writeFileSync } from "node:fs";
import { elJson } from "./eleven.mjs";

try {
  const sub = await elJson("/v1/user/subscription");
  console.log("Tarif:", sub.tier, "| Zeichen frei:", sub.character_limit - sub.character_count, "| Slots:", sub.voice_slots_used, "/", sub.voice_limit);
} catch (e) {
  console.log("Tarif/Guthaben nicht lesbar (Schlüssel ohne user_read):", String(e.message).slice(0, 120));
}

const all = [];
let token = null;
for (let page = 0; page < 20; page++) {
  const q = new URLSearchParams({ page_size: "100", include_total_count: "false" });
  if (token) q.set("next_page_token", token);
  const r = await elJson(`/v2/voices?${q}`);
  all.push(...(r.voices || []));
  if (!r.has_more) break;
  token = r.next_page_token;
}
console.log("Stimmen im Konto:", all.length);
const byCat = {};
all.forEach((v) => (byCat[v.category] = (byCat[v.category] || 0) + 1));
console.log("Nach Kategorie:", JSON.stringify(byCat));
writeFileSync(new URL("./voices-account.json", import.meta.url), JSON.stringify(all.map((v) => ({
  voice_id: v.voice_id, name: v.name, category: v.category, description: v.description, labels: v.labels,
  verified_languages: (v.verified_languages || []).map((l) => l.language), preview_url: v.preview_url, high_quality_base_model_ids: v.high_quality_base_model_ids,
})), null, 1));
for (const v of all) {
  const l = v.labels || {};
  console.log(`${v.name.padEnd(26)} ${String(v.category).padEnd(13)} ${(l.gender || "?").padEnd(7)} ${(l.age || "?").padEnd(12)} ${(l.accent || "").padEnd(12)} ${(l.use_case || l.usecase || "").slice(0, 22).padEnd(22)} ${(v.verified_languages || []).map((x) => x.language).join(",").slice(0, 20)}`);
}
