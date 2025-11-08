import React, { useEffect, useMemo, useState } from "react";
import { SignedIn, SignedOut, UserButton, useAuth, useUser } from "@clerk/clerk-react";
import Card from "../../components/common/Card";
import FadeInView from "../../components/animated/FadeInView";
import { colors } from "../../utils/constants/colors";
import { typography } from "../../utils/constants/typography";
import { spacing, radii, shadows } from "../../utils/constants/spacing";
import { Shield, Users, Search, Trash2, Edit3, RefreshCw, BarChart3, Crown, UserPlus } from "lucide-react";
import { useBackend } from "../../hooks/useBackend";
import type { user, avatar } from "../../client";
import Button from "../../components/common/Button";

type UserProfile = user.UserProfile;
type Avatar = avatar.Avatar;

interface AdminStats {
  totals: { users: number; avatars: number; stories: number };
  subscriptions: { starter: number; familie: number; premium: number };
  storiesByStatus: { generating: number; complete: number; error: number };
  recentActivity: {
    latestUser?: { id: string; name: string; createdAt: string } | null;
    latestAvatar?: { id: string; name: string; createdAt: string } | null;
    latestStory?: { id: string; title: string; createdAt: string } | null;
  };
}

const AdminDashboard: React.FC = () => {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const backend = useBackend();

  const [authorized, setAuthorized] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [isPromoting, setIsPromoting] = useState(false);

  // Stats
  const [stats, setStats] = useState<AdminStats | null>(null);

  // Users
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [q, setQ] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [userLoading, setUserLoading] = useState(false);

  // Avatars (for quick admin browsing)
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [avatarQ, setAvatarQ] = useState("");
  const [avatarsCursor, setAvatarsCursor] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (!isSignedIn) {
          setAuthorized(false);
          setLoading(false);
          return;
        }
        // Check role via /user/me
        const me = await backend.user.me();
        setAuthorized(me.role === "admin");
      } catch (e) {
        console.error("Failed to resolve admin authorization", e);
        setAuthorized(false);
      } finally {
        setLoading(false);
      }
    })();
  }, [isSignedIn]);

  useEffect(() => {
    if (!authorized) return;
    void loadStats();
    void loadUsers(true);
    void loadAvatars(true);
  }, [authorized]);

  const loadStats = async () => {
    try {
      const s = await backend.admin.getStats();
      setStats(s);
    } catch (e) {
      console.error("Failed to load stats", e);
    }
  };

  const loadUsers = async (reset = false) => {
    try {
      setUserLoading(true);
      const r = await backend.admin.listUsers({
        limit: 25,
        q: q || undefined,
        cursor: reset ? undefined : nextCursor || undefined,
      } as any);
      setUsers(reset ? r.users as any : [...users, ...(r.users as any)]);
      setNextCursor((r as any).nextCursor || null);
    } catch (e) {
      console.error("Failed to load users", e);
    } finally {
      setUserLoading(false);
    }
  };

  const loadAvatars = async (reset = false) => {
    try {
      setAvatarLoading(true);
      const r = await backend.admin.listAvatarsAdmin({
        limit: 12,
        q: avatarQ || undefined,
        cursor: reset ? undefined : avatarsCursor || undefined,
      } as any);
      setAvatars(reset ? r.avatars : [...avatars, ...r.avatars]);
      setAvatarsCursor((r as any).nextCursor || null);
    } catch (e) {
      console.error("Failed to load avatars", e);
    } finally {
      setAvatarLoading(false);
    }
  };

  const promoteToAdmin = async (u: UserProfile) => {
    if (!window.confirm(`"${u.name}" zu Admin befördern?`)) return;
    try {
      await backend.admin.updateUser({ id: u.id, role: "admin" });
      setUsers(users.map(x => (x.id === u.id ? { ...x, role: "admin" } : x)));
    } catch (e) {
      console.error("Failed to promote user", e);
      alert("Fehler beim Aktualisieren der Rolle.");
    }
  };

  const changeSubscription = async (u: UserProfile, sub: UserProfile["subscription"]) => {
    try {
      await backend.admin.updateUser({ id: u.id, subscription: sub });
      setUsers(users.map(x => (x.id === u.id ? { ...x, subscription: sub } : x)));
    } catch (e) {
      console.error("Failed to change subscription", e);
      alert("Fehler beim Aktualisieren des Abos.");
    }
  };

  const deleteUser = async (u: UserProfile) => {
    if (!window.confirm(`Benutzer "${u.name}" wirklich löschen? Alle Avatare und Stories werden entfernt.`)) return;
    try {
      await backend.admin.deleteUser({ id: u.id });
      setUsers(users.filter(x => x.id !== u.id));
    } catch (e) {
      console.error("Failed to delete user", e);
      alert("Fehler beim Löschen.");
    }
  };

  const handlePromote = async () => {
    setIsPromoting(true);
    try {
      const resp = await backend.admin.promoteToAdmin();
      alert(resp.message);
      window.location.reload();
    } catch (e: any) {
      console.error("Failed to promote to admin", e);
      alert(`Promotion failed: ${e.message}`);
    } finally {
      setIsPromoting(false);
    }
  };

  const header = useMemo(() => {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: spacing.md,
        justifyContent: "space-between",
        marginBottom: spacing.lg,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: spacing.md }}>
          <Shield size={28} style={{ color: colors.primary }} />
          <div>
            <div style={{ ...typography.textStyles.headingMd, color: colors.textPrimary }}>Admin Dashboard</div>
            <div style={{ ...typography.textStyles.caption, color: colors.textSecondary }}>
              Versteckter Bereich – nur für Admins
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: spacing.md }}>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </div>
      </div>
    );
  }, []);

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: colors.appBackground
      }}>
        <div>
          <div style={{
            width: 56, height: 56, border: "4px solid rgba(0,0,0,0.08)", borderTop: `4px solid ${colors.primary}`,
            borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto"
          }} />
          <style>{`@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: colors.appBackground, padding: spacing.xl }}>
      <SignedOut>
        <Card variant="glass" style={{ maxWidth: 640, margin: "0 auto", padding: spacing.xl, textAlign: "center" }}>
          <Shield size={32} style={{ color: colors.primary, marginBottom: spacing.md }} />
          <div style={{ ...typography.textStyles.headingMd, color: colors.textPrimary, marginBottom: spacing.sm }}>
            Admin-Bereich (Anmeldung erforderlich)
          </div>
          <div style={{ ...typography.textStyles.body, color: colors.textSecondary, marginBottom: spacing.lg }}>
            Bitte melde dich an: /auth
          </div>
        </Card>
      </SignedOut>

      <SignedIn>
        {!authorized ? (
          <Card variant="glass" style={{ maxWidth: 640, margin: "0 auto", padding: spacing.xl, textAlign: "center" }}>
            <Shield size={32} style={{ color: colors.error, marginBottom: spacing.md }} />
            <div style={{ ...typography.textStyles.headingMd, color: colors.textPrimary, marginBottom: spacing.sm }}>
              Kein Admin-Zugriff
            </div>
            <div style={{ ...typography.textStyles.body, color: colors.textSecondary, marginBottom: spacing.lg }}>
              Dein Konto verfügt nicht über Admin-Rechte. Wenn noch kein Admin existiert, kannst du dich hier zum ersten Admin machen.
            </div>
            <Button
              title={isPromoting ? "Wird ausgeführt..." : "Erster Admin werden"}
              onPress={handlePromote}
              loading={isPromoting}
              icon={<UserPlus size={16} />}
              variant="fun"
            />
          </Card>
        ) : (
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            {header}

            {/* Stats */}
            <FadeInView delay={50}>
              <Card variant="glass" style={{ marginBottom: spacing.xl, padding: spacing.xl }}>
                <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md }}>
                  <BarChart3 size={20} style={{ color: colors.primary }} />
                  <div style={{ ...typography.textStyles.label, color: colors.textPrimary, fontSize: 16 }}>
                    System-Statistiken
                  </div>
                  <button
                    onClick={loadStats}
                    title="Aktualisieren"
                    style={{
                      marginLeft: "auto",
                      padding: spacing.sm,
                      borderRadius: radii.lg,
                      background: colors.glass.buttonBackground,
                      border: `1px solid ${colors.glass.border}`
                    }}
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: spacing.md }}>
                  <StatTile label="Benutzer" value={stats?.totals.users ?? 0} />
                  <StatTile label="Avatare" value={stats?.totals.avatars ?? 0} />
                  <StatTile label="Geschichten" value={stats?.totals.stories ?? 0} />
                </div>

                <div style={{ marginTop: spacing.lg, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: spacing.md }}>
                  <StatTile label="Starter" value={stats?.subscriptions.starter ?? 0} />
                  <StatTile label="Familie" value={stats?.subscriptions.familie ?? 0} />
                  <StatTile label="Premium" value={stats?.subscriptions.premium ?? 0} />
                </div>
              </Card>
            </FadeInView>

            {/* Users Management */}
            <FadeInView delay={150}>
              <Card variant="glass" style={{ marginBottom: spacing.xl, padding: spacing.xl }}>
                <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md }}>
                  <Users size={20} style={{ color: colors.primary }} />
                  <div style={{ ...typography.textStyles.label, color: colors.textPrimary, fontSize: 16 }}>
                    Benutzerverwaltung
                  </div>
                </div>

                <div style={{ display: "flex", gap: spacing.sm, marginBottom: spacing.md }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <Search size={16} style={{ position: "absolute", top: 12, left: 12, color: colors.textSecondary }} />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Suche nach Name oder E-Mail..."
                      style={{
                        width: "100%",
                        padding: `${spacing.md}px ${spacing.md}px ${spacing.md}px ${spacing.xl + 8}px`,
                        borderRadius: radii.lg,
                        border: `1px solid ${colors.glass.border}`,
                        background: colors.glass.cardBackground
                      }}
                    />
                  </div>
                  <button
                    onClick={() => { setNextCursor(null); void loadUsers(true); }}
                    style={{
                      padding: `${spacing.md}px ${spacing.lg}px`,
                      borderRadius: radii.lg,
                      background: colors.primary,
                      color: colors.textInverse,
                      border: "none",
                    }}
                  >
                    Suchen
                  </button>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                    <thead>
                      <tr style={{ textAlign: "left", color: colors.textSecondary }}>
                        <th style={{ padding: spacing.sm }}>Name</th>
                        <th style={{ padding: spacing.sm }}>E-Mail</th>
                        <th style={{ padding: spacing.sm }}>Abo</th>
                        <th style={{ padding: spacing.sm }}>Rolle</th>
                        <th style={{ padding: spacing.sm, textAlign: "right" }}>Aktionen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id} style={{ borderTop: `1px solid ${colors.glass.border}` }}>
                          <td style={{ padding: spacing.sm, color: colors.textPrimary }}>{u.name}</td>
                          <td style={{ padding: spacing.sm, color: colors.textSecondary }}>{u.email}</td>
                          <td style={{ padding: spacing.sm }}>
                            <select
                              value={u.subscription}
                              onChange={(e) => changeSubscription(u, e.target.value as UserProfile["subscription"])}
                              style={{
                                padding: spacing.sm,
                                borderRadius: radii.lg,
                                border: `1px solid ${colors.glass.border}`,
                                background: colors.surface
                              }}
                            >
                              <option value="starter">starter</option>
                              <option value="familie">familie</option>
                              <option value="premium">premium</option>
                            </select>
                          </td>
                          <td style={{ padding: spacing.sm }}>
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 6,
                              padding: `${spacing.xs}px ${spacing.sm}px`,
                              borderRadius: radii.lg,
                              background: u.role === "admin" ? "rgba(255, 107, 157, 0.12)" : colors.glass.badgeBackground,
                              border: `1px solid ${colors.glass.border}`,
                              color: colors.textPrimary
                            }}>
                              {u.role === "admin" && <Crown size={14} style={{ color: colors.primary }} />}
                              {u.role}
                            </span>
                          </td>
                          <td style={{ padding: spacing.sm, textAlign: "right" }}>
                            {u.role !== "admin" && (
                              <button
                                onClick={() => promoteToAdmin(u)}
                                title="Zu Admin machen"
                                style={{
                                  padding: spacing.sm,
                                  borderRadius: radii.lg,
                                  background: colors.glass.buttonBackground,
                                  border: `1px solid ${colors.glass.border}`,
                                  marginRight: spacing.sm
                                }}
                              >
                                <Edit3 size={16} />
                              </button>
                            )}
                            <button
                              onClick={() => deleteUser(u)}
                              title="Löschen"
                              style={{
                                padding: spacing.sm,
                                borderRadius: radii.lg,
                                background: "rgba(245, 101, 101, 0.9)",
                                color: colors.textInverse,
                                border: "none"
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: spacing.md, textAlign: "center" }}>
                  <button
                    disabled={!nextCursor || userLoading}
                    onClick={() => loadUsers(false)}
                    style={{
                      padding: `${spacing.md}px ${spacing.lg}px`,
                      borderRadius: radii.lg,
                      background: colors.glass.buttonBackground,
                      border: `1px solid ${colors.glass.border}`,
                      opacity: nextCursor ? 1 : 0.5,
                      cursor: nextCursor ? "pointer" : "not-allowed"
                    }}
                  >
                    {userLoading ? "Lade..." : nextCursor ? "Mehr laden" : "Ende erreicht"}
                  </button>
                </div>
              </Card>
            </FadeInView>

            {/* Avatars quick view */}
            <FadeInView delay={200}>
              <Card variant="glass" style={{ marginBottom: spacing.xl, padding: spacing.xl }}>
                <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md }}>
                  <div style={{ ...typography.textStyles.label, color: colors.textPrimary, fontSize: 16 }}>
                    Avatare durchsuchen
                  </div>
                </div>

                <div style={{ display: "flex", gap: spacing.sm, marginBottom: spacing.md }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <Search size={16} style={{ position: "absolute", top: 12, left: 12, color: colors.textSecondary }} />
                    <input
                      value={avatarQ}
                      onChange={(e) => setAvatarQ(e.target.value)}
                      placeholder="Name/Beschreibung..."
                      style={{
                        width: "100%",
                        padding: `${spacing.md}px ${spacing.md}px ${spacing.md}px ${spacing.xl + 8}px`,
                        borderRadius: radii.lg,
                        border: `1px solid ${colors.glass.border}`,
                        background: colors.glass.cardBackground
                      }}
                    />
                  </div>
                  <button
                    onClick={() => { setAvatarsCursor(null); void loadAvatars(true); }}
                    style={{
                      padding: `${spacing.md}px ${spacing.lg}px`,
                      borderRadius: radii.lg,
                      background: colors.primary,
                      color: colors.textInverse,
                      border: "none",
                    }}
                  >
                    Suchen
                  </button>
                </div>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: spacing.md
                }}>
                  {avatars.map(a => (
                    <Card key={a.id} variant="glass" style={{ padding: spacing.md }}>
                      <div style={{
                        width: "100%",
                        height: 140,
                        borderRadius: radii.lg,
                        background: colors.glass.cardBackground,
                        border: `1px solid ${colors.glass.border}`,
                        overflow: "hidden",
                        marginBottom: spacing.sm,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}>
                        {a.imageUrl ? (
                          <img src={a.imageUrl} alt={a.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : <span style={{ fontSize: 28 }}>🤖</span>}
                      </div>
                      <div style={{ ...typography.textStyles.label, color: colors.textPrimary }}>{a.name}</div>
                      <div style={{ ...typography.textStyles.caption, color: colors.textSecondary }}>
                        {a.creationType} • {a.userId.slice(0, 6)}…
                      </div>
                    </Card>
                  ))}
                </div>

                <div style={{ marginTop: spacing.md, textAlign: "center" }}>
                  <button
                    disabled={!avatarsCursor || avatarLoading}
                    onClick={() => loadAvatars(false)}
                    style={{
                      padding: `${spacing.md}px ${spacing.lg}px`,
                      borderRadius: radii.lg,
                      background: colors.glass.buttonBackground,
                      border: `1px solid ${colors.glass.border}`,
                      opacity: avatarsCursor ? 1 : 0.5,
                      cursor: avatarsCursor ? "pointer" : "not-allowed"
                    }}
                  >
                    {avatarLoading ? "Lade..." : avatarsCursor ? "Mehr laden" : "Ende erreicht"}
                  </button>
                </div>
              </Card>
            </FadeInView>
          </div>
        )}
      </SignedIn>
    </div>
  );
};

const StatTile: React.FC<{ label: string; value: number }> = ({ label, value }) => {
  return (
    <div style={{
      padding: spacing.lg,
      background: colors.glass.cardBackground,
      border: `1px solid ${colors.glass.border}`,
      borderRadius: radii.lg,
      textAlign: "center"
    }}>
      <div style={{ ...typography.textStyles.caption, color: colors.textSecondary, marginBottom: spacing.xs }}>{label}</div>
      <div style={{ ...typography.textStyles.headingMd, color: colors.textPrimary }}>{value.toLocaleString()}</div>
    </div>
  );
};

export default AdminDashboard;
