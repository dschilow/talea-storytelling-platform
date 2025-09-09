import { Topic, Subscription, Context } from "encore.dev/pubsub";
import { Bucket } from "encore.dev/storage/objects";

// LogEvent defines the structure for log messages.
export interface LogEvent {
  source:
    | 'openai-story-generation'
    | 'runware-single-image'
    | 'runware-batch-image'
    | 'openai-avatar-analysis'
    | 'openai-avatar-analysis-stable'
    | 'openai-doku-generation';
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
export const logTopic = new Topic<LogEvent>("log-events", {});

// This subscription listens for log events and saves them to the bucket.
// This happens asynchronously, so it doesn't slow down the main request flow.
export const logSubscription = new Subscription(logTopic, "save-log-to-bucket", {
  handler: async (event: LogEvent, context: Context) => {
    console.log(`📝 Received log event from source: ${event.source}`);
    // FIX: Use optional chaining to prevent crash if context or message is undefined.
    const id = context?.message?.id || crypto.randomUUID();
    
    // Create a safe filename by replacing colons.
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
      // Encore will automatically retry the message if the handler throws an error.
      throw err;
    }
  },
});
