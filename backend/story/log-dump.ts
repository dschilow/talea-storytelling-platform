
import { api } from "encore.dev/api";
import { logDB } from "../log/db";

export const dumpStoryLogs = api(
    { expose: true, method: "GET", path: "/story/debug-logs/:storyId", auth: false },
    async (req: { storyId: string }) => {
        const logs = await logDB.queryAll<{
            source: string;
            request: any;
            response: any;
            created_at: Date;
        }>`
      SELECT source, request, response, created_at
      FROM logs
      WHERE request::jsonb @> jsonb_build_object('storyId', ${req.storyId})
      ORDER BY created_at ASC
    `;

        // Map to ensure json parsing if string
        const parsedLogs = logs.map(l => ({
            source: l.source,
            timestamp: l.created_at,
            request: typeof l.request === 'string' ? JSON.parse(l.request) : l.request,
            response: typeof l.response === 'string' ? JSON.parse(l.response) : l.response
        }));

        return { logs: parsedLogs };
    }
);
