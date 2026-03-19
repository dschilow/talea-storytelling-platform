export const QWEN_STATIC_SPEAKERS = [
  'aiden',
  'dylan',
  'eric',
  'ono_anna',
  'ryan',
  'serena',
  'sohee',
  'uncle_fu',
  'vivian',
] as const;

export const QWEN_STATIC_DEFAULT_SPEAKER = 'vivian';

export function getStaticQwenSpeakers(): string[] {
  return [...QWEN_STATIC_SPEAKERS];
}

export function getStaticQwenVoiceOptions(): Array<{ id: string; name: string }> {
  return getStaticQwenSpeakers().map((speaker) => ({
    id: speaker,
    name: speaker,
  }));
}
