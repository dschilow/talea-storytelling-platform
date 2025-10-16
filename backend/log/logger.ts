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

// Object Storage dummy export (not used on Railway, but needed for imports in log/get.ts etc.)
export const logBucket = null as any;

// logTopic is the central topic for all AI-related logging events (NSQ on Railway).
export const logTopic = new Topic<LogEvent>("log-events", {
  deliveryGuarantee: "at-least-once",
});

// This subscription listens for log events and logs them to console.
// On Railway we use NSQ for Pub/Sub (no GCP dependencies).
export const logSubscription = new Subscription(logTopic, "log-to-console", {
  handler: async (event: LogEvent) => {
    console.log(`📝 [${event.source}] Log event received at ${event.timestamp.toISOString()}`);
    console.log(`   Request:`, JSON.stringify(event.request).slice(0, 200));
    console.log(`   Response:`, JSON.stringify(event.response).slice(0, 200));

    // In production you could send to external logging service here
    // For now, just console logging is enough
  },
});
