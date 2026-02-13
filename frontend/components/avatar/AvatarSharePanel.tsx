import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Loader2, MailPlus, Search, ShieldCheck, UserPlus2, UsersRound } from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import { toast } from "sonner";

import { getBackendUrl } from "../../config";

type ShareContact = {
  id: string;
  email: string;
  label: string;
  trusted: boolean;
  targetUserId?: string;
  targetUserName?: string;
  targetUserEmail?: string;
  sharedAvatarCount: number;
  createdAt: string;
  updatedAt: string;
};

type ShareSuggestion = {
  email: string;
  label: string;
  targetUserId?: string;
  targetUserName?: string;
  existingContactId?: string;
  source: "trusted_contact" | "registered_user";
};

type AvatarShareEntry = {
  shareId: string;
  contactId: string;
  contactEmail: string;
  contactLabel: string;
  trusted: boolean;
  targetUserId?: string;
  targetUserName?: string;
  createdAt: string;
  updatedAt: string;
};

type AvatarSharePanelProps = {
  avatarId: string;
  avatarName: string;
  isDark: boolean;
  canManage: boolean;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AvatarSharePanel: React.FC<AvatarSharePanelProps> = ({ avatarId, avatarName, isDark, canManage }) => {
  const backendUrl = getBackendUrl();
  const { getToken } = useAuth();
  const reduceMotion = useReducedMotion();

  const [contacts, setContacts] = useState<ShareContact[]>([]);
  const [shares, setShares] = useState<AvatarShareEntry[]>([]);
  const [suggestions, setSuggestions] = useState<ShareSuggestion[]>([]);
  const [email, setEmail] = useState("");
  const [alias, setAlias] = useState("");
  const [trusted, setTrusted] = useState(true);
  const [loading, setLoading] = useState(true);
  const [savingContact, setSavingContact] = useState(false);
  const [sharingContactId, setSharingContactId] = useState<string | null>(null);
  const [removingContactId, setRemovingContactId] = useState<string | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const authedFetch = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const token = await getToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(init?.headers as Record<string, string> | undefined),
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${backendUrl}${path}`, {
        ...init,
        headers,
        credentials: "include",
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed with status ${response.status}`);
      }

      if (response.status === 204) {
        return {} as T;
      }

      return (await response.json()) as T;
    },
    [backendUrl, getToken]
  );

  const loadData = useCallback(async () => {
    if (!canManage) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [contactResponse, shareResponse] = await Promise.all([
        authedFetch<{ contacts: ShareContact[] }>("/avatar/share/contacts"),
        authedFetch<{ shares: AvatarShareEntry[] }>(`/avatar/${encodeURIComponent(avatarId)}/shares`),
      ]);

      setContacts(contactResponse.contacts || []);
      setShares(shareResponse.shares || []);
    } catch (error) {
      console.error("Failed to load share data:", error);
      toast.error("Freigaben konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, avatarId, canManage]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!canManage) {
      return;
    }

    const query = email.trim().toLowerCase();
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    const handle = window.setTimeout(async () => {
      try {
        setLoadingSuggestions(true);
        const response = await authedFetch<{ suggestions: ShareSuggestion[] }>(
          `/avatar/share/suggestions?q=${encodeURIComponent(query)}&limit=6`
        );
        setSuggestions(response.suggestions || []);
      } catch (error) {
        console.error("Failed to load suggestions:", error);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 220);

    return () => window.clearTimeout(handle);
  }, [authedFetch, canManage, email]);

  const sharedContactIds = useMemo(() => new Set(shares.map((entry) => entry.contactId)), [shares]);

  const saveContact = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedAlias = alias.trim();

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      toast.error("Bitte eine gueltige E-Mail eingeben.");
      return;
    }

    if (normalizedAlias.length < 2) {
      toast.error("Bitte gib einen Anzeigenamen ein.");
      return;
    }

    try {
      setSavingContact(true);
      const response = await authedFetch<{ contact: ShareContact }>("/avatar/share/contacts", {
        method: "POST",
        body: JSON.stringify({
          email: normalizedEmail,
          label: normalizedAlias,
          trusted,
        }),
      });

      setContacts((current) => {
        const next = [...current];
        const existingIndex = next.findIndex((entry) => entry.id === response.contact.id || entry.email === response.contact.email);
        if (existingIndex >= 0) {
          next[existingIndex] = response.contact;
        } else {
          next.unshift(response.contact);
        }
        return next.sort((a, b) => a.label.localeCompare(b.label, "de"));
      });

      setEmail("");
      setAlias("");
      setSuggestions([]);
      toast.success("Kontakt gespeichert.");
    } catch (error) {
      console.error("Failed to save contact:", error);
      toast.error("Kontakt konnte nicht gespeichert werden.");
    } finally {
      setSavingContact(false);
    }
  };

  const toggleShare = async (contact: ShareContact) => {
    const isShared = sharedContactIds.has(contact.id);

    try {
      setSharingContactId(contact.id);

      if (isShared) {
        await authedFetch<{ success: boolean }>(`/avatar/${encodeURIComponent(avatarId)}/share/${encodeURIComponent(contact.id)}`, {
          method: "DELETE",
        });
        setShares((current) => current.filter((entry) => entry.contactId !== contact.id));
        toast.success(`Freigabe an ${contact.label} entfernt.`);
      } else {
        const response = await authedFetch<{ share: AvatarShareEntry }>(`/avatar/${encodeURIComponent(avatarId)}/share`, {
          method: "POST",
          body: JSON.stringify({ contactId: contact.id }),
        });

        setShares((current) => {
          const next = current.filter((entry) => entry.contactId !== response.share.contactId);
          next.push(response.share);
          return next;
        });
        toast.success(`Avatar fuer ${contact.label} freigegeben.`);
      }
    } catch (error) {
      console.error("Failed to toggle share:", error);
      toast.error("Freigabe konnte nicht aktualisiert werden.");
    } finally {
      setSharingContactId(null);
    }
  };

  const removeContact = async (contact: ShareContact) => {
    const confirmed = window.confirm(
      `Kontakt "${contact.label}" wirklich entfernen? Alle Freigaben fuer ${contact.email} werden ebenfalls entfernt.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setRemovingContactId(contact.id);
      await authedFetch<{ success: boolean }>(`/avatar/share/contacts/${encodeURIComponent(contact.id)}`, {
        method: "DELETE",
      });

      setContacts((current) => current.filter((entry) => entry.id !== contact.id));
      setShares((current) => current.filter((entry) => entry.contactId !== contact.id));
      toast.success("Kontakt entfernt.");
    } catch (error) {
      console.error("Failed to remove contact:", error);
      toast.error("Kontakt konnte nicht entfernt werden.");
    } finally {
      setRemovingContactId(null);
    }
  };

  const suggestionStyles = {
    borderColor: isDark ? "#3a4f67" : "#d6c9b8",
    background: isDark ? "rgba(24,35,50,0.96)" : "rgba(255,252,247,0.96)",
    color: isDark ? "#d7e4f5" : "#32475f",
  };

  if (!canManage) {
    return null;
  }

  return (
    <section
      className="rounded-3xl border px-4 py-5"
      style={{
        borderColor: isDark ? "#33495f" : "#d6ccc2",
        background: isDark ? "rgba(21,32,47,0.88)" : "rgba(255,251,245,0.92)",
      }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="inline-flex items-center gap-2 text-xl font-semibold" style={{ color: isDark ? "#e7effb" : "#223347" }}>
            <UsersRound className="h-5 w-5" />
            Avatar teilen
          </h2>
          <p className="mt-1 text-sm" style={{ color: isDark ? "#9eb1ca" : "#697d95" }}>
            Teile "{avatarName}" mit vertrauten Kontakten, damit sie den Avatar in eigenen Geschichten nutzen koennen.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          className="rounded-full border px-3 py-1.5 text-xs font-semibold"
          style={{ borderColor: isDark ? "#415870" : "#d7c9b7", color: isDark ? "#c9d8ea" : "#60758f" }}
        >
          Aktualisieren
        </button>
      </div>

      <div
        className="relative rounded-2xl border p-3"
        style={{ borderColor: isDark ? "#3a4f67" : "#d6c9b8", background: isDark ? "rgba(26,38,54,0.78)" : "rgba(255,255,255,0.72)" }}
      >
        <div className="grid gap-2 sm:grid-cols-[1.3fr_1fr_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: isDark ? "#8da3bf" : "#7d90a8" }} />
            <input
              type="email"
              value={email}
              onChange={(event) => {
                const nextValue = event.target.value;
                setEmail(nextValue);
                if (!alias.trim()) {
                  const localPart = nextValue.split("@")[0]?.trim();
                  setAlias(localPart || "");
                }
              }}
              placeholder="E-Mail (z. B. darina@example.com)"
              className="h-11 w-full rounded-xl border py-2 pl-10 pr-3 text-sm outline-none"
              style={{ borderColor: isDark ? "#445c76" : "#d6cab9", background: isDark ? "rgba(19,28,41,0.9)" : "rgba(255,255,255,0.92)", color: isDark ? "#dbe7f6" : "#314760" }}
            />

            <AnimatePresence>
              {(suggestions.length > 0 || loadingSuggestions) && email.trim().length >= 2 ? (
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0, y: -6 }}
                  animate={reduceMotion ? false : { opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                  className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-xl border shadow-[0_14px_24px_rgba(16,24,37,0.22)]"
                  style={suggestionStyles}
                >
                  {loadingSuggestions ? (
                    <div className="flex items-center gap-2 px-3 py-2 text-xs">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Vorschlaege werden geladen...
                    </div>
                  ) : (
                    suggestions.map((suggestion) => (
                      <button
                        key={`${suggestion.source}-${suggestion.email}`}
                        type="button"
                        onClick={() => {
                          setEmail(suggestion.email);
                          setAlias((current) => current.trim() || suggestion.label || suggestion.email.split("@")[0] || "");
                          setSuggestions([]);
                        }}
                        className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-xs last:border-b-0"
                        style={{ borderColor: isDark ? "#34495f" : "#e4d8ca" }}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{suggestion.email}</span>
                          <span className="block truncate opacity-80">{suggestion.targetUserName || suggestion.label}</span>
                        </span>
                        <span className="ml-3 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em]" style={{ borderColor: isDark ? "#445d76" : "#d6cab9" }}>
                          {suggestion.source === "trusted_contact" ? "Kontakt" : "User"}
                        </span>
                      </button>
                    ))
                  )}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </label>

          <input
            type="text"
            value={alias}
            onChange={(event) => setAlias(event.target.value)}
            placeholder="Anzeigename (z. B. Darina Cousine)"
            className="h-11 rounded-xl border px-3 text-sm outline-none"
            style={{ borderColor: isDark ? "#445c76" : "#d6cab9", background: isDark ? "rgba(19,28,41,0.9)" : "rgba(255,255,255,0.92)", color: isDark ? "#dbe7f6" : "#314760" }}
          />

          <button
            type="button"
            onClick={() => void saveContact()}
            disabled={savingContact}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold"
            style={{
              borderColor: isDark ? "#445c76" : "#d6cab9",
              background: isDark ? "linear-gradient(135deg,#7c97be 0%,#8aa786 100%)" : "linear-gradient(135deg,#d7c2b5 0%,#d2deb9 100%)",
              color: isDark ? "#0f1a29" : "#2d3f53",
              opacity: savingContact ? 0.75 : 1,
            }}
          >
            {savingContact ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus2 className="h-4 w-4" />}
            Speichern
          </button>
        </div>

        <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-xs" style={{ color: isDark ? "#9eb2cb" : "#6f8198" }}>
          <input
            type="checkbox"
            checked={trusted}
            onChange={(event) => setTrusted(event.target.checked)}
            className="h-4 w-4"
          />
          Als vertrauten Kontakt markieren (bekannt/sicher)
        </label>
      </div>

      {loading ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`share-skeleton-${index}`}
              className="h-24 animate-pulse rounded-2xl border"
              style={{ borderColor: isDark ? "#34495f" : "#d6ccc2", background: isDark ? "rgba(28,42,60,0.7)" : "rgba(255,255,255,0.72)" }}
            />
          ))}
        </div>
      ) : contacts.length === 0 ? (
        <div
          className="mt-4 rounded-2xl border px-4 py-8 text-center"
          style={{ borderColor: isDark ? "#34495f" : "#d6ccc2", background: isDark ? "rgba(24,35,50,0.82)" : "rgba(255,251,245,0.9)" }}
        >
          <MailPlus className="mx-auto h-8 w-8" style={{ color: isDark ? "#a5b8d0" : "#6a7f98" }} />
          <p className="mt-2 text-sm" style={{ color: isDark ? "#a5b8d0" : "#6a7f98" }}>
            Noch keine gespeicherten Kontakte vorhanden.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <AnimatePresence>
            {contacts.map((contact, index) => {
              const isShared = sharedContactIds.has(contact.id);
              const isBusy = sharingContactId === contact.id || removingContactId === contact.id;

              return (
                <motion.article
                  key={contact.id}
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={reduceMotion ? false : { opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: 6 }}
                  transition={{ duration: reduceMotion ? 0 : 0.2, delay: reduceMotion ? 0 : index * 0.03 }}
                  className="rounded-2xl border p-3"
                  style={{ borderColor: isDark ? "#34495f" : "#d6ccc2", background: isDark ? "rgba(24,35,50,0.9)" : "rgba(255,255,255,0.86)" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold" style={{ color: isDark ? "#e8f0fb" : "#223347" }}>
                        {contact.label}
                      </p>
                      <p className="truncate text-xs" style={{ color: isDark ? "#9db2cc" : "#6c8098" }}>
                        {contact.email}
                      </p>
                      {contact.trusted ? (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]"
                          style={{ borderColor: isDark ? "#4d6f62" : "#b6d0bc", color: isDark ? "#a9d4bf" : "#4f8a62" }}>
                          <ShieldCheck className="h-3 w-3" />
                          vertraut
                        </span>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={() => void removeContact(contact)}
                      disabled={isBusy}
                      className="rounded-full border px-2 py-1 text-[10px]"
                      style={{ borderColor: isDark ? "#5a4450" : "#e4c7c7", color: isDark ? "#d3a8b0" : "#a75d66" }}
                    >
                      Entfernen
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="text-[11px]" style={{ color: isDark ? "#8fa5bf" : "#7188a3" }}>
                      {isShared ? "Bereits freigegeben" : "Noch nicht freigegeben"}
                    </p>
                    <button
                      type="button"
                      onClick={() => void toggleShare(contact)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold"
                      style={{
                        borderColor: isShared ? (isDark ? "#4e7565" : "#b8d3bd") : isDark ? "#415870" : "#d7c9b7",
                        background: isShared ? (isDark ? "rgba(95,145,125,0.18)" : "rgba(163,207,170,0.2)") : "transparent",
                        color: isShared ? (isDark ? "#afd7c5" : "#4e8f63") : isDark ? "#c9d8ea" : "#60758f",
                      }}
                    >
                      {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isShared ? <Check className="h-3.5 w-3.5" /> : null}
                      {isShared ? "Freigegeben" : "Freigeben"}
                    </button>
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
};

export default AvatarSharePanel;
