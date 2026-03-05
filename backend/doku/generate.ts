import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { secret } from "encore.dev/config";
import { ai, avatar } from "~encore/clients";
import { logTopic } from "../log/logger";
import { publishWithTimeout } from "../helpers/pubsubTimeout";
import { normalizeLanguage } from "../story/avatar-image-optimization";
import { resolveImageUrlForClient } from "../helpers/bucket-storage";
import { getAuthData } from "~encore/auth";
import { claimGenerationUsage } from "../helpers/billing";
import { extractParticipantProfileIds, extractRequestedProfileId } from "../helpers/profile-context";
import { assertProfilesBelongToUser, resolveRequestedProfileId } from "../helpers/profiles";
import { ensureAvatarProfileLinksTable } from "../avatar/profile-links";
import {
  assertParentalDailyLimit,
  buildGenerationGuidanceFromControls,
  getParentalControlsForUser,
  sanitizeTextWithBlockedTerms,
} from "../helpers/parental-controls";

const dokuDB = SQLDatabase.named("doku");
const avatarDB = SQLDatabase.named("avatar");
const openAIKey = secret("OpenAIKey");

// Pricing & model (align with stories)
const MODEL = "gpt-5-mini";
const INPUT_COST_PER_1M = 5.0;
const OUTPUT_COST_PER_1M = 15.0;
const IMAGE_COST_PER_ITEM = 0.0008;

const COSMOS_DOMAIN_META: Record<string, { title: string; icon: string }> = {
  space: { title: "Weltraum", icon: "space" },
  nature: { title: "Natur & Tiere", icon: "nature" },
  history: { title: "Geschichte & Kulturen", icon: "history" },
  tech: { title: "Technik & Erfindungen", icon: "tech" },
  body: { title: "Mensch & Koerper", icon: "body" },
  earth: { title: "Erde & Klima", icon: "earth" },
  arts: { title: "Kunst & Musik", icon: "arts" },
  logic: { title: "Logik & Raetsel", icon: "logic" },
};

function normalizeCosmosDomainId(value: string | null | undefined): string {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  const normalized = raw === "art" ? "arts" : raw;
  return normalized
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_")
    .slice(0, 40);
}

function toCosmosDomainLabel(domainId: string): string {
  const known = COSMOS_DOMAIN_META[domainId]?.title;
  if (known) return known;
  return domainId
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .slice(0, 64) || "Neue Lernwelt";
}

async function registerGeneratedDomainForProfiles(domainIdRaw: string | undefined, profileIds: string[]): Promise<void> {
  const domainId = normalizeCosmosDomainId(domainIdRaw);
  if (!domainId) return;

  const meta = COSMOS_DOMAIN_META[domainId];
  await avatarDB.exec`
    INSERT INTO domains (domain_id, title, icon, created_at)
    VALUES (
      ${domainId},
      ${meta?.title || toCosmosDomainLabel(domainId)},
      ${meta?.icon || domainId},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (domain_id) DO NOTHING
  `;

  for (const profileId of profileIds) {
    await avatarDB.exec`
      INSERT INTO tracking_domain_state (child_id, domain_id, evolution_index, planet_level, updated_at)
      VALUES (${profileId}, ${domainId}, 0, 1, CURRENT_TIMESTAMP)
      ON CONFLICT (child_id, domain_id) DO NOTHING
    `;
  }
}

// Domain types for Doku mode (Galileo/Checker Tobi style)
export type DokuDepth = "basic" | "standard" | "deep";
export type DokuAgeGroup = "3-5" | "6-8" | "9-12" | "13+";

export interface DokuInteractive {
  quiz?: {
    enabled: boolean;
    questions: {
      question: string;
      options: string[];
      answerIndex: number;
      explanation?: string;
    }[];
  };
  activities?: {
    enabled: boolean;
    items: {
      title: string;
      description: string;
      materials?: string[];
      durationMinutes?: number;
    }[];
  };
}

export interface DokuSection {
  title: string;
  content: string; // markdown/text
  keyFacts: string[];
  imageIdea?: string; // textual idea for possible image
  sectionImagePrompt?: string; // English Runware-optimized prompt (AI-generated)
  imageUrl?: string; // generated section image URL
  interactive?: DokuInteractive;
}

export type DokuLanguage = "de" | "en" | "fr" | "es" | "it" | "nl" | "ru";

export interface DokuConfig {
  topic: string;
  depth: DokuDepth;
  ageGroup: DokuAgeGroup;
  domainId?: string;
  perspective?: "science" | "history" | "technology" | "nature" | "culture";
  includeInteractive?: boolean;
  quizQuestions?: number; // 0..10
  handsOnActivities?: number; // 0..5
  tone?: "fun" | "neutral" | "curious";
  length?: "short" | "medium" | "long";
  language?: DokuLanguage;
  parentalGuidance?: string;
}

export interface Doku {
  id: string;
  userId: string;
  primaryProfileId?: string;
  participantProfileIds?: string[];
  title: string;
  topic: string;
  summary: string;
  content: {
    sections: DokuSection[];
  };
  coverImageUrl?: string;
  isPublic: boolean;
  status: "generating" | "complete" | "error";
  metadata?: {
    tokensUsed?: {
      prompt: number;
      completion: number;
      total: number;
    };
    model?: string;
    processingTime?: number;
    imagesGenerated?: number;
    totalCost?: {
      text: number;
      images: number;
      total: number;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface GenerateDokuRequest {
  userId: string;
  profileId?: string;
  participantProfileIds?: string[];
  config: DokuConfig;
}

function uniqueTrimmed(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    )
  );
}

export const generateDoku = api<GenerateDokuRequest, Doku>(
  { expose: true, method: "POST", path: "/doku/generate", auth: true },
  async (req) => {
    const id = crypto.randomUUID();
    const now = new Date();
    const auth = getAuthData();
    const currentUserId = auth?.userID;

    if (!currentUserId) {
      throw APIError.unauthenticated("Missing authenticated user for doku generation");
    }

    if (req.userId && req.userId !== currentUserId) {
      throw APIError.permissionDenied("userId mismatch: request userId does not match authenticated user");
    }

    const clerkToken = auth?.clerkToken;
    if (!clerkToken) {
      throw APIError.unauthenticated("Missing Clerk token for billing");
    }

    const parentalControls = await getParentalControlsForUser(currentUserId);
    const dayStartUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    const usageToday = await dokuDB.queryRow<{ count: number }>`
      SELECT COUNT(*)::int AS count
      FROM dokus
      WHERE user_id = ${currentUserId}
        AND created_at >= ${dayStartUtc}
    `;
    assertParentalDailyLimit({
      controls: parentalControls,
      kind: "doku",
      usedToday: usageToday?.count ?? 0,
    });

    const parentalGuidance = buildGenerationGuidanceFromControls(parentalControls);
    const config: DokuConfig = {
      ...req.config,
      parentalGuidance: parentalGuidance || undefined,
    };
    const normalizedDomainId = normalizeCosmosDomainId(config.domainId);
    if (normalizedDomainId) {
      config.domainId = normalizedDomainId;
    }
    const blockedTerms = parentalControls.enabled ? parentalControls.blockedTerms : [];
    const requestedPrimaryProfileId = req.profileId ?? extractRequestedProfileId(req);
    const primaryProfileId = await resolveRequestedProfileId({
      userId: currentUserId,
      requestedProfileId: requestedPrimaryProfileId,
      fallbackName: auth?.email ?? undefined,
    });
    const requestedParticipants = extractParticipantProfileIds(req);
    const participantProfileIds = uniqueTrimmed([
      primaryProfileId,
      ...(
        requestedParticipants.length > 0
          ? await assertProfilesBelongToUser(currentUserId, requestedParticipants)
          : []
      ),
    ]);
    await ensureAvatarProfileLinksTable();

    await claimGenerationUsage({
      userId: currentUserId,
      kind: "doku",
      profileId: primaryProfileId,
      contentRef: id,
      clerkToken,
    });

    await dokuDB.exec`
      INSERT INTO dokus (id, user_id, primary_profile_id, title, topic, content, cover_image_url, is_public, status, created_at, updated_at)
      VALUES (${id}, ${currentUserId}, ${primaryProfileId}, 'Wird generiert...', ${config.topic}, ${JSON.stringify({ sections: [] })}, NULL, false, 'generating', ${now}, ${now})
    `;
    for (const participantProfileId of participantProfileIds) {
      await dokuDB.exec`
        INSERT INTO doku_participants (
          id,
          doku_id,
          profile_id,
          avatar_ids,
          created_at
        )
        VALUES (
          ${crypto.randomUUID()},
          ${id},
          ${participantProfileId},
          '[]'::jsonb,
          ${now}
        )
        ON CONFLICT (doku_id, profile_id) DO NOTHING
      `;

      await dokuDB.exec`
        INSERT INTO doku_profile_state (
          profile_id,
          doku_id,
          is_favorite,
          progress_pct,
          completion_state,
          created_at,
          updated_at
        )
        VALUES (
          ${participantProfileId},
          ${id},
          FALSE,
          0,
          'not_started',
          ${now},
          ${now}
        )
        ON CONFLICT (profile_id, doku_id) DO NOTHING
      `;
    }

    const startTime = Date.now();
    let imagesGenerated = 0;

    try {
      const payload = buildOpenAIPayload(config);

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAIKey()}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenAI error ${res.status}: ${errText}`);
      }

      const data = await res.json() as any;

      await publishWithTimeout(logTopic, {
        source: "openai-doku-generation",
        timestamp: new Date(),
        request: payload,
        response: data,
      });

      const choice = data.choices?.[0];
      if (!choice?.message?.content) {
        throw new Error("OpenAI returned no content");
      }
      const clean = choice.message.content.replace(/```json\s*|\s*```/g, "").trim();
      const parsed = JSON.parse(clean) as {
        title: string;
        summary: string;
        hook?: string;
        mainQuestion?: string;
        sections: DokuSection[];
        wowFacts?: string[];
        comparisons?: string[];
        twist?: string;
        finale?: string;
        activity?: string;
        coverImagePrompt: string;
      };

      if (blockedTerms.length > 0) {
        const titleSanitized = sanitizeTextWithBlockedTerms(parsed.title, blockedTerms);
        const summarySanitized = sanitizeTextWithBlockedTerms(parsed.summary, blockedTerms);
        parsed.title = titleSanitized.text;
        parsed.summary = summarySanitized.text;
        parsed.sections = parsed.sections.map((section) => {
          const sectionTitle = sanitizeTextWithBlockedTerms(section.title, blockedTerms);
          const sectionContent = sanitizeTextWithBlockedTerms(section.content, blockedTerms);
          const keyFacts = section.keyFacts.map((fact) => sanitizeTextWithBlockedTerms(fact, blockedTerms).text);
          return {
            ...section,
            title: sectionTitle.text,
            content: sectionContent.text,
            keyFacts,
          };
        });
      }

      // Optional: generate a cover image
      // OPTIMIZATION v4.0: Use runware:400@4 with optimized parameters
      let coverImageUrl: string | undefined = undefined;
      try {
        const coverPromptDescription = normalizeLanguage(parsed.coverImagePrompt);
        const coverPrompt = `Kid-friendly educational cover illustration: ${coverPromptDescription}. Axel Scheffler watercolor storybook style, joyful educational tone, clear composition, bright colors, child-friendly illustration, safe content, no text in the image.`;
        const img = await ai.generateImage({
          prompt: coverPrompt,
          width: 1024,
          height: 1024,
          steps: 4,     // runware:400@4 uses fewer steps
          CFGScale: 4,
          outputFormat: "JPEG",
        });
        coverImageUrl = img.imageUrl;
        imagesGenerated += 1;
      } catch (imgErr) {
        console.warn("Cover image generation failed:", imgErr);
      }

      // === SECTION IMAGE GENERATION ===
      // Generate images for each section in parallel using Promise.allSettled
      const sectionImageResults = await Promise.allSettled(
        parsed.sections.map(async (section, index) => {
          const rawPrompt = section.sectionImagePrompt || section.imageIdea;
          if (!rawPrompt) return { index, imageUrl: undefined };

          try {
            const normalizedPrompt = normalizeLanguage(rawPrompt);
            const sectionPrompt = `Kid-friendly educational illustration: ${normalizedPrompt}. Axel Scheffler watercolor storybook style, joyful educational tone, clear composition, bright colors, child-friendly illustration, safe content, no text in the image.`;

            const img = await ai.generateImage({
              prompt: sectionPrompt,
              width: 1024,
              height: 1024,
              steps: 4,
              CFGScale: 4,
              outputFormat: "JPEG",
            });
            return { index, imageUrl: img.imageUrl };
          } catch (err) {
            console.warn(`Section ${index} image generation failed:`, err);
            return { index, imageUrl: undefined };
          }
        })
      );

      // Attach imageUrl to each section
      for (const result of sectionImageResults) {
        if (result.status === "fulfilled" && result.value.imageUrl) {
          parsed.sections[result.value.index].imageUrl = result.value.imageUrl;
          imagesGenerated++;
        }
      }

      const processingTime = Date.now() - startTime;
      const tokensUsed = {
        prompt: data.usage?.prompt_tokens ?? 0,
        completion: data.usage?.completion_tokens ?? 0,
        total: data.usage?.total_tokens ?? 0,
      };
      const textCost =
        (tokensUsed.prompt / 1_000_000) * INPUT_COST_PER_1M +
        (tokensUsed.completion / 1_000_000) * OUTPUT_COST_PER_1M;
      const imagesCost = imagesGenerated * IMAGE_COST_PER_ITEM;

      const metadata = {
        tokensUsed,
        model: MODEL,
        processingTime,
        imagesGenerated,
        configSnapshot: {
          topic: config.topic,
          domainId: config.domainId || null,
          ageGroup: config.ageGroup,
          depth: config.depth,
          perspective: config.perspective ?? "science",
          tone: config.tone ?? "curious",
          length: config.length ?? "medium",
          includeInteractive: config.includeInteractive ?? false,
          quizQuestions: config.quizQuestions ?? 0,
          handsOnActivities: config.handsOnActivities ?? 0,
          language: config.language ?? "de",
          parentalGuidanceActive: Boolean(config.parentalGuidance),
        },
        totalCost: {
          text: textCost,
          images: imagesCost,
          total: textCost + imagesCost,
        },
      };

      await dokuDB.exec`
        UPDATE dokus
        SET title = ${parsed.title},
            content = ${JSON.stringify({
              sections: parsed.sections,
              summary: parsed.summary,
              title: parsed.title,
              hook: parsed.hook,
              mainQuestion: parsed.mainQuestion,
              wowFacts: parsed.wowFacts,
              comparisons: parsed.comparisons,
              twist: parsed.twist,
              finale: parsed.finale,
              activity: parsed.activity,
            })},
            cover_image_url = ${coverImageUrl ?? null},
            status = 'complete',
            metadata = ${JSON.stringify(metadata)},
            updated_at = ${new Date()}
        WHERE id = ${id}
      `;

      try {
        await registerGeneratedDomainForProfiles(config.domainId, participantProfileIds);
      } catch (domainSyncError) {
        console.warn("Failed to register generated doku domain for cosmos", domainSyncError);
      }

      // Apply personality & memory updates for ALL user avatars based on Doku topic
      try {
        const knowledgeTrait = inferKnowledgeSubcategory(config.topic, config.perspective);
        const basePoints = 2
          + (config.depth === "standard" ? 1 : 0)
          + (config.depth === "deep" ? 2 : 0)
          + (config.length === "long" ? 1 : 0);
        const knowledgePoints = Math.max(1, Math.min(10, basePoints));

        // Build changes with detailed descriptions
        const subjectName = config.topic;
        const changes = [
          {
            trait: knowledgeTrait,
            change: knowledgePoints,
            description: `+${knowledgePoints} ${knowledgeTrait.split('.')[1]} durch Doku "${parsed.title}" über ${subjectName}`
          },
          {
            trait: "curiosity",
            change: 1,
            description: `+1 Neugier durch Doku-Lektüre über ${subjectName}`
          },
        ];

        // Load avatars scoped to participant profiles
        const userAvatars = await avatarDB.queryAll<{ id: string; name: string }>`
          SELECT a.id, a.name
          FROM avatars a
          WHERE a.user_id = ${currentUserId}
            AND (
              a.profile_id IS NULL
              OR a.profile_id = ANY(${participantProfileIds})
              OR EXISTS (
                SELECT 1
                FROM avatar_profile_links apl
                WHERE apl.avatar_id = a.id
                  AND apl.user_id = ${currentUserId}
                  AND apl.profile_id = ANY(${participantProfileIds})
              )
            )
        `;

        for (const a of userAvatars) {
          try {
            await avatar.updatePersonality({
              id: a.id,
              changes,
              storyId: id,
              contentTitle: parsed.title,
              contentType: 'doku'
            });

            // Create detailed development description
            const developmentSummary = changes
              .map(c => c.description || `${c.trait}: +${c.change}`)
              .join(', ');

            await avatar.addMemory({
              id: a.id,
              storyId: id,
              storyTitle: parsed.title,
              experience: `Ich habe die Doku "${parsed.title}" gelesen. Thema: ${config.topic}.`,
              emotionalImpact: "positive",
              personalityChanges: changes,
              developmentDescription: `Wissensentwicklung: ${developmentSummary}`,
              contentType: 'doku'
            });
          } catch (e) {
            console.warn("Failed to update avatar from doku:", a.id, e);
          }
        }
      } catch (applyErr) {
        console.warn("Applying doku personality/memory updates failed:", applyErr);
      }

      const resolvedCoverImageUrl = await resolveImageUrlForClient(coverImageUrl);

      // Resolve section image URLs for client response
      const resolvedSections = await Promise.all(
        parsed.sections.map(async (section) => {
          if (section.imageUrl) {
            const resolvedUrl = await resolveImageUrlForClient(section.imageUrl);
            return { ...section, imageUrl: resolvedUrl || section.imageUrl };
          }
          return section;
        })
      );

      return {
        id,
        userId: currentUserId,
        primaryProfileId,
        participantProfileIds,
        title: parsed.title,
        topic: config.topic,
        summary: parsed.summary,
        content: { sections: resolvedSections },
        coverImageUrl: resolvedCoverImageUrl ?? coverImageUrl,
        isPublic: false,
        status: "complete",
        metadata,
        createdAt: now,
        updatedAt: new Date(),
      };
    } catch (err) {
      await dokuDB.exec`
        UPDATE dokus SET status = 'error', updated_at = ${new Date()} WHERE id = ${id}
      `;
      throw err;
    }
  }
);

function buildOpenAIPayload(config: DokuConfig) {
  const sectionsCount =
    config.length === "short" ? 3 : config.length === "long" ? 7 : 5;
  const quizCount = Math.max(0, Math.min(config.quizQuestions ?? 3, 10));
  const activitiesCount = Math.max(0, Math.min(config.handsOnActivities ?? 1, 5));
  const language = config.language ?? "de";

  const prompts = getLanguagePrompts(language);

  const system = prompts.system;
  const parentalSection = config.parentalGuidance
    ? `\n\nPARENTAL SAFETY AND LEARNING RULES (MUST FOLLOW):\n${config.parentalGuidance}\n`
    : "";
  const user = `${prompts.user(config, sectionsCount, quizCount, activitiesCount)}${parentalSection}`;

  return {
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 16000,
  };
}

function getLanguagePrompts(language: DokuLanguage) {
  // Shared JSON schema for sections (language-independent structure)
  const sectionSchema = `{
      "title": "Section title",
      "content": "Flowing text (120-220 words)",
      "keyFacts": ["Fact 1", "Fact 2", "Fact 3"],
      "imageIdea": "Short description for illustration (in document language)",
      "sectionImagePrompt": "English prompt for image generation: Kid-friendly watercolor illustration of [concrete visual scene from this section]. Axel Scheffler style, bright warm colors, educational, no text.",
      "interactive": {
        "quiz": {
          "enabled": true,
          "questions": [
            {
              "question": "Question?",
              "options": ["A", "B", "C", "D"],
              "answerIndex": 0,
              "explanation": "Why is this correct?"
            }
          ]
        },
        "activities": {
          "enabled": true,
          "items": [
            {
              "title": "Activity title",
              "description": "Child-friendly instructions",
              "materials": ["Paper", "Pens"],
              "durationMinutes": 10
            }
          ]
        }
      }
    }`;

  const imagePromptRules = `
IMAGE PROMPT RULES (for "sectionImagePrompt" and "coverImagePrompt"):
- MUST be written in ENGLISH regardless of document language.
- Describe a CONCRETE visual scene that captures the section's core concept.
- Style: "Axel Scheffler watercolor storybook style, bright warm colors, educational, joyful, child-friendly"
- NO text in image, NO scary or dangerous scenes, NO human faces in close-up.
- Max 2 sentences, visually descriptive. Example: "A curious child examining a giant magnifying glass over a colorful butterfly wing, Axel Scheffler watercolor storybook style, bright warm colors, educational."`;

  const prompts: Record<DokuLanguage, {
    system: string;
    user: (config: DokuConfig, sectionsCount: number, quizCount: number, activitiesCount: number) => string;
  }> = {
    de: {
      system: `Du bist ein erstklassiger Autor und Dramaturg fuer hochspannende, kindgerechte Wissensdokus.

Deine Aufgabe ist es, eine Kinder-Doku zu erzeugen, die sich wie eine starke, moderne Wissenssendung anfuehlt:
- extrem neugierig machend
- leicht verstaendlich
- emotional warm
- voller Aha-Momente
- spannend von Anfang bis Ende
- fachlich korrekt
- niemals trocken, schulisch oder wie Wikipedia

Die Doku soll Kinder so packen, dass sie unbedingt weiterlesen oder weiterhoeren wollen.
Sie soll sich wie eine Expedition, ein Raetsel oder eine Entdeckung anfuehlen - nicht wie Unterricht.

STILREGELN:
- Schreibe NICHT wie ein Lexikon, Schulbuch oder trocken/abstrakt.
- Schreibe bildhaft, neugierig, klar und lebendig.
- Verwende kurze bis mittlere Saetze.
- Nutze viel Staunen, aber kein nerviges Uebertreiben.
- Sprich das Kind nicht dauernd direkt mit "du" an, aber schaffe Naehe.
- Keine flachen Witze im Uebermass.
- Keine komplizierten Fachwoerter ohne einfache Erklaerung.
- Jede Erklaerung muss fuer Kinder wirklich greifbar sein.
- Nutze starke Vergleiche aus der Alltagswelt von Kindern.
- Erzeuge Kopfkino.
- Variiere Satzanfaenge: Nie zwei aufeinanderfolgende Saetze mit dem gleichen Wort beginnen.
- Maximal 1 Ausrufezeichen pro Abschnitt.

SPANNUNGSREGELN:
- Alle 20-40 Sekunden Lesefluss muss etwas passieren: neue Frage, neuer Wow-Fakt, ueberraschende Wendung, neue Vorstellung im Kopf.
- Die Energie darf nie absinken.

WAS UNBEDINGT ZU VERMEIDEN IST:
- Langweilige Einleitungen
- Zu viele Fakten hintereinander ohne Atempause
- Belehrender Ton
- Fuellsaetze und allgemeines Blabla
- Schwache Kapitelueberschriften
- Zu fruehe vollstaendige Aufloesung
- Kein Spannungsbogen
- Keine Bilder im Kopf
- Unnoetige Wiederholungen
- Generische Saetze wie "Das ist sehr interessant" oder "Das ist wichtig"

KEINE gefaehrlichen, beaengstigenden oder ungeeigneten Inhalte.

${imagePromptRules}`,
      user: (config, sectionsCount, quizCount, activitiesCount) => {
        const ageRules = {
          "3-5": `ALTERSANPASSUNG (3-5 Jahre):
- Sehr einfache Sprache, sehr konkrete Bilder
- Kurze Kapitel, wenig Fachbegriffe
- Mehr Staunen als Details
- Quiz sehr leicht und spielerisch`,
          "6-8": `ALTERSANPASSUNG (6-8 Jahre):
- Einfache bis mittlere Sprache, klare Erklaerungen
- Erste Ursache-Wirkung-Erklaerungen
- Mehr Details, aber immer greifbar
- Quiz mit Fakten + Verstehen`,
          "9-12": `ALTERSANPASSUNG (9-12 Jahre):
- Etwas anspruchsvoller, mehr Tiefe
- Staerkere Zusammenhaenge
- Mehr "Warum" und "Was waere wenn"
- Quiz mit Verstehen, Vergleichen, Anwenden`,
          "13+": `ALTERSANPASSUNG (13+ Jahre):
- Anspruchsvoll, echte Tiefe
- Komplexe Zusammenhaenge, kritisches Denken
- Querverbindungen zu anderen Fachgebieten
- Quiz mit Transfer, Analyse, eigener Meinung`,
        };

        return `Erzeuge eine hochspannende Kinder-Wissensdoku zum Thema: "${config.topic}".

Zielgruppe: ${config.ageGroup} Jahre
Tiefe: ${config.depth}
Perspektive: ${config.perspective ?? "science"}
Tonalitaet: ${config.tone ?? "curious"}
Laenge: ${config.length ?? "medium"} (${sectionsCount} Kapitel)

${ageRules[config.ageGroup] || ageRules["6-8"]}

DRAMATURGIE - Die Doku MUSS diese Struktur haben:

1. TITEL: Sofort neugierig machend. KEINE langweiligen Titel wie "Alles ueber..." oder "Die Geschichte von...". Stattdessen echte Neugier: "Warum...", "Was passiert wenn...", "Das geheime Leben von...", "Das verrueckte Geheimnis von..."

2. HOOK: 2-5 Saetze die sofort ein Raetsel, eine verblueffende Frage oder einen Wow-Fakt eroeffnen. Der Einstieg muss so gut sein, dass ein Kind direkt wissen will, wie es weitergeht.

3. HAUPTFRAGE: Die grosse Leitfrage der Doku, klar formuliert. Diese Frage zieht sich spuerbar durch die ganze Doku.

4. KAPITEL: ${sectionsCount} kurze Kapitel, jedes mit:
   - Einer Mini-Frage oder Mini-Spannung als Einstieg
   - Einer klaren, kindgerechten Erklaerung
   - Mindestens 1 Wow-Fakt
   - Mindestens 1 starkem Bildvergleich aus dem Kinderalltag
   - Einem kleinen Uebergang der neugierig auf das naechste Kapitel macht

5. TWIST: In der Mitte oder im letzten Drittel ein echter Ueberraschungsmoment - etwas das Kinder nicht erwarten und das das Thema groesser oder faszinierender macht.

6. FINALE: Ein starkes Schlussbild, ein letzter Wow-Gedanke oder eine grosse Staunensfrage. Das Ende darf NICHT einfach auslaufen.

INHALTLICHE QUALITAET:
- 1 starke Hauptfrage
- 3-5 Unterfragen (verteilt auf Kapitel)
- 5-8 wirklich wichtige Fakten
- 2-4 Wow-Fakten (verblueffend, unerwartet)
- 2-4 starke Vergleichsbilder (aus dem Kinderalltag)
- 1 Ueberraschung/Twist
- 1 emotional starkes Schlussbild

WICHTIG: Lieber wenige, aber starke und merkbare Fakten als zu viele.

QUIZ (${config.includeInteractive ? quizCount : 0} Fragen):
${config.includeInteractive && quizCount > 0 ? `Mischung aus:
- 2-3 Erinnern-Fragen (Fakten aus der Doku)
- 2-3 Verstehen-Fragen (Zusammenhaenge erklaeren)
- 1-2 Transfer-Fragen ("Was wuerde passieren wenn...?")
Nutze verschiedene Typen: Multiple Choice, Richtig/Falsch, Reihenfolge ordnen, Ursache/Wirkung.
KEINE langweiligen oder offensichtlich trivialen Fragen.` : "Keine Quizfragen."}

AKTIVITAETEN: ${config.includeInteractive ? activitiesCount : 0}
${config.includeInteractive && activitiesCount > 0 ? "Kreative Mitmach-Ideen mit Alltagsmaterialien, passend zum Thema." : ""}

Antworte AUSSCHLIESSLICH als JSON-Objekt mit folgender Struktur:

{
  "title": "Neugierig machender Titel (max 10 Woerter)",
  "summary": "1-3 Saetze die Lust auf mehr machen",
  "hook": "2-5 packende Eroeffnungssaetze mit Raetsel/Wow-Fakt",
  "mainQuestion": "Die grosse Leitfrage der Doku",
  "sections": [
    ${sectionSchema}
  ],
  "wowFacts": ["Verblueffender Fakt 1", "Verblueffender Fakt 2", "Verblueffender Fakt 3"],
  "comparisons": ["Starker Bildvergleich 1", "Starker Bildvergleich 2"],
  "twist": "Der ueberraschende Wendepunkt der Doku",
  "finale": "Das starke Schlussbild oder der letzte Wow-Gedanke",
  "activity": "Eine kreative Mitmach-Idee oder Denkanregung passend zum Thema",
  "coverImagePrompt": "English: Kid-friendly watercolor cover illustration showing [main topic visual]. Axel Scheffler style, bright warm colors, educational, joyful, no text."
}

SELBSTKONTROLLE VOR AUSGABE - Pruefe:
- Ist der Titel wirklich neugierig machend (nicht generisch)?
- Ist der Hook stark genug (wuerde ein Kind weiterlesen wollen)?
- Ist die Doku spannend und nicht nur informativ?
- Gibt es genug Wow-Momente und Kopfkino?
- Sind die Erklaerungen wirklich kindgerecht und greifbar?
- Gibt es mindestens einen echten Twist?
- Ist das Ende stark (nicht einfach auslaufend)?
- Ist das Quiz abwechslungsreich?
Wenn etwas schwach ist, verbessere es vor der Ausgabe.`
      }
    },
    en: {
      system: `You are a world-class author and dramaturg for thrilling, child-friendly knowledge documentaries.

Your job is to create a children's documentary that feels like a powerful, modern science show:
- Extremely curiosity-sparking
- Easy to understand
- Emotionally warm
- Full of aha moments
- Exciting from start to finish
- Factually correct
- Never dry, academic, or Wikipedia-like

The documentary should grip children so they absolutely want to keep reading or listening.
It should feel like an expedition, a mystery, or a discovery - not like a lesson.

STYLE RULES:
- Do NOT write like an encyclopedia, textbook, or in a dry/abstract way.
- Write vividly, curiously, clearly, and with life.
- Use short to medium sentences.
- Use wonder and amazement, but no annoying exaggeration.
- Don't constantly address the child with "you", but create closeness.
- No flat jokes in excess.
- No complicated technical terms without simple explanation.
- Every explanation must be truly tangible for children.
- Use strong comparisons from children's everyday world.
- Create mental cinema / vivid imagery.
- Vary sentence starters: Never begin two consecutive sentences with the same word.
- Maximum 1 exclamation mark per section.

TENSION RULES:
- Every 20-40 seconds of reading flow, something must happen: new question, new wow fact, surprising turn, new mental image.
- The energy must never drop.

MUST AVOID:
- Boring introductions
- Too many facts in a row without a breather
- Lecturing tone
- Filler sentences and generic blabla
- Weak chapter titles
- Premature full resolution
- No tension arc
- No mental imagery
- Unnecessary repetitions
- Generic sentences like "This is very interesting" or "This is important"

NO dangerous, frightening, or inappropriate content.

${imagePromptRules}`,
      user: (config, sectionsCount, quizCount, activitiesCount) => {
        const ageRules: Record<string, string> = {
          "3-5": `AGE ADAPTATION (3-5 years):
- Very simple language, very concrete images
- Short chapters, few technical terms
- More wonder than details
- Quiz very easy and playful`,
          "6-8": `AGE ADAPTATION (6-8 years):
- Simple to medium language, clear explanations
- First cause-and-effect explanations
- More details, but always tangible
- Quiz with facts + understanding`,
          "9-12": `AGE ADAPTATION (9-12 years):
- Somewhat more demanding, more depth
- Stronger connections
- More "why" and "what if"
- Quiz with understanding, comparing, applying`,
          "13+": `AGE ADAPTATION (13+ years):
- Demanding, real depth
- Complex connections, critical thinking
- Cross-references to other fields
- Quiz with transfer, analysis, own opinion`,
        };

        return `Create a thrilling children's knowledge documentary on the topic: "${config.topic}".

Target audience: ${config.ageGroup} years
Depth: ${config.depth}
Perspective: ${config.perspective ?? "science"}
Tone: ${config.tone ?? "curious"}
Length: ${config.length ?? "medium"} (${sectionsCount} chapters)

${ageRules[config.ageGroup] || ageRules["6-8"]}

DRAMATURGY - The documentary MUST have this structure:

1. TITLE: Immediately curiosity-sparking. NO boring titles like "All about..." or "The story of...". Instead real curiosity: "Why...", "What happens when...", "The secret life of...", "The crazy secret of..."

2. HOOK: 2-5 sentences that immediately open a mystery, a stunning question, or a wow fact. The opening must be so good that a child instantly wants to know what comes next.

3. MAIN QUESTION: The big guiding question of the documentary, clearly stated. This question runs visibly through the entire documentary.

4. CHAPTERS: ${sectionsCount} short chapters, each with:
   - A mini-question or mini-tension as an opener
   - A clear, child-friendly explanation
   - At least 1 wow fact
   - At least 1 strong visual comparison from children's everyday life
   - A small transition that sparks curiosity for the next chapter

5. TWIST: In the middle or last third, a real surprise moment - something children don't expect that makes the topic bigger or more fascinating.

6. FINALE: A strong closing image, a final wow thought, or a big wonder question. The ending must NOT just fade out.

CONTENT QUALITY:
- 1 strong main question
- 3-5 sub-questions (spread across chapters)
- 5-8 truly important facts
- 2-4 wow facts (stunning, unexpected)
- 2-4 strong visual comparisons (from children's everyday life)
- 1 surprise/twist
- 1 emotionally strong closing image

IMPORTANT: Fewer but strong and memorable facts are better than too many.

QUIZ (${config.includeInteractive ? quizCount : 0} questions):
${config.includeInteractive && quizCount > 0 ? `Mix of:
- 2-3 Remember questions (facts from the documentary)
- 2-3 Understanding questions (explain connections)
- 1-2 Transfer questions ("What would happen if...?")
Use different types: Multiple Choice, True/False, Order, Cause/Effect.
NO boring or obviously trivial questions.` : "No quiz questions."}

ACTIVITIES: ${config.includeInteractive ? activitiesCount : 0}
${config.includeInteractive && activitiesCount > 0 ? "Creative hands-on ideas with everyday materials, fitting the topic." : ""}

Respond EXCLUSIVELY as a JSON object with the following structure:

{
  "title": "Curiosity-sparking title (max 10 words)",
  "summary": "1-3 sentences that make you want more",
  "hook": "2-5 gripping opening sentences with mystery/wow fact",
  "mainQuestion": "The big guiding question of the documentary",
  "sections": [
    ${sectionSchema}
  ],
  "wowFacts": ["Stunning fact 1", "Stunning fact 2", "Stunning fact 3"],
  "comparisons": ["Strong visual comparison 1", "Strong visual comparison 2"],
  "twist": "The surprising turning point of the documentary",
  "finale": "The strong closing image or final wow thought",
  "activity": "A creative hands-on idea or thinking prompt fitting the topic",
  "coverImagePrompt": "Kid-friendly watercolor cover illustration showing [main topic visual]. Axel Scheffler style, bright warm colors, educational, joyful, no text."
}

SELF-CHECK BEFORE OUTPUT - Verify:
- Is the title truly curiosity-sparking (not generic)?
- Is the hook strong enough (would a child want to keep reading)?
- Is the documentary exciting, not just informative?
- Are there enough wow moments and mental imagery?
- Are the explanations truly child-friendly and tangible?
- Is there at least one real twist?
- Is the ending strong (not just fading out)?
- Is the quiz varied?
If anything is weak, improve it before outputting.`
      }
    },
    fr: {
      system: `Tu es un auteur et dramaturge de premier ordre pour des documentaires de connaissances captivants et adaptes aux enfants.

Ta mission: creer un documentaire pour enfants qui ressemble a une emission moderne et passionnante - pas a un cours.
Il doit etre: extremement curieux, facile a comprendre, emotionnellement chaleureux, plein de moments "aha", passionnant du debut a la fin, factuellement correct, jamais sec ou scolaire.

REGLES DE STYLE:
- N'ecris PAS comme une encyclopedie ou un manuel scolaire.
- Ecris de maniere imagee, curieuse, claire et vivante.
- Utilise des comparaisons fortes du quotidien des enfants. Cree du cinema mental.
- Varie les debuts de phrases. Maximum 1 point d'exclamation par section.
- Pas de phrases generiques. Toujours concret et specifique.
- AUCUN contenu dangereux, effrayant ou inapproprie.

REGLES DE TENSION: Toutes les 20-40 secondes de lecture, quelque chose doit se passer: nouvelle question, fait wow, tournure surprenante.

${imagePromptRules}`,
      user: (config, sectionsCount, quizCount, activitiesCount) => `Cree un documentaire de connaissances captivant pour enfants sur: "${config.topic}".

Public cible: ${config.ageGroup} ans | Profondeur: ${config.depth} | Perspective: ${config.perspective ?? "science"} | Ton: ${config.tone ?? "curious"} | Longueur: ${sectionsCount} chapitres

DRAMATURGIE OBLIGATOIRE:
1. TITRE: Qui eveille immediatement la curiosite (pas "Tout sur..." mais "Pourquoi...", "Le secret de...")
2. HOOK: 2-5 phrases qui ouvrent un mystere ou un fait stupefiant
3. QUESTION PRINCIPALE: La grande question directrice du documentaire
4. CHAPITRES: Chacun avec mini-question, explication claire, 1 fait wow, 1 comparaison visuelle, transition vers le suivant
5. TWIST: Un moment de surprise au milieu ou dernier tiers
6. FINALE: Image de conclusion forte, pas de fin qui s'eteint

Quiz: ${config.includeInteractive ? quizCount : 0} questions (melange souvenir/comprehension/transfert)
Activites: ${config.includeInteractive ? activitiesCount : 0}

Reponds EXCLUSIVEMENT en JSON:

{
  "title": "Titre captivant (max 10 mots)",
  "summary": "1-3 phrases qui donnent envie de lire",
  "hook": "2-5 phrases d'ouverture captivantes",
  "mainQuestion": "La grande question directrice",
  "sections": [
    ${sectionSchema}
  ],
  "wowFacts": ["Fait stupefiant 1", "Fait 2", "Fait 3"],
  "comparisons": ["Comparaison visuelle 1", "Comparaison 2"],
  "twist": "Le moment de surprise",
  "finale": "L'image de conclusion forte",
  "activity": "Une idee creative de participation",
  "coverImagePrompt": "English: Kid-friendly watercolor cover illustration showing [main topic visual]. Axel Scheffler style, bright warm colors, educational, joyful, no text."
}`
    },
    es: {
      system: `Eres un autor y dramaturgo de primer nivel para documentales de conocimiento emocionantes y adaptados a ninos.

Tu mision: crear un documental para ninos que se sienta como un programa moderno y apasionante - no como una leccion.
Debe ser: extremadamente curioso, facil de entender, emocionalmente calido, lleno de momentos "aha", emocionante de principio a fin, factualmente correcto, nunca seco o academico.

REGLAS DE ESTILO:
- NO escribas como una enciclopedia o libro de texto.
- Escribe de manera vivida, curiosa, clara y con vida.
- Usa comparaciones fuertes del mundo cotidiano de los ninos. Crea cine mental.
- Varia los inicios de oraciones. Maximo 1 signo de exclamacion por seccion.
- Sin frases genericas. Siempre concreto y especifico.
- SIN contenido peligroso, aterrador o inapropiado.

REGLAS DE TENSION: Cada 20-40 segundos de lectura, algo debe pasar: nueva pregunta, hecho wow, giro sorprendente.

${imagePromptRules}`,
      user: (config, sectionsCount, quizCount, activitiesCount) => `Crea un documental de conocimiento emocionante para ninos sobre: "${config.topic}".

Publico objetivo: ${config.ageGroup} anos | Profundidad: ${config.depth} | Perspectiva: ${config.perspective ?? "science"} | Tono: ${config.tone ?? "curious"} | Longitud: ${sectionsCount} capitulos

DRAMATURGIA OBLIGATORIA:
1. TITULO: Que despierte curiosidad inmediata (no "Todo sobre..." sino "Por que...", "El secreto de...")
2. HOOK: 2-5 frases que abran un misterio o hecho asombroso
3. PREGUNTA PRINCIPAL: La gran pregunta guia del documental
4. CAPITULOS: Cada uno con mini-pregunta, explicacion clara, 1 hecho wow, 1 comparacion visual, transicion al siguiente
5. TWIST: Momento de sorpresa en la mitad o ultimo tercio
6. FINAL: Imagen de cierre fuerte, no un final que se apaga

Quiz: ${config.includeInteractive ? quizCount : 0} preguntas (mezcla recuerdo/comprension/transferencia)
Actividades: ${config.includeInteractive ? activitiesCount : 0}

Responde EXCLUSIVAMENTE en JSON:

{
  "title": "Titulo emocionante (max 10 palabras)",
  "summary": "1-3 frases que dan ganas de leer",
  "hook": "2-5 frases de apertura cautivadoras",
  "mainQuestion": "La gran pregunta guia",
  "sections": [
    ${sectionSchema}
  ],
  "wowFacts": ["Hecho asombroso 1", "Hecho 2", "Hecho 3"],
  "comparisons": ["Comparacion visual 1", "Comparacion 2"],
  "twist": "El momento de sorpresa",
  "finale": "La imagen de cierre fuerte",
  "activity": "Una idea creativa de participacion",
  "coverImagePrompt": "English: Kid-friendly watercolor cover illustration showing [main topic visual]. Axel Scheffler style, bright warm colors, educational, joyful, no text."
}`
    },
    it: {
      system: `Sei un autore e drammaturgo di primo livello per documentari di conoscenza avvincenti e adatti ai bambini.

La tua missione: creare un documentario per bambini che sembri un programma moderno e appassionante - non una lezione.
Deve essere: estremamente curioso, facile da capire, emotivamente caldo, pieno di momenti "aha", avvincente dall'inizio alla fine, fattualmente corretto, mai secco o scolastico.

REGOLE DI STILE:
- NON scrivere come un'enciclopedia o un libro di testo.
- Scrivi in modo vivido, curioso, chiaro e pieno di vita.
- Usa confronti forti dal mondo quotidiano dei bambini. Crea cinema mentale.
- Varia gli inizi delle frasi. Massimo 1 punto esclamativo per sezione.
- Nessuna frase generica. Sempre concreto e specifico.
- NESSUN contenuto pericoloso, spaventoso o inappropriato.

REGOLE DI TENSIONE: Ogni 20-40 secondi di lettura, deve succedere qualcosa: nuova domanda, fatto wow, svolta sorprendente.

${imagePromptRules}`,
      user: (config, sectionsCount, quizCount, activitiesCount) => `Crea un documentario di conoscenza avvincente per bambini su: "${config.topic}".

Pubblico target: ${config.ageGroup} anni | Profondita: ${config.depth} | Prospettiva: ${config.perspective ?? "science"} | Tono: ${config.tone ?? "curious"} | Lunghezza: ${sectionsCount} capitoli

DRAMMATURGIA OBBLIGATORIA:
1. TITOLO: Che susciti curiosita immediata (non "Tutto su..." ma "Perche...", "Il segreto di...")
2. HOOK: 2-5 frasi che aprono un mistero o fatto stupefacente
3. DOMANDA PRINCIPALE: La grande domanda guida del documentario
4. CAPITOLI: Ognuno con mini-domanda, spiegazione chiara, 1 fatto wow, 1 confronto visivo, transizione al successivo
5. TWIST: Momento di sorpresa a meta o nell'ultimo terzo
6. FINALE: Immagine di chiusura forte, non un finale che si spegne

Quiz: ${config.includeInteractive ? quizCount : 0} domande (mix ricordo/comprensione/trasferimento)
Attivita: ${config.includeInteractive ? activitiesCount : 0}

Rispondi ESCLUSIVAMENTE in JSON:

{
  "title": "Titolo avvincente (max 10 parole)",
  "summary": "1-3 frasi che fanno venire voglia di leggere",
  "hook": "2-5 frasi di apertura avvincenti",
  "mainQuestion": "La grande domanda guida",
  "sections": [
    ${sectionSchema}
  ],
  "wowFacts": ["Fatto stupefacente 1", "Fatto 2", "Fatto 3"],
  "comparisons": ["Confronto visivo 1", "Confronto 2"],
  "twist": "Il momento di sorpresa",
  "finale": "L'immagine di chiusura forte",
  "activity": "Un'idea creativa di partecipazione",
  "coverImagePrompt": "English: Kid-friendly watercolor cover illustration showing [main topic visual]. Axel Scheffler style, bright warm colors, educational, joyful, no text."
}`
    },
    nl: {
      system: `Je bent een eersteklas auteur en dramaturg voor spannende, kindvriendelijke kennisdocumentaires.

Je missie: maak een kinderdocumentaire die aanvoelt als een krachtig, modern kennisprogramma - niet als een les.
Het moet zijn: extreem nieuwsgierig makend, makkelijk te begrijpen, emotioneel warm, vol aha-momenten, spannend van begin tot eind, feitelijk correct, nooit droog of schools.

STIJLREGELS:
- Schrijf NIET als een encyclopedie of schoolboek.
- Schrijf beeldend, nieuwsgierig, helder en levendig.
- Gebruik sterke vergelijkingen uit de dagelijkse wereld van kinderen. Creeer mentale cinema.
- Varieer zinsbeginnnen. Maximaal 1 uitroepteken per sectie.
- Geen generieke zinnen. Altijd concreet en specifiek.
- GEEN gevaarlijke, angstaanjagende of ongepaste inhoud.

SPANNINGSREGELS: Elke 20-40 seconden leestijd moet er iets gebeuren: nieuwe vraag, wow-feit, verrassende wending.

${imagePromptRules}`,
      user: (config, sectionsCount, quizCount, activitiesCount) => `Maak een spannende kennisdocumentaire voor kinderen over: "${config.topic}".

Doelgroep: ${config.ageGroup} jaar | Diepte: ${config.depth} | Perspectief: ${config.perspective ?? "science"} | Toon: ${config.tone ?? "curious"} | Lengte: ${sectionsCount} hoofdstukken

VERPLICHTE DRAMATURGIE:
1. TITEL: Die onmiddellijk nieuwsgierig maakt (niet "Alles over..." maar "Waarom...", "Het geheim van...")
2. HOOK: 2-5 zinnen die een mysterie of verbijsterend feit openen
3. HOOFDVRAAG: De grote leidende vraag van de documentaire
4. HOOFDSTUKKEN: Elk met mini-vraag, duidelijke uitleg, 1 wow-feit, 1 visuele vergelijking, overgang naar het volgende
5. TWIST: Verrassingsmoment in het midden of laatste derde
6. FINALE: Sterk slotbeeld, geen einde dat uitdooft

Quiz: ${config.includeInteractive ? quizCount : 0} vragen (mix herinnering/begrip/transfer)
Activiteiten: ${config.includeInteractive ? activitiesCount : 0}

Reageer UITSLUITEND in JSON:

{
  "title": "Spannende titel (max 10 woorden)",
  "summary": "1-3 zinnen die zin geven om te lezen",
  "hook": "2-5 meeslepende openingszinnen",
  "mainQuestion": "De grote leidende vraag",
  "sections": [
    ${sectionSchema}
  ],
  "wowFacts": ["Verbijsterend feit 1", "Feit 2", "Feit 3"],
  "comparisons": ["Visuele vergelijking 1", "Vergelijking 2"],
  "twist": "Het verrassingsmoment",
  "finale": "Het sterke slotbeeld",
  "activity": "Een creatief meedoe-idee",
  "coverImagePrompt": "English: Kid-friendly watercolor cover illustration showing [main topic visual]. Axel Scheffler style, bright warm colors, educational, joyful, no text."
}`
    },
    ru: {
      system: `Вы первоклассный автор и драматург захватывающих, адаптированных для детей познавательных документальных фильмов.

Ваша миссия: создать детский документальный фильм, который ощущается как мощная, современная научная передача - не как урок.
Он должен быть: чрезвычайно любопытным, легким для понимания, эмоционально теплым, полным моментов "ага", захватывающим от начала до конца, фактически правильным, никогда сухим или академичным.

ПРАВИЛА СТИЛЯ:
- НЕ пишите как энциклопедия или учебник.
- Пишите образно, любознательно, ясно и живо.
- Используйте сильные сравнения из повседневного мира детей. Создавайте мысленное кино.
- Варьируйте начала предложений. Максимум 1 восклицательный знак на раздел.
- Никаких общих фраз. Всегда конкретно и специфично.
- НИКАКОГО опасного, пугающего или неподходящего контента.

ПРАВИЛА НАПРЯЖЕНИЯ: Каждые 20-40 секунд чтения должно что-то происходить: новый вопрос, wow-факт, неожиданный поворот.

${imagePromptRules}`,
      user: (config, sectionsCount, quizCount, activitiesCount) => `Создайте захватывающий познавательный документальный фильм для детей на тему: "${config.topic}".

Целевая аудитория: ${config.ageGroup} лет | Глубина: ${config.depth} | Перспектива: ${config.perspective ?? "science"} | Тон: ${config.tone ?? "curious"} | Длина: ${sectionsCount} глав

ОБЯЗАТЕЛЬНАЯ ДРАМАТУРГИЯ:
1. ЗАГОЛОВОК: Мгновенно пробуждающий любопытство (не "Всё о..." а "Почему...", "Тайна...")
2. КРЮЧОК: 2-5 предложений, открывающих загадку или поразительный факт
3. ГЛАВНЫЙ ВОПРОС: Большой направляющий вопрос документального фильма
4. ГЛАВЫ: Каждая с мини-вопросом, ясным объяснением, 1 wow-фактом, 1 визуальным сравнением, переходом к следующей
5. ПОВОРОТ: Момент сюрприза в середине или последней трети
6. ФИНАЛ: Сильный завершающий образ, не угасающий конец

Викторина: ${config.includeInteractive ? quizCount : 0} вопросов (микс запоминание/понимание/перенос)
Активности: ${config.includeInteractive ? activitiesCount : 0}

Отвечайте ИСКЛЮЧИТЕЛЬНО в JSON:

{
  "title": "Захватывающий заголовок (макс 10 слов)",
  "summary": "1-3 предложения, пробуждающие желание читать",
  "hook": "2-5 захватывающих вступительных предложений",
  "mainQuestion": "Большой направляющий вопрос",
  "sections": [
    ${sectionSchema}
  ],
  "wowFacts": ["Поразительный факт 1", "Факт 2", "Факт 3"],
  "comparisons": ["Визуальное сравнение 1", "Сравнение 2"],
  "twist": "Момент сюрприза",
  "finale": "Сильный завершающий образ",
  "activity": "Творческая идея для участия",
  "coverImagePrompt": "English: Kid-friendly watercolor cover illustration showing [main topic visual]. Axel Scheffler style, bright warm colors, educational, joyful, no text."
}`
    },
  };

  return prompts[language];
}

// Infer a knowledge subcategory ID from topic/perspective
function inferKnowledgeSubcategory(topic: string, perspective?: string): string {
  const t = `${topic} ${perspective ?? ""}`.toLowerCase();
  const map: Array<{ keywords: string[]; id: string }> = [
    { keywords: ["bio", "tier", "pflanz", "zoo", "mensch", "körper"], id: "knowledge.biology" },
    { keywords: ["geschichte", "histor", "antike", "mittelalter", "krieg"], id: "knowledge.history" },
    { keywords: ["physik", "kraft", "energie", "bewegung", "elektr", "licht"], id: "knowledge.physics" },
    { keywords: ["erde", "karte", "kontinent", "geografie", "ocean", "meer"], id: "knowledge.geography" },
    { keywords: ["stern", "planet", "weltall", "galax", "kosmos", "astronom"], id: "knowledge.astronomy" },
    { keywords: ["mathe", "zahl", "rechnen", "geometr", "bruch"], id: "knowledge.mathematics" },
    { keywords: ["chemie", "stoff", "reaktion", "element", "molekül"], id: "knowledge.chemistry" },
  ];

  for (const entry of map) {
    if (entry.keywords.some(k => t.includes(k))) return entry.id;
  }
  // Default to general knowledge
  return "knowledge.history";
}
