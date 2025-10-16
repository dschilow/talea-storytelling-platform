/**
 * Pub/Sub helper with timeout to prevent hanging operations
 * 
 * Usage:
 * ```typescript
 * import { publishWithTimeout } from "../helpers/pubsubTimeout";
 * 
 * await publishWithTimeout(logTopic, { 
 *   source: 'my-service',
 *   data: {...}
 * });
 * ```
 */

export async function publishWithTimeout<T>(
  topic: { publish: (data: T) => Promise<void> },
  data: T,
  timeoutMs: number = 2000
): Promise<void> {
  try {
    await Promise.race([
      topic.publish(data),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("Pub/Sub timeout")), timeoutMs)
      ),
    ]);
  } catch (err: any) {
    console.warn(`Failed to publish event: ${err.message}`);
    // Continue anyway - event publishing is non-critical
  }
}

