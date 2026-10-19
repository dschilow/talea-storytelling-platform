/**
 * Where a chapter book stands while the wizard waits for its first chapters.
 *
 * `story.generate` only queues the job and returns, so the call itself says nothing about
 * "done". The job writes its real stage (backend/story/book-generation.ts, saveState):
 *
 *   queued | requeued                                  idea, cast and plan are being made
 *   planned                                            plan is done, the first chapters are being written
 *   chapters-N | pictures-N | waiting-after-N |
 *   finishing | done                                   the first chapters are published
 *
 * Before 2026-10-19 the wizard played a fixed five-second animation of invented phases and then
 * announced "Fertig!", while the reader began a wait of several minutes.
 */

export type BookWaitStep = 'plan' | 'chapter';

const PUBLISHED_STAGE = /^(chapters-|pictures-|waiting-after-|finishing$|done$)/;

/** The step a job stage belongs to; 'published' means the first chapters can be opened. */
export function bookStepForStage(stage: string): BookWaitStep | 'published' {
  if (PUBLISHED_STAGE.test(stage)) return 'published';
  return stage === 'planned' ? 'chapter' : 'plan';
}

interface BookStoryView {
  status?: string;
  chapters?: unknown[];
  pages?: unknown[];
}

export interface FollowChapterBookDeps<S extends BookStoryView> {
  bookStatus: (request: { id: string }) => Promise<{ status: string; stage: string }>;
  getStory: (request: { id: string }) => Promise<S>;
  sleep: (ms: number) => Promise<void>;
}

export type FollowChapterBookResult<S> =
  | { kind: 'ready'; story: S }
  | { kind: 'failed' }
  | { kind: 'stopped' };

const hasText = (story: BookStoryView | null): boolean =>
  Boolean(story && ((story.chapters?.length ?? 0) > 0 || (story.pages?.length ?? 0) > 0));

/**
 * Polls the job until the first chapters exist, the job gave up, or the caller stops waiting.
 * The story itself is the source of truth for "chapters exist"; the job stage only decides when
 * to look and which step to show. A status call that fails never ends the wait — the story is
 * checked instead.
 */
export async function followChapterBook<S extends BookStoryView>(
  deps: FollowChapterBookDeps<S>,
  storyId: string,
  options: { onStep: (step: BookWaitStep) => void; shouldStop: () => boolean; pollMs?: number }
): Promise<FollowChapterBookResult<S>> {
  const { onStep, shouldStop, pollMs = 3000 } = options;

  while (!shouldStop()) {
    let jobFailed = false;
    let step: BookWaitStep | 'published' = 'published'; // unknown stage: look at the story
    try {
      const job = await deps.bookStatus({ id: storyId });
      jobFailed = job.status === 'failed';
      step = bookStepForStage(job.stage);
    } catch {
      // The story is checked below.
    }

    if (step === 'published' || jobFailed) {
      const story = await deps.getStory({ id: storyId }).catch(() => null);
      // A job that gave up after publishing leaves a readable book.
      if (hasText(story)) return { kind: 'ready', story: story as S };
      if (jobFailed || story?.status === 'error') return { kind: 'failed' };
    } else {
      onStep(step);
    }

    await deps.sleep(pollMs);
  }

  return { kind: 'stopped' };
}
