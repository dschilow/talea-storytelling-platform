import { api } from "encore.dev/api";

export interface VersionResponse {
  /** Git commit the running image was built from, or "unknown" locally. */
  gitSha: string;
  /** Short form of gitSha, for eyeballing against `git log --oneline`. */
  gitShaShort: string;
  /** Branch or tag the image was built from ("main", "test-main", ...). */
  gitRef: string;
  /** UTC timestamp of the image build. */
  buildTime: string;
  /** Process start time — distinguishes a restart from a new deployment. */
  startedAt: string;
}

const startedAt = new Date().toISOString();

function envOrUnknown(name: string): string {
  const value = String(process.env[name] || "").trim();
  return value.length > 0 ? value : "unknown";
}

/**
 * Reports which build is actually serving traffic.
 *
 * This exists because of the 2026-07-31 incident: production had been pinned
 * to the ':test-main' image tag since a forked-environment merge on 07-28, so
 * every push to main built and pushed an image nobody deployed. It went
 * unnoticed for three days because there was no way to ask the running service
 * what it was. The only reason it was found at all is that a support-model
 * constant in the story pipeline happened to differ between the two builds and
 * showed up in a story log — a lucky fingerprint, not a diagnostic.
 *
 * Deliberately unauthenticated: its entire purpose is to be curl-able straight
 * after a deploy, and the repository is public, so a commit SHA discloses
 * nothing. Keep it that way — do not extend this payload with configuration,
 * secrets, environment names, or database state.
 */
export const version = api(
  { expose: true, method: "GET", path: "/health/version", auth: false },
  async (): Promise<VersionResponse> => {
    const gitSha = envOrUnknown("BUILD_GIT_SHA");

    return {
      gitSha,
      gitShaShort: gitSha === "unknown" ? "unknown" : gitSha.slice(0, 7),
      gitRef: envOrUnknown("BUILD_GIT_REF"),
      buildTime: envOrUnknown("BUILD_TIME"),
      startedAt,
    };
  }
);
