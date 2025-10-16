import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { getAuthData } from "~encore/auth";
import { logTopic } from "../log/logger";
import { publishWithTimeout } from "../helpers/pubsubTimeout";

const openAIKey = secret("OpenAIKey");

interface TaviChatRequest {
  message: string;
}

interface TaviChatResponse {
  response: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
}

const TAVI_SYSTEM_PROMPT = `Du bist Tavi, das magische Geschichten-Genie der Talea Storytelling Platform! 🧞‍♂️✨

Persönlichkeit:
- Freundlich, hilfsbereit und voller magischer Energie
- Sprichst auf Deutsch mit einer lebendigen, einladenden Art
- Liebst Geschichten, Kreativität und das Helfen von Familien
- Verwendest gerne Emojis und magische Metaphern
- Bist ein Experte für Storytelling, Avatare und kreative Inhalte

Aufgaben:
- Hilf Benutzern bei Fragen zur Talea-Plattform
- Gib Tipps für bessere Geschichten und Avatare
- Erkläre Features und Funktionen
- Inspiriere zu kreativen Ideen
- Beantworte allgemeine Fragen mit magischer Note

Regeln:
- Halte Antworten unter 500 Wörtern
- Sei immer positiv und ermutigend
- Verwende "du" statt "Sie"
- Beziehe dich auf deine magische Natur als Geschichten-Genie
- Falls du etwas nicht weißt, sage es ehrlich aber bleibe hilfreich

Antworte immer auf Deutsch und mit viel Begeisterung für Geschichten und Kreativität! 🌟`;

export const taviChat = api<TaviChatRequest, TaviChatResponse>(
  { expose: true, method: "POST", path: "/tavi/chat", auth: true },
  async ({ message }) => {
    const auth = getAuthData()!;

    // Validate message length (50 words max)
    const wordCount = message.trim().split(/\s+/).length;
    if (wordCount > 50) {
      throw new Error("Nachricht zu lang! Bitte halte deine Frage unter 50 Wörtern. ✨");
    }

    if (!message.trim()) {
      throw new Error("Bitte stelle eine Frage! Ich bin hier, um dir zu helfen. 🧞‍♂️");
    }

    try {
      console.log(`🧞‍♂️ Tavi processing message from user ${auth.userID}:`, message);
      
      const payload = {
        model: "gpt-5-nano",
        messages: [
          { role: "system", content: TAVI_SYSTEM_PROMPT },
          { role: "user", content: message },
        ],
        max_completion_tokens: 2000, // Increased to handle longer responses
      };

      console.log("📤 Sending request to OpenAI with payload:", {
        model: payload.model,
        messageCount: payload.messages.length,
        maxTokens: payload.max_completion_tokens,
        userMessageLength: message.length
      });

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openAIKey()}`,
        },
        body: JSON.stringify(payload),
      });

      console.log(`📥 OpenAI response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Tavi OpenAI error ${response.status}:`, errorText);
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log("✅ OpenAI response received:", {
        choicesCount: data.choices?.length || 0,
        tokensUsed: data.usage,
        finishReason: data.choices?.[0]?.finish_reason
      });

      // Log the Tavi chat interaction
      console.log(`🔥 TAVI: About to publish log to logTopic...`);
      await publishWithTimeout(logTopic, {
        source: "openai-tavi-chat",
        timestamp: new Date(),
        request: payload,
        response: data,
        metadata: {
          userId: auth.userID,
          messageLength: message.length,
          wordCount: message.trim().split(/\s+/).length
        }
      });
      console.log(`✅ TAVI: Log published successfully to logTopic!`);

      // Check for incomplete responses
      const finishReason = data.choices?.[0]?.finish_reason;
      if (finishReason === 'length') {
        console.warn("⚠️ Response was cut off due to token limit!");
      }
      
      const responseText = data.choices?.[0]?.message?.content || 
        "Entschuldige, meine magischen Kräfte sind momentan erschöpft! 🌟 Versuche es gleich nochmal.";

      const tokensUsed = {
        prompt: data.usage?.prompt_tokens || 0,
        completion: data.usage?.completion_tokens || 0,
        total: data.usage?.total_tokens || 0,
      };

      console.log(`🎉 Tavi chat success - User: ${auth.userID}, Tokens: ${tokensUsed.total}, Response length: ${responseText.length} chars`);
      
      // Warn if response might be too long
      if (responseText.length > 500) {
        console.warn(`⚠️ Tavi response is quite long: ${responseText.length} characters`);
      }

      return {
        response: responseText,
        tokensUsed,
      };

    } catch (error) {
      console.error("❌ Tavi chat error occurred:", {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        userId: auth.userID,
        messageLength: message.length,
        timestamp: new Date().toISOString()
      });
      
      // More specific error handling
      if (error instanceof Error) {
        // Rate limiting
        if (error.message.includes('rate limit') || error.message.includes('429')) {
          console.warn("🚦 Rate limit hit for Tavi chat");
          return {
            response: "Ups! Zu viele magische Anfragen auf einmal! 🌪️ Warte einen Moment und versuche es dann nochmal.",
            tokensUsed: { prompt: 0, completion: 0, total: 0 }
          };
        }
        
        // API quota exceeded
        if (error.message.includes('quota') || error.message.includes('insufficient')) {
          console.error("💳 API quota/billing issue");
          return {
            response: "Meine magischen Ressourcen sind aufgebraucht! 💫 Der Administrator muss sie wieder auffüllen.",
            tokensUsed: { prompt: 0, completion: 0, total: 0 }
          };
        }
        
        // Token limit issues
        if (error.message.includes('token') || error.message.includes('length')) {
          console.warn("📏 Token limit related issue");
          return {
            response: "Deine Frage ist zu komplex für meine magischen Kräfte! ✨ Versuche eine kürzere, einfachere Frage.",
            tokensUsed: { prompt: 0, completion: 0, total: 0 }
          };
        }
        
        // Model issues
        if (error.message.includes('model') || error.message.includes('gpt')) {
          console.error("🤖 Model-related issue:", error.message);
          return {
            response: "Mein magisches Gehirn hat einen Aussetzer! 🧠✨ Versuche es in einem Moment nochmal.",
            tokensUsed: { prompt: 0, completion: 0, total: 0 }
          };
        }
      }

      // Generic fallback
      console.error("🔥 Unexpected Tavi error - falling back to generic response");
      return {
        response: "Entschuldige, meine magischen Verbindungen sind gestört! ⚡ Versuche es in einem Moment nochmal.",
        tokensUsed: { prompt: 0, completion: 0, total: 0 }
      };
    }
  }
);