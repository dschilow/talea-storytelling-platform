import { secret } from "encore.dev/config";
import { aiDB } from "./db";

const openAIKey = secret("OpenAIKey");

interface OpenAIRequestPayload {
  model: string;
  messages: { role: string; content: any }[];
  [key: string]: any; // Other options like response_format, etc.
}

// callOpenAIWithCache handles the logic for using OpenAI's caching feature.
export async function callOpenAIWithCache(promptId: string, payload: OpenAIRequestPayload) {
  const cached = await aiDB.queryRow<{ cache_key: string }>`
    SELECT cache_key FROM openai_prompt_cache WHERE id = ${promptId}
  `;

  let finalPayload = { ...payload };

  if (cached?.cache_key) {
    console.log(`✅ Using cached prompt with key: ${cached.cache_key}`);
    finalPayload.cache_control = { cache_key: cached.cache_key };
  } else {
    console.log(`🔍 No cache key found for prompt ID: ${promptId}. Creating one.`);
    // Use cache_control to enable caching, not 'cache'.
    finalPayload.cache_control = { ttl: 86400 }; // 24-hour TTL
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openAIKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(finalPayload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("❌ OpenAI API error with caching:", errorText);
    throw new Error(`OpenAI API error: ${res.status} - ${errorText}`);
  }

  const data = await res.json();

  // If we created a new cache entry, store the key for future use.
  // The key is in `cache_control.cache_key`, not `system_fingerprint`.
  if (!cached?.cache_key && data.cache_control?.cache_key) {
    const newCacheKey = data.cache_control.cache_key;
    console.log(`🔑 New cache key generated: ${newCacheKey}. Storing for prompt ID: ${promptId}`);
    await aiDB.exec`
      INSERT INTO openai_prompt_cache (id, cache_key, created_at)
      VALUES (${promptId}, ${newCacheKey}, ${new Date()})
      ON CONFLICT (id) DO UPDATE SET
        cache_key = ${newCacheKey},
        created_at = ${new Date()}
    `;
  }

  return data;
}
