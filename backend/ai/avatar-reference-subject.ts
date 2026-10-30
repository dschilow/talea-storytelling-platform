/** A conservative photo classification: uncertain photos never change a selected avatar type. */
export type AvatarReferenceSubject = "plush" | "other" | "unknown";

export async function detectAvatarReferenceSubject(imageUrl: string, apiKey: string, fetcher: typeof fetch = fetch): Promise<AvatarReferenceSubject> {
  try {
    const response = await fetcher("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        model: "gpt-5.4-mini",
        messages: [
          { role: "system", content: "Classify the main intended subject of the photo. Return JSON only: {\"subject\":\"plush\"|\"other\"|\"unknown\"}. plush means a clearly visible stuffed toy, teddy, soft fabric doll or cuddly toy, not a real animal, person, drawing or costume. If a person is the main subject holding a toy, or the subject is ambiguous, choose other or unknown. Do not infer from background objects." },
          { role: "user", content: [{ type: "text", text: "Classify the main subject." }, { type: "image_url", image_url: { url: imageUrl, detail: "low" } }] },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 1500,
      }),
    });
    if (!response.ok) return "unknown";
    const body = await response.json() as any;
    const result = JSON.parse(body?.choices?.[0]?.message?.content || "{}").subject;
    return result === "plush" || result === "other" ? result : "unknown";
  } catch {
    return "unknown";
  }
}

export function isPlushType(value: string): boolean {
  return /\b(?:plush|plushie|stuffed|teddy|soft toy|cuddly toy|kuscheltier|stofftier|plueschtier|plüschtier)\b/i.test(value);
}
