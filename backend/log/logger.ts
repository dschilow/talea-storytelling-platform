import { logDB } from "./db";
import { getLogTableInfo } from "./table-resolver";

// LogEvent defines the structure for log messages.
export interface LogEvent {
  source:
    | "openai-story-generation"
    | "runware-single-image"
    | "runware-batch-image"
    | "openai-avatar-analysis"
    | "openai-avatar-analysis-stable"
    | "openai-doku-generation"
    | "openai-tavi-chat"
    | "openai-story-generation-mcp"
    | "phase1-skeleton-generation"
    | "phase2-character-matching"
    | "phase3-story-finalization"
    | "phase4-image-generation"
    | "4phase-cover-generation"
    | "4phase-summary";
  timestamp: Date;
  request: any;
  response: any;
  metadata?: any;
}

// Object Storage dummy export (kept for backwards compatibility)
export const logBucket = null as any;

// Legacy topic export (kept for backwards compatibility with publishWithTimeout)
// Now writes directly to PostgreSQL instead of using Pub/Sub.
export const logTopic = {
  publish: async (event: LogEvent) => {
    try {
      const { qualifiedName: logTable } = await getLogTableInfo();
      await logDB.rawExec(
        `
          INSERT INTO ${logTable} (source, timestamp, request, response, metadata)
          VALUES ($1, $2, $3, $4, $5)
        `,
        event.source,
        event.timestamp,
        event.request,
        event.response,
        event.metadata ?? null
      );
      console.log(`[logTopic] [${event.source}] Log saved to database`);
    } catch (err: any) {
      console.error(`Failed to save log to database:`, err?.message ?? err);
      // Don't throw - logging should never break the main flow
    }
  },
};
