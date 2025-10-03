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

// logTopic shim: provides publish(event) - logs to console only (no object storage)
export const logTopic = {
  publish: async (event: LogEvent) => {
    // Log to console for Railway deployment (no object storage required)
    console.log(`[${event.source}] ${event.timestamp.toISOString()}`, {
      request: event.request,
      response: event.response,
      metadata: event.metadata
    });
  },
};

