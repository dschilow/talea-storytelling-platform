import { generateWithGemini } from "./backend/story/gemini-generation";

async function test() {
  try {
    const res = await generateWithGemini({
      systemPrompt: "You are a helpful assistant.",
      userPrompt: "Say hello.",
      maxTokens: 100,
    });
    console.log(res);
  } catch (e) {
    console.error(e);
  }
}

test();
