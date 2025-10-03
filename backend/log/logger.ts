import { Bucket } from "encore.dev/storage/objects";

// LogEvent defines the structure for log messages.
export interface LogEvent {
  source:
    | 'openai-story-generation'
    | 'runware-single-image'
    | 'runware-batch-image'
    | 'openai-avatar-analysis'
    | 'openai-avatar-analysis-stable'
    | 'openai-doku-generation'
    | 'openai-tavi-chat';
  timestamp: Date;
  request: any;
  response: any;
  metadata?: any;
}

const DISABLE_LOG_STORAGE = process.env.DISABLE_LOG_STORAGE === "1";

// Object storage bucket for structured logs.
export const logBucket = new Bucket("avatales-ai-logs", {
  public: false,
});

// logTopic shim: provides publish(event) to keep callers unchanged without requiring Pub/Sub infra.
export const logTopic = {
  publish: async (event: LogEvent) => {
    // Generate unique ID and path for the log entry
    const id = crypto.randomUUID();
    const safeTimestamp = event.timestamp.toISOString().replace(/:/g, '-');
    const path = `${event.source}/${event.timestamp.toISOString().split('T')[0]}/${safeTimestamp}_${id}.json`;
    const logContent = { id, ...event };

    try {
      if (DISABLE_LOG_STORAGE) {
        // No-op if disabled
        return;
      }
      await logBucket.upload(path, Buffer.from(JSON.stringify(logContent, null, 2)), {
        contentType: "application/json",
      });
    } catch (err) {
      // Swallow errors: logging must not break request flow
      console.error("logTopic.publish: failed to write log", err);
    }
  },
};

