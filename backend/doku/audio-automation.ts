/**
 * Audio-doku automation interface (HTTP entry point for audio-automation-core.ts).
 *
 * Lets an operator (Claude in a chat session, a script) review the audio-doku
 * catalog and start background generation of finished episodes.
 *
 * Security model — this is the one Clerk-less surface of the doku service, so it
 * is deliberately narrow (decision: shared-secret header, "Variante A"):
 *   - every endpoint requires the secret in the `x-automation-key` header
 *     (env AUDIO_DOKU_AUTOMATION_KEY, >= 32 chars). Unset or too short means the
 *     feature is OFF: every endpoint answers 404 and the queue runner never starts;
 *   - the key is compared in constant time (SHA-256 digests) and a failed
 *     attempt is answered only after a delay;
 *   - there is no delete/update/arbitrary-SQL path: only list, enqueue, cancel a
 *     queued job, read job status and (un)publish an episode THIS interface created;
 *   - new episodes are private (is_public = false) unless the caller opts in.
 */

import { api, APIError, type Header, type Query } from "encore.dev/api";
import log from "encore.dev/log";

import {
  cancelJob,
  enqueueJobs,
  getJob,
  listCastingVoices,
  listJobs,
  loadCatalog,
  setAutomationEpisodePublic,
  startAutomationRunner,
  type AutomationCatalogEntry,
  type AutomationJobItem,
  type AutomationJobView,
} from "./audio-automation-core";
import { AUTOMATION_MIN_KEY_LENGTH as MIN_KEY_LENGTH, automationKeyMatches } from "./audio-automation-input";

const FAILED_AUTH_DELAY_MS = 1000;

async function assertAutomationKey(provided: string | undefined): Promise<void> {
  const expected = process.env.AUDIO_DOKU_AUTOMATION_KEY;
  if (!expected || expected.trim().length < MIN_KEY_LENGTH) {
    // Feature disabled: behave as if the route does not exist.
    throw APIError.notFound("Not found.");
  }
  if (!automationKeyMatches(provided, expected)) {
    log.warn("[AudioAutomation] rejected request with a wrong key");
    await new Promise((resolve) => setTimeout(resolve, FAILED_AUTH_DELAY_MS));
    throw APIError.unauthenticated("Invalid key.");
  }
}

// The queue only runs when the feature is switched on.
if ((process.env.AUDIO_DOKU_AUTOMATION_KEY ?? "").trim().length >= MIN_KEY_LENGTH) {
  startAutomationRunner();
}

interface AuthedRequest {
  key?: Header<"x-automation-key">;
}

interface CatalogResponse {
  audioDokus: AutomationCatalogEntry[];
  total: number;
  /** Topics already queued or running, so a new batch does not duplicate them. */
  pendingTopics: string[];
}

interface StartJobsRequest extends AuthedRequest {
  items: AutomationJobItem[];
}

interface JobsResponse {
  jobs: AutomationJobView[];
}

interface ListJobsRequest extends AuthedRequest {
  /** Comma separated job ids; default: the 50 newest jobs. */
  ids?: Query<string>;
}

interface JobIdRequest extends AuthedRequest {
  id: string;
}

interface PublishRequest extends AuthedRequest {
  id: string;
  isPublic: boolean;
}

interface PublishResponse {
  id: string;
  title: string;
  isPublic: boolean;
}

export const automationCatalog = api<AuthedRequest, CatalogResponse>(
  { expose: true, method: "GET", path: "/automation/audio-dokus/catalog", auth: false },
  async (req) => {
    await assertAutomationKey(req.key);
    const { audioDokus, pendingTopics } = await loadCatalog();
    return { audioDokus, total: audioDokus.length, pendingTopics };
  },
);

export const automationStartJobs = api<StartJobsRequest, JobsResponse>(
  { expose: true, method: "POST", path: "/automation/audio-dokus/jobs", auth: false },
  async (req) => {
    await assertAutomationKey(req.key);
    return { jobs: await enqueueJobs(req.items) };
  },
);

export const automationListJobs = api<ListJobsRequest, JobsResponse>(
  { expose: true, method: "GET", path: "/automation/audio-dokus/jobs", auth: false },
  async (req) => {
    await assertAutomationKey(req.key);
    return { jobs: await listJobs((req.ids ?? "").split(",").map((id) => id.trim())) };
  },
);

export const automationGetJob = api<JobIdRequest, AutomationJobView>(
  { expose: true, method: "GET", path: "/automation/audio-dokus/jobs/:id", auth: false },
  async (req) => {
    await assertAutomationKey(req.key);
    return await getJob(req.id);
  },
);

export const automationCancelJob = api<JobIdRequest, AutomationJobView>(
  { expose: true, method: "POST", path: "/automation/audio-dokus/jobs/:id/cancel", auth: false },
  async (req) => {
    await assertAutomationKey(req.key);
    return await cancelJob(req.id);
  },
);

export const automationPublish = api<PublishRequest, PublishResponse>(
  { expose: true, method: "POST", path: "/automation/audio-dokus/publish/:id", auth: false },
  async (req) => {
    await assertAutomationKey(req.key);
    const result = await setAutomationEpisodePublic(req.id, req.isPublic === true);
    log.info(`[AudioAutomation] ${req.id} public=${result.isPublic}`);
    return result;
  },
);

interface VoicesResponse {
  voices: Array<{
    voiceId: string;
    name: string;
    labels?: Record<string, string>;
    description?: string;
    excludedFromAutoCast: boolean;
  }>;
}

export const automationVoices = api<AuthedRequest, VoicesResponse>(
  { expose: true, method: "GET", path: "/automation/audio-dokus/voices", auth: false },
  async (req) => {
    await assertAutomationKey(req.key);
    return { voices: await listCastingVoices() };
  },
);
