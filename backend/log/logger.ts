import { avatarDB } from "../avatar/db";

// LogEvent defines the structure for log messages.
export interface LogEvent {
  source:
    | 'openai-story-generation'
    | 'runware-single-image'
    | 'runware-batch-image'
    | 'openai-avatar-analysis'
    | 'openai-avatar-analysis-stable'
    | 'openai-doku-generation'
    | 'openai-tavi-chat'
    | 'openai-story-generation-mcp'; // Add MCP source
  timestamp: Date;
  request: any;
  response: any;
  metadata?: any;
}

// Object Storage dummy export (kept for backwards compatibility)
export const logBucket = null as any;

// Legacy topic export (kept for backwards compatibility with publishWithTimeout)
// Now writes directly to database instead of using Pub/Sub
export const logTopic = {
  publish: async (event: LogEvent) => {
    try {
      // Write log directly to database
      await avatarDB.exec`
        INSERT INTO logs (source, timestamp, request, response, metadata)
        VALUES (${event.source}, ${event.timestamp}, ${event.request}, ${event.response}, ${event.metadata || null})
      `;
      console.log(`📝 [${event.source}] Log saved to database`);
    } catch (err: any) {
      console.error(`Failed to save log to database:`, err.message);
      // Don't throw - logging should never break the main flow
    }
  }
};
