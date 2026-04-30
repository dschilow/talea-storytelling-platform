export type StudioPalette = {
  pageBg: string;
  heroOverlay: string;
  card: string;
  cardElevated: string;
  cardHover: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textDim: string;
  input: string;
  badge: string;
  badgeText: string;
  primary: string;
  primaryText: string;
  primaryBorder: string;
  accent: string;
  accentSoft: string;
  success: string;
  successText: string;
};

export const headingFont = '"Cormorant Garamond", "Times New Roman", serif';

export function buildStudioPalette(isDark: boolean): StudioPalette {
  if (isDark) {
    return {
      pageBg:
        "radial-gradient(1200px 600px at 8% -10%, rgba(106,84,168,0.25) 0%, transparent 60%), radial-gradient(900px 500px at 100% 10%, rgba(80,140,150,0.22) 0%, transparent 65%), linear-gradient(180deg,#0d1320 0%,#0a111c 100%)",
      heroOverlay:
        "linear-gradient(180deg, rgba(8,12,20,0.05) 0%, rgba(8,12,20,0.55) 55%, rgba(8,12,20,0.92) 100%)",
      card: "border-[#2a3a55] bg-[#141d2c]",
      cardElevated: "border-[#314563] bg-[#1a2436]",
      cardHover: "hover:border-[#4a6896] hover:bg-[#1c2740]",
      border: "border-[#2a3a55]",
      borderStrong: "border-[#445d83]",
      text: "text-[#e8eef9]",
      textMuted: "text-[#9aacc6]",
      textDim: "text-[#6c7e98]",
      input: "border-[#3a4f6c] bg-[#0f1826] text-[#e8eef9] placeholder:text-[#6c7e98]",
      badge: "bg-[#1f2c42] border-[#3a4f6c]",
      badgeText: "text-[#c5d3e6]",
      primary:
        "bg-[linear-gradient(135deg,#a78bd6_0%,#7d9ad2_50%,#6cae9d_100%)] hover:brightness-110",
      primaryText: "text-[#0d1320]",
      primaryBorder: "border-[#a78bd6]",
      accent: "text-[#b39bdc]",
      accentSoft: "bg-[#2a2240] text-[#c8b8e8]",
      success: "bg-[#1e3a2c] border-[#3d6f54]",
      successText: "text-[#a4d5b8]",
    };
  }
  return {
    pageBg:
      "radial-gradient(1200px 600px at 8% -10%, #f3e3df 0%, transparent 60%), radial-gradient(900px 500px at 100% 10%, #dce9e0 0%, transparent 65%), linear-gradient(180deg,#fbf5ec 0%,#f7f0e3 100%)",
    heroOverlay:
      "linear-gradient(180deg, rgba(20,28,42,0.0) 0%, rgba(20,28,42,0.45) 60%, rgba(20,28,42,0.85) 100%)",
    card: "border-[#e2d2bc] bg-[#fffaf0]",
    cardElevated: "border-[#dcc9ad] bg-[#fff5e2]",
    cardHover: "hover:border-[#c2a17f] hover:bg-[#fffefa]",
    border: "border-[#e2d2bc]",
    borderStrong: "border-[#c2a17f]",
    text: "text-[#1d2838]",
    textMuted: "text-[#5d6e85]",
    textDim: "text-[#8a96a8]",
    input: "border-[#dec8ab] bg-white text-[#1d2838] placeholder:text-[#8a96a8]",
    badge: "bg-[#f3eadc] border-[#dec8ab]",
    badgeText: "text-[#3a4659]",
    primary:
      "bg-[linear-gradient(135deg,#f3d5d1_0%,#e9d8e9_50%,#d6e3cf_100%)] hover:brightness-105",
    primaryText: "text-[#2c394a]",
    primaryBorder: "border-[#c2a17f]",
    accent: "text-[#7a5fb3]",
    accentSoft: "bg-[#efe6f7] text-[#5d3f93]",
    success: "bg-[#e6f2ea] border-[#79a58e]",
    successText: "text-[#2f5b46]",
  };
}

export const episodeStatusLabel: Record<string, string> = {
  draft: "Entwurf",
  text_ready: "Text bereit",
  text_approved: "Text akzeptiert",
  scenes_ready: "Szenen bereit",
  images_ready: "Bilder bereit",
  composed: "Composed",
  published: "Veröffentlicht",
};

export const episodeStatusTone: Record<string, "neutral" | "progress" | "ready" | "published"> = {
  draft: "neutral",
  text_ready: "progress",
  text_approved: "progress",
  scenes_ready: "progress",
  images_ready: "progress",
  composed: "ready",
  published: "published",
};

export function formatStudioDate(value: string | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
