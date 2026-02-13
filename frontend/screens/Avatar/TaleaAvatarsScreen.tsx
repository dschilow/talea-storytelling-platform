import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Edit, Eye, Plus, Search, Share2, Sparkles, Trash2, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { SignedIn, SignedOut, useUser } from "@clerk/clerk-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useBackend } from "../../hooks/useBackend";
import type { Avatar } from "../../types/avatar";
import { cn } from "@/lib/utils";
import taleaLogo from "@/img/talea_logo.png";
import { useTheme } from "@/contexts/ThemeContext";

type Palette = {
  pageGradient: string;
  haloA: string;
  haloB: string;
  panel: string;
  card: string;
  cardHover: string;
  border: string;
  text: string;
  textMuted: string;
  soft: string;
  badge: string;
  action: string;
  actionText: string;
};

const headingFont = '"Cormorant Garamond", serif';

function getPalette(isDark: boolean): Palette {
  if (isDark) {
    return {
      pageGradient:
        "radial-gradient(960px 540px at 100% 0%, rgba(103,88,138,0.24) 0%, transparent 58%), radial-gradient(920px 520px at 0% 18%, rgba(89,128,122,0.22) 0%, transparent 60%), linear-gradient(180deg, #121a26 0%, #0f1722 100%)",
      haloA: "radial-gradient(circle, rgba(132,170,163,0.35) 0%, transparent 70%)",
      haloB: "radial-gradient(circle, rgba(142,119,176,0.32) 0%, transparent 70%)",
      panel: "rgba(24,34,47,0.9)",
      card: "rgba(27,38,53,0.9)",
      cardHover: "rgba(33,45,63,0.95)",
      border: "#32455d",
      text: "#e6eef9",
      textMuted: "#9db0c8",
      soft: "rgba(146,171,200,0.12)",
      badge: "rgba(138,162,192,0.22)",
      action: "linear-gradient(135deg,#95accf 0%,#b491ca 42%,#77a89b 100%)",
      actionText: "#0f1827",
    };
  }

  return {
    pageGradient:
      "radial-gradient(920px 520px at 100% 0%, #f2dfdc 0%, transparent 57%), radial-gradient(980px 560px at 0% 16%, #dae8de 0%, transparent 62%), linear-gradient(180deg,#f8f1e8 0%, #f6efe4 100%)",
    haloA: "radial-gradient(circle, rgba(132,170,163,0.38) 0%, transparent 70%)",
    haloB: "radial-gradient(circle, rgba(151,126,187,0.3) 0%, transparent 70%)",
    panel: "rgba(255,250,243,0.92)",
    card: "rgba(255,250,243,0.9)",
    cardHover: "rgba(255,254,249,0.98)",
    border: "#dfcfbb",
    text: "#1b2838",
    textMuted: "#5f7186",
    soft: "rgba(232,220,205,0.65)",
    badge: "rgba(206,194,177,0.48)",
    action: "linear-gradient(135deg,#f2d9d6 0%,#e8d8e9 42%,#d5e3cf 100%)",
    actionText: "#2b394a",
  };
}

const AvatarsBackground: React.FC<{ palette: Palette }> = ({ palette }) => (
  <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
    <div className="absolute inset-0" style={{ background: palette.pageGradient }} />
    <div className="absolute -left-20 top-16 h-72 w-72 rounded-full" style={{ background: palette.haloA, filter: "blur(36px)" }} />
    <div className="absolute -right-16 bottom-10 h-80 w-80 rounded-full" style={{ background: palette.haloB, filter: "blur(40px)" }} />
  </div>
);

const LoadingSkeleton: React.FC<{ palette: Palette }> = ({ palette }) => (
  <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
    {Array.from({ length: 8 }).map((_, i) => (
      <div
        key={i}
        className="overflow-hidden rounded-3xl border animate-pulse"
        style={{ borderColor: palette.border, background: palette.soft }}
      >
        <div className="aspect-[3/4]" />
      </div>
    ))}
  </div>
);

const EmptyAvatars: React.FC<{ onCreate: () => void; palette: Palette; title: string; description: string; cta: string }> = ({
  onCreate,
  palette,
  title,
  description,
  cta,
}) => (
  <div className="rounded-3xl border p-10 text-center" style={{ borderColor: palette.border, background: palette.panel }}>
    <div className="mx-auto mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: palette.soft }}>
      <Sparkles className="h-8 w-8" style={{ color: palette.textMuted }} />
    </div>
    <h2 className="text-3xl" style={{ color: palette.text, fontFamily: headingFont }}>
      {title}
    </h2>
    <p className="mx-auto mt-2 max-w-xl text-sm" style={{ color: palette.textMuted }}>
      {description}
    </p>
    <button
      type="button"
      onClick={onCreate}
      className="mt-6 inline-flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold shadow-[0_10px_22px_rgba(51,62,79,0.16)]"
      style={{ borderColor: palette.border, background: palette.action, color: palette.actionText }}
    >
      <Plus className="h-4 w-4" />
      {cta}
    </button>
  </div>
);

const AvatarCard: React.FC<{
  avatar: Avatar;
  index: number;
  palette: Palette;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ avatar, index, palette, onView, onEdit, onDelete }) => {
  const canManage = avatar.isOwnedByCurrentUser ?? true;

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, delay: index * 0.03 }}
      whileHover={{ y: -5 }}
      className="group"
    >
      <button
        type="button"
        onClick={onView}
        className="w-full overflow-hidden rounded-3xl border text-left shadow-[0_12px_28px_rgba(33,44,62,0.12)] transition-colors"
        style={{ borderColor: palette.border, background: palette.card }}
      >
        <div className="relative aspect-[3/4] overflow-hidden" style={{ background: palette.soft }}>
          {avatar.imageUrl ? (
            <img src={avatar.imageUrl} alt={avatar.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <User className="h-20 w-20" style={{ color: palette.textMuted }} />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />

          <span
            className="absolute left-3 top-3 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{ borderColor: palette.border, background: palette.badge, color: palette.text }}
          >
            {avatar.creationType === "photo-upload" ? "Foto" : "AI"}
          </span>

          {!canManage ? (
            <span
              className="absolute left-3 top-10 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{ borderColor: palette.border, background: palette.badge, color: palette.text }}
            >
              <Share2 className="h-3 w-3" />
              Geteilt
            </span>
          ) : null}

          {canManage ? (
            <div className="absolute right-3 top-3 flex flex-col gap-2 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit();
                }}
                className="rounded-xl border p-2"
                style={{ borderColor: palette.border, background: palette.panel, color: palette.text }}
                aria-label={`${avatar.name} bearbeiten`}
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete();
                }}
                className="rounded-xl border p-2 text-[#b35b5b]"
                style={{ borderColor: "#d8a3a3", background: palette.panel }}
                aria-label={`${avatar.name} loeschen`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-xl border px-2.5 py-2" style={{ borderColor: "rgba(255,255,255,0.38)", background: "rgba(10,16,24,0.34)" }}>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{avatar.name}</p>
              <p className="truncate text-xs text-white/70">
                {(!canManage && avatar.sharedBy?.name) || (!canManage && avatar.sharedBy?.email)
                  ? `Geteilt von ${avatar.sharedBy?.name || avatar.sharedBy?.email}`
                  : avatar.description || "Avatar ohne Beschreibung"}
              </p>
            </div>
            <Eye className="ml-2 h-4 w-4 text-white/85" />
          </div>
        </div>
      </button>
    </motion.article>
  );
};

const TaleaAvatarsScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const backend = useBackend();
  const { user } = useUser();
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme === "dark";
  const palette = useMemo(() => getPalette(isDark), [isDark]);

  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    void loadAvatars();
  }, [user]);

  useEffect(() => {
    if (location.state?.refresh) {
      void loadAvatars();
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const loadAvatars = async () => {
    try {
      setIsLoading(true);
      const response = await backend.avatar.list();
      setAvatars((response as any)?.avatars || []);
    } catch (error) {
      console.error("Failed to load avatars:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAvatar = async (avatar: Avatar) => {
    if (avatar.isOwnedByCurrentUser === false) {
      toast.error("Geteilte Avatare koennen nicht geloescht werden.");
      return;
    }

    if (!window.confirm(t("common.confirm", "Wirklich loeschen?"))) return;

    try {
      await backend.avatar.deleteAvatar({ id: avatar.id });
      setAvatars((prev) => prev.filter((item) => item.id !== avatar.id));
    } catch (error) {
      console.error("Failed to delete avatar:", error);
    }
  };

  const filteredAvatars = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return avatars;
    return avatars.filter((avatar) => avatar.name.toLowerCase().includes(query));
  }, [avatars, searchQuery]);
  const ownedCount = avatars.filter((avatar) => avatar.isOwnedByCurrentUser !== false).length;
  const sharedCount = avatars.length - ownedCount;

  return (
    <div className="relative min-h-screen pb-28" style={{ color: palette.text }}>
      <AvatarsBackground palette={palette} />

      <SignedOut>
        <div className="flex min-h-[68vh] items-center justify-center px-5">
          <div className="w-full max-w-2xl rounded-3xl border p-8 text-center" style={{ borderColor: palette.border, background: palette.panel }}>
            <div className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: palette.soft }}>
              <User className="h-7 w-7" style={{ color: palette.textMuted }} />
            </div>
            <h2 className="text-3xl" style={{ color: palette.text, fontFamily: headingFont }}>
              {t("errors.unauthorized", "Bitte melde dich an")}
            </h2>
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="mt-5 rounded-2xl border px-5 py-3 text-sm font-semibold"
              style={{ borderColor: palette.border, background: palette.action, color: palette.actionText }}
            >
              {t("auth.signIn", "Anmelden")}
            </button>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="relative z-10 space-y-6 pt-5">
          <header className="rounded-3xl border p-5 shadow-[0_18px_34px_rgba(33,44,62,0.12)] md:p-6" style={{ borderColor: palette.border, background: palette.panel }}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <img src={taleaLogo} alt="Talea" className="h-10 w-10 rounded-xl object-cover" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: palette.textMuted }}>
                    Character Studio
                  </p>
                  <h1 className="text-4xl leading-none" style={{ color: palette.text, fontFamily: headingFont }}>
                    Avatare
                  </h1>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate("/avatar/create")}
                className="inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold shadow-[0_10px_22px_rgba(51,62,79,0.16)]"
                style={{ borderColor: palette.border, background: palette.action, color: palette.actionText }}
              >
                <Plus className="h-4 w-4" />
                {t("avatar.create", "Neuer Avatar")}
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto] md:items-center">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: palette.textMuted }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Avatare durchsuchen..."
                  className="h-11 w-full rounded-2xl border py-2 pl-10 pr-3 text-sm outline-none"
                  style={{
                    borderColor: palette.border,
                    background: palette.card,
                    color: palette.text,
                  }}
                />
              </label>

              <div className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: palette.border, background: palette.card, color: palette.textMuted }}>
                {avatars.length} gesamt
              </div>
              <div className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: palette.border, background: palette.card, color: palette.textMuted }}>
                {filteredAvatars.length} sichtbar
              </div>
              <div className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: palette.border, background: palette.card, color: palette.textMuted }}>
                {sharedCount} geteilt
              </div>
              <div className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: palette.border, background: palette.card, color: palette.textMuted }}>
                {ownedCount} eigene
              </div>
            </div>
          </header>

          {isLoading ? (
            <LoadingSkeleton palette={palette} />
          ) : filteredAvatars.length === 0 && avatars.length === 0 ? (
            <EmptyAvatars
              onCreate={() => navigate("/avatar/create")}
              palette={palette}
              title={t("homePage.emptyAvatarsTitle", "Noch keine Avatare")}
              description={t("homePage.emptyAvatarsDesc", "Erstelle deinen ersten Avatar fuer Geschichten und Dokus.")}
              cta={t("avatar.createNew", "Ersten Avatar erstellen")}
            />
          ) : filteredAvatars.length === 0 ? (
            <div className="rounded-3xl border p-10 text-center" style={{ borderColor: palette.border, background: palette.panel }}>
              <h2 className="text-3xl" style={{ color: palette.text, fontFamily: headingFont }}>
                Keine Treffer
              </h2>
              <p className="mt-2 text-sm" style={{ color: palette.textMuted }}>
                Kein Avatar passt zu "{searchQuery}".
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {filteredAvatars.map((avatar, index) => (
                <AvatarCard
                  key={avatar.id}
                  avatar={avatar}
                  index={index}
                  palette={palette}
                  onView={() => navigate(`/avatar/${avatar.id}`)}
                  onEdit={() => navigate(`/avatar/edit/${avatar.id}`)}
                  onDelete={() => void handleDeleteAvatar(avatar)}
                />
              ))}
            </div>
          )}
        </div>
      </SignedIn>
    </div>
  );
};

export default TaleaAvatarsScreen;
