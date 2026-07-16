export type CompletionClaimResult<T> =
  | { status: "applied"; value: T }
  | { status: "duplicate" };

interface RunWithCompletionClaimOptions<T> {
  claim: () => Promise<boolean>;
  apply: () => Promise<T>;
  release: () => Promise<void>;
}

/**
 * Runs the progression mutation only for the request that atomically acquired
 * the completion claim. A failed mutation releases its claim so a later
 * request can retry. Releasing is deliberately best-effort and never masks the
 * original progression error.
 */
export async function runWithCompletionClaim<T>(
  options: RunWithCompletionClaimOptions<T>
): Promise<CompletionClaimResult<T>> {
  const claimed = await options.claim();
  if (!claimed) {
    return { status: "duplicate" };
  }

  try {
    return { status: "applied", value: await options.apply() };
  } catch (error) {
    try {
      await options.release();
    } catch (releaseError) {
      console.error("Failed to release completion claim", releaseError);
    }
    throw error;
  }
}
