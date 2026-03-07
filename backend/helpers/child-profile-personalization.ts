import type { ChildProfile } from "./profiles";

export type ChildAgeGroup = "3-5" | "6-8" | "9-12" | "13+";

function limitKeywords(values: string[], max = 5): string[] {
  return values
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .slice(0, max);
}

export function ageToAgeGroup(age?: number | null): ChildAgeGroup | undefined {
  if (!Number.isFinite(age)) {
    return undefined;
  }

  if ((age as number) <= 5) return "3-5";
  if ((age as number) <= 8) return "6-8";
  if ((age as number) <= 12) return "9-12";
  return "13+";
}

export function buildStoryProfilePrompt(profile: ChildProfile): string | undefined {
  const lines: string[] = [];
  const interests = limitKeywords(profile.interests);
  const learningGoals = limitKeywords(profile.learningGoals);
  const noGoTopics = limitKeywords(profile.noGoTopics);
  const preferredAvatarIds = limitKeywords(profile.preferredAvatarIds, 3);
  const inferredAgeGroup = ageToAgeGroup(profile.age);

  lines.push("CHILD PROFILE CONTEXT:");
  lines.push(`- Main child profile: ${profile.name}.`);

  if (profile.age) {
    lines.push(
      `- Personalize the language, pacing and emotional stakes for a child around ${profile.age} years old${inferredAgeGroup ? ` (${inferredAgeGroup})` : ""}.`
    );
  }

  if (profile.readingLevel) {
    lines.push(`- Respect the reading level hint: ${profile.readingLevel}.`);
  }

  if (interests.length > 0) {
    lines.push(`- Weave in familiar interests when natural: ${interests.join(", ")}.`);
  }

  if (learningGoals.length > 0) {
    lines.push(`- Gently reinforce these learning goals: ${learningGoals.join(", ")}.`);
  }

  if (noGoTopics.length > 0) {
    lines.push(`- Avoid these topics or turn them away immediately: ${noGoTopics.join(", ")}.`);
  }

  if (profile.childAvatarId) {
    lines.push("- If the child's own avatar appears, treat it as the main child reference.");
  }

  if (preferredAvatarIds.length > 0) {
    lines.push("- Preferred supporting avatars are already curated for this child profile.");
  }

  return lines.length > 1 ? lines.join("\n") : undefined;
}

export function buildDokuProfilePrompt(profile: ChildProfile): string | undefined {
  const lines: string[] = [];
  const interests = limitKeywords(profile.interests);
  const learningGoals = limitKeywords(profile.learningGoals);
  const noGoTopics = limitKeywords(profile.noGoTopics);
  const inferredAgeGroup = ageToAgeGroup(profile.age);

  lines.push("CHILD PROFILE CONTEXT:");
  lines.push(`- Explain the topic for ${profile.name}.`);

  if (profile.age) {
    lines.push(
      `- Match the explanations to a child around ${profile.age} years old${inferredAgeGroup ? ` (${inferredAgeGroup})` : ""}.`
    );
  }

  if (profile.readingLevel) {
    lines.push(`- Keep the vocabulary aligned with reading level ${profile.readingLevel}.`);
  }

  if (interests.length > 0) {
    lines.push(`- Use examples that connect to these interests when helpful: ${interests.join(", ")}.`);
  }

  if (learningGoals.length > 0) {
    lines.push(`- Emphasize these learning goals if they fit the topic: ${learningGoals.join(", ")}.`);
  }

  if (noGoTopics.length > 0) {
    lines.push(`- Avoid these themes completely: ${noGoTopics.join(", ")}.`);
  }

  return lines.length > 1 ? lines.join("\n") : undefined;
}

export function buildTaviProfilePrompt(profile: ChildProfile): string | undefined {
  const interests = limitKeywords(profile.interests, 4);
  const learningGoals = limitKeywords(profile.learningGoals, 4);
  const lines: string[] = [];

  lines.push(`Active child profile: ${profile.name}.`);

  if (profile.age) {
    lines.push(`The child is about ${profile.age} years old.`);
  }

  if (interests.length > 0) {
    lines.push(`Known interests: ${interests.join(", ")}.`);
  }

  if (learningGoals.length > 0) {
    lines.push(`Important learning goals: ${learningGoals.join(", ")}.`);
  }

  if (profile.childAvatarId) {
    lines.push("There is a dedicated child avatar for this profile.");
  }

  return lines.length > 0 ? lines.join(" ") : undefined;
}
