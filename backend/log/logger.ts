import { Topic, Subscription } from "encore.dev/pubsub";
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

// logBucket is the storage for our structured logs.
// Using a more specific name to avoid potential conflicts.
export const logBucket = new Bucket("avatales-ai-logs", {
  public: false,
});

// logTopic is the central topic for all AI-related logging events.
export const logTopic = new Topic<LogEvent>("log-events", {
  deliveryGuarantee: "at-least-once",
});

// This subscription listens for log events and saves them to the bucket.
// This happens asynchronously, so it doesn't slow down the main request flow.
// Only create the subscription if we're in a GCP environment (not Railway)
const isGCPEnvironment = process.env.GOOGLE_APPLICATION_CREDENTIALS !== undefined;

export const logSubscription = isGCPEnvironment ? new Subscription(logTopic, "save-log-to-bucket", {
  handler: async (event: LogEvent) => {
    console.log(`🚀 LOG SUBSCRIPTION HANDLER CALLED!`);
    console.log(`📝 Received log event from source: ${event.source}`);
    const id = crypto.randomUUID();
    
    const safeTimestamp = event.timestamp.toISOString().replace(/:/g, '-');
    const path = `${event.source}/${event.timestamp.toISOString().split('T')[0]}/${safeTimestamp}_${id}.json`;
    
    const logContent = {
      id,
      ...event,
    };

    try {
      await logBucket.upload(path, Buffer.from(JSON.stringify(logContent, null, 2)), {
        contentType: "application/json",
      });
      console.log(`✅ Logged event to bucket 'avatales-ai-logs' at path: ${path}`);
    } catch (err) {
      console.error(`❌ Failed to log event to bucket:`, err);
      throw err;
    }
  },
}) : null;

// Log whether the subscription was created
if (isGCPEnvironment) {
  console.log("✅ PubSub subscription created (GCP environment detected)");
} else {
  console.log("⚠️  PubSub subscription skipped (no GCP credentials - running on Railway)");
}
