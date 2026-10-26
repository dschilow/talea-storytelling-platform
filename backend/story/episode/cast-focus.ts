import type { StoryBrief } from "../storybook/context";

/** The shortlist is fit-ranked. Only an explicit companion choice allows a pool lead. */
export function episodePoolLead(brief: StoryBrief) {
  return brief.config.avatarIsHero === false ? brief.candidates.find(candidate => candidate.canLead === true) : undefined;
}

export function episodeCastFocus(brief: StoryBrief): string[] {
  const lead = episodePoolLead(brief);
  if (!lead) return ["CAST FOCUS: the family's avatars are the main characters. Their own goal and decisions drive the story; pool figures contribute in supporting roles."];
  return [
    `CAST FOCUS: ${lead.name} [${lead.id}] is this story's leading figure and must be cast. Its own concrete wish starts the trouble; its decisions change what happens. Keep its established nature.`,
    ...(lead.want ? [
      `THE STORY ENGINE IS THIS FIGURE'S SUPPLIED WANT: „${lead.want}“. Turn it into today's concrete objective and let its attempts to get that objective cause the complications.`,
      "Today's child-situation choices may complicate that objective; they do not replace it with an unrelated lesson or attachment to a new prop. The other figures have their own interests and can resist or help.",
    ] : []),
    "The family's avatars are active companions, each with an indispensable idea or deed. The leading figure must make a consequential choice too; it is more than someone waiting to be rescued. The finale uses both their contributions. A supporting figure need not be promoted or reformed.",
    "In the method's hero and child-situation rules, a hero can be this leading figure: an age-appropriate wish a child understands. The focusHero id still chooses an avatar as viewpoint. The cast header may record the leading pool figure as companion; that label does not decide its narrative prominence.",
  ];
}
