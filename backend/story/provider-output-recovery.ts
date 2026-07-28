/**
 * Provider-output recovery helpers for the story pipeline.
 *
 * Extracted from dev-mode-generation.ts so they can be unit-tested without
 * booting the Encore runtime. Everything in here is pure string/JSON handling
 * with no service, database, or network dependency.
 *
 * These matter because every structural stage of the pipeline round-trips
 * through model-emitted JSON: when a payload is truncated by the completion
 * window or wrapped in reasoning preamble, the difference between recovering it
 * and discarding it is the difference between real dramaturgy and a
 * deterministic template fallback.
 */

export function stripJsonFence(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }
  return trimmed;
}

export function sliceToOuterObject(content: string): string {
  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return content.slice(firstBrace, lastBrace + 1);
  }
  return content;
}

/**
 * Best-effort JSON repair. Models sometimes emit:
 *   - // line comments or /* block *\/ comments
 *   - trailing commas before } or ]
 *   - unescaped " inside string values (typical when the story uses German
 *     typographic dialog like „Ja" — model writes regular " inside the value
 *     and doesn't escape it).
 *   - single quotes instead of doubles (rarer; we don't auto-fix this).
 * We fix what we safely can without breaking valid JSON.
 */
export function repairLooseJson(input: string): string {
  let s = input;
  // Strip /* ... */ block comments
  s = s.replace(/\/\*[\s\S]*?\*\//g, "");
  // Strip // line comments (but not inside strings — best-effort: only outside quotes via simple state machine)
  s = stripLineCommentsOutsideStrings(s);
  // Remove trailing commas before } or ]
  s = s.replace(/,(\s*[}\]])/g, "$1");
  return s;
}

/**
 * Heuristic recovery for the most common dev-mode failure: a model emits
 * a JSON object whose string values contain unescaped " characters from
 * dialog. We walk the input, treat every `"key":` token as a property
 * boundary, then re-quote the value by detecting where the value ends
 * (next `,\n  "key":` or `\n]` or `\n}` at a reasonable indent).
 *
 * This is a fallback for when JSON.parse keeps throwing "Expected
 * double-quoted property name" — meaning the parser has miscounted
 * quotes inside a value. Only attempt this when normal repair already
 * failed; the cost is correctness loss in edge cases vs. the alternative
 * of "story generation failed entirely".
 */
export function escapeInnerQuotesInStringValues(raw: string): string {
  // Find the top-level object body.
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first < 0 || last <= first) return raw;
  const before = raw.slice(0, first);
  const body = raw.slice(first, last + 1);
  const after = raw.slice(last + 1);

  // Property-name pattern: a key followed by colon. We use a state machine.
  // For each string-value start (after `":` or `: `), scan forward and
  // collect characters; whenever we see a `"` decide whether it terminates
  // the value (next non-space is `,`, `}`, `]`, or newline+key) or is an
  // inner quote that must be escaped.
  let out = "";
  let i = 0;
  let depth = 0;
  while (i < body.length) {
    const ch = body[i];
    out += ch;
    if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") depth--;

    // Detect a property `"key":` or array-element string start.
    // Approach: when we hit `"`, scan the string. If the string is a
    // "value" string (preceded by `:` ignoring whitespace), parse with
    // tolerant rules.
    if (ch === '"') {
      // Check whether this " opens a VALUE string (preceded by `:` after ws)
      // or a KEY string (preceded by `{` or `,` after ws).
      let look = out.length - 2;
      while (look >= 0 && /\s/.test(out[look])) look--;
      const prevNonWs = look >= 0 ? out[look] : "";
      const isValueString = prevNonWs === ":";
      const isKeyOrSimple = prevNonWs === "{" || prevNonWs === "," || prevNonWs === "[";

      // Scan forward, copying characters, handling escapes.
      let j = i + 1;
      let valueAcc = "";
      while (j < body.length) {
        const c = body[j];
        if (c === "\\") {
          // Pass through escape sequence verbatim.
          valueAcc += c;
          if (j + 1 < body.length) {
            valueAcc += body[j + 1];
            j += 2;
            continue;
          }
          j++;
          continue;
        }
        if (c === '"') {
          // Decide: terminator or inner quote?
          // Peek ahead skipping whitespace.
          let k = j + 1;
          while (k < body.length && /[ \t]/.test(body[k])) k++;
          const peek = body[k];
          // Terminator if followed by , } ] : or end-of-line that leads to one of these.
          // For a KEY string the next non-ws must be `:`. For a VALUE string the next
          // non-ws should be `,` `}` `]` or newline+`"key":` pattern.
          let isTerminator = false;
          if (isKeyOrSimple && !isValueString) {
            // It's a key string — terminator must be `:`.
            isTerminator = peek === ":";
          } else if (isValueString) {
            if (peek === "," || peek === "}" || peek === "]") {
              isTerminator = true;
            } else if (peek === "\n" || peek === "\r") {
              // Look further: skip whitespace then expect `,` `}` `]` or `"key":` shape.
              let m = k;
              while (m < body.length && /\s/.test(body[m])) m++;
              const nextChar = body[m];
              if (nextChar === "," || nextChar === "}" || nextChar === "]") {
                isTerminator = true;
              } else if (nextChar === '"') {
                // Possible key — look for `":` after a non-quote run.
                let n = m + 1;
                while (n < body.length && body[n] !== '"') {
                  if (body[n] === "\\") n += 2;
                  else n++;
                }
                let o = n + 1;
                while (o < body.length && /[ \t]/.test(body[o])) o++;
                if (body[o] === ":") isTerminator = true;
              }
            } else {
              // Inner quote inside a value — escape it.
              isTerminator = false;
            }
          } else {
            // Bare string somewhere (e.g., inside an array of strings).
            isTerminator = peek === "," || peek === "}" || peek === "]" || peek === "\n" || peek === "\r";
          }

          if (isTerminator) {
            valueAcc += c;
            j++;
            break;
          } else {
            valueAcc += "\\\"";
            j++;
            continue;
          }
        }
        // Escape raw control characters that JSON doesn't allow inside strings.
        if (c === "\n") {
          valueAcc += "\\n";
          j++;
          continue;
        }
        if (c === "\r") {
          valueAcc += "\\r";
          j++;
          continue;
        }
        if (c === "\t") {
          valueAcc += "\\t";
          j++;
          continue;
        }
        valueAcc += c;
        j++;
      }
      out += valueAcc;
      i = j;
      continue;
    }
    i++;
  }
  return before + out + after;
}

export function stripLineCommentsOutsideStrings(s: string): string {
  let out = "";
  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      out += ch;
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === "/" && s[i + 1] === "/") {
      // Skip until end-of-line
      while (i < s.length && s[i] !== "\n") i++;
      if (i < s.length) out += s[i]; // preserve the newline
      continue;
    }
    out += ch;
  }
  return out;
}

export function tryParseJson(raw: string): any {
  const trimmed = stripReasoningPreamble(raw.trim());
  const fenced = stripJsonFence(trimmed);
  const sliced = sliceToOuterObject(fenced);
  const looseRepaired = repairLooseJson(sliced);
  const aggressiveRepaired = escapeInnerQuotesInStringValues(looseRepaired);

  const attempts: Array<{ label: string; text: string }> = [
    { label: "raw", text: trimmed },
    { label: "fence-stripped", text: fenced },
    { label: "outer-sliced", text: sliced },
    { label: "loose-repaired", text: looseRepaired },
    { label: "aggressive-quote-repair", text: aggressiveRepaired },
  ];

  let lastError: unknown = null;
  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt.text);
      if (attempt.label !== "raw") {
        console.log(`[dev-mode-generation] JSON parsed via "${attempt.label}" repair stage.`);
      }
      return parsed;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? "unknown JSON parse failure"));
}

export function recoverCompleteObjectsFromArrayProperty(content: string, propertyName: string): any[] {
  const propertyIndex = content.indexOf(`"${propertyName}"`);
  if (propertyIndex < 0) return [];
  const arrayStart = content.indexOf("[", propertyIndex);
  if (arrayStart < 0) return [];

  const objects: any[] = [];
  let depth = 0;
  let objectStart = -1;
  let inString = false;
  let escape = false;

  for (let i = arrayStart + 1; i < content.length; i += 1) {
    const ch = content[i];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{") {
      if (depth === 0) objectStart = i;
      depth += 1;
      continue;
    }

    if (ch === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && objectStart >= 0) {
        const objectText = content.slice(objectStart, i + 1);
        try {
          objects.push(tryParseJson(objectText));
        } catch {
          // A single malformed completed object should not prevent recovery of
          // earlier/later completed candidates.
        }
        objectStart = -1;
      }
      continue;
    }

    if (ch === "]" && depth === 0) break;
  }

  return objects;
}

export function recoverTruncatedIdeaCandidatePayload(content: string): any | null {
  const candidates = recoverCompleteObjectsFromArrayProperty(content, "candidates");
  if (candidates.length === 0) return null;
  return {
    candidates,
    recoveredFromTruncatedJson: true,
    recoveredCandidateCount: candidates.length,
  };
}

/**
 * The scene-card stage is the dramaturgic brain of the pipeline: it is the only
 * stage that gives each scene its OWN goal, obstacle and — critically — its own
 * per-speaker dialogue beats. When its JSON is cut off by the completion window
 * the whole payload used to be thrown away, and
 * `repairSceneCardsDeterministically([])` rebuilt five mad-libbed cards that
 * share one identical set of dialogue beats (all spoken by the first hero,
 * want/observe/resist/decide). The writer model then faithfully renders that
 * template, which is exactly what made finished stories feel same-shaped and
 * lifeless (runs 33a39c66, 8edf8f4f, 88331eb6, dc70b8a7 — 4/4 truncated).
 *
 * A truncated array still contains every COMPLETE scene object before the cut,
 * so recover those and let the deterministic repair top up only the missing
 * tail instead of replacing genuine dramaturgy wholesale.
 */
export function recoverTruncatedSceneCardPayload(content: string): any | null {
  const sceneCards = recoverCompleteObjectsFromArrayProperty(content, "sceneCards");
  const scenes = sceneCards.length > 0 ? sceneCards : recoverCompleteObjectsFromArrayProperty(content, "scenes");
  if (scenes.length === 0) return null;
  return {
    sceneCards: scenes,
    recoveredFromTruncatedJson: true,
    recoveredSceneCardCount: scenes.length,
  };
}

/**
 * The dialogue-rebalance / story-polish repair stages send the WRITER model
 * (the most expensive model in the pipeline) a set of reading pages and get
 * fully rewritten pages back. Until now a single malformed byte anywhere in
 * that payload discarded the whole call:
 *
 *   run 69dace41, call 2  — model used `\"` as the German closing quote and
 *                            never terminated the last string  → 2550 output
 *                            tokens ($0.011) thrown away
 *   run 69dace41, call 4  — hit the completion ceiling mid-array at exactly
 *                            maxTokens=4200 → 4200 output tokens ($0.016)
 *                            thrown away
 *
 * Both payloads still contained 3-4 COMPLETE page objects before the break.
 * Recovering those turns a fully wasted writer call into a partially applied
 * repair: strictly cheaper (no follow-up pass needed for the pages that did
 * land) and strictly better (real rewritten prose instead of none).
 */
export function recoverTruncatedReplacementsPayload(content: string): any | null {
  const replacements = recoverCompleteObjectsFromArrayProperty(content, "replacements");
  const pages = replacements.length > 0
    ? replacements
    : recoverCompleteObjectsFromArrayProperty(content, "chapters");
  const usable = pages.filter((page) => {
    if (!page || typeof page !== "object") return false;
    if (!Number.isFinite(Number((page as any).order))) return false;
    const paragraphs = (page as any).paragraphs;
    const hasParagraphs = Array.isArray(paragraphs) && paragraphs.some((p: any) => String(p || "").trim());
    const hasContent = String((page as any).content || "").trim().length > 0;
    return hasParagraphs || hasContent;
  });
  if (usable.length === 0) return null;
  return {
    replacements: usable,
    recoveredFromTruncatedJson: true,
    recoveredReplacementCount: usable.length,
  };
}

export function readJsonStringLiteral(source: string, start: number): { value: string; end: number } | null {
  if (source[start] !== '"') return null;
  let escape = false;
  for (let i = start + 1; i < source.length; i += 1) {
    const ch = source[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      const literal = source.slice(start, i + 1);
      try {
        return { value: JSON.parse(literal), end: i + 1 };
      } catch {
        return { value: literal.slice(1, -1), end: i + 1 };
      }
    }
  }
  return null;
}

export function findMatchingJsonBracket(source: string, start: number): number {
  const open = source[start];
  const close = open === "[" ? "]" : open === "{" ? "}" : "";
  if (!close) return -1;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === open) {
      depth += 1;
    } else if (ch === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export function recoverTopLevelStringArrayProperties(content: string, propertyName: string): string[][] {
  const trimmed = stripReasoningPreamble(String(content || "").trim());
  const source = repairLooseJson(sliceToOuterObject(stripJsonFence(trimmed)));
  const arrays: string[][] = [];
  let braceDepth = 0;
  let arrayDepth = 0;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];

    if (ch === '"') {
      const token = readJsonStringLiteral(source, i);
      if (!token) continue;
      let afterToken = token.end;
      while (afterToken < source.length && /\s/.test(source[afterToken])) afterToken += 1;

      if (
        braceDepth === 1
        && arrayDepth === 0
        && token.value === propertyName
        && source[afterToken] === ":"
      ) {
        let valueStart = afterToken + 1;
        while (valueStart < source.length && /\s/.test(source[valueStart])) valueStart += 1;
        if (source[valueStart] === "[") {
          const arrayEnd = findMatchingJsonBracket(source, valueStart);
          if (arrayEnd > valueStart) {
            const arrayText = source.slice(valueStart, arrayEnd + 1);
            try {
              const parsedArray = JSON.parse(repairLooseJson(arrayText));
              if (Array.isArray(parsedArray)) {
                const paragraphs = parsedArray
                  .map((item: any) => String(item || "").trim())
                  .filter(Boolean);
                if (paragraphs.length > 0) arrays.push(paragraphs);
              }
            } catch {
              // Ignore one malformed duplicate array and keep scanning. A later
              // complete array can still rescue usable prose.
            }
            i = arrayEnd;
            continue;
          }
        }
      }

      i = token.end - 1;
      continue;
    }

    if (ch === "{") braceDepth += 1;
    else if (ch === "}" && braceDepth > 0) braceDepth -= 1;
    else if (ch === "[") arrayDepth += 1;
    else if (ch === "]" && arrayDepth > 0) arrayDepth -= 1;
  }

  return arrays;
}

export function recoverDuplicateWholeStoryParagraphs(
  content: string,
  parsed: any
): { paragraphs: string[]; arrayCount: number; parsedParagraphCount: number } | null {
  if (Array.isArray(parsed?.chapters)) return null;
  const arrays = recoverTopLevelStringArrayProperties(content, "paragraphs");
  if (arrays.length <= 1) return null;
  const paragraphs = arrays.flat().map((p) => p.trim()).filter(Boolean);
  const parsedParagraphCount = Array.isArray(parsed?.paragraphs)
    ? parsed.paragraphs.map((p: any) => String(p || "").trim()).filter(Boolean).length
    : 0;
  if (paragraphs.length <= parsedParagraphCount) return null;
  return { paragraphs, arrayCount: arrays.length, parsedParagraphCount };
}

export function stripReasoningPreamble(content: string): string {
  const text = String(content || "").trim();
  if (!text) return text;

  const markerPatterns = [
    /\n\s*```(?:json)?\s*\{/i,
    /(?:^|\n)\s*\{/,
    /(?:^|\n)\s*(?:TITLE|TITEL)\s*[:=]/i,
    /(?:^|\n)\s*(?:DESCRIPTION|BESCHREIBUNG)\s*[:=]/i,
    /(?:^|\n)\s*(?:STORY|GESCHICHTE)\s*[:=]/i,
  ];

  const markerIndex = markerPatterns
    .map((pattern) => {
      const match = text.match(pattern);
      return match?.index ?? -1;
    })
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  if (!markerIndex || markerIndex <= 0) return text;
  const prefix = text.slice(0, markerIndex);
  const looksLikeReasoning =
    /\*\*[^*\n]{3,80}\*\*/.test(prefix) ||
    /\bI'm\s+(?:now|currently|focusing|exploring|integrating|refining|drafting|counting)\b/i.test(prefix) ||
    /\b(?:reasoning|thinking|drafting|refining|structuring|integrating|developing|finalizing)\b/i.test(prefix);

  return looksLikeReasoning ? text.slice(markerIndex).trim() : text;
}

