
import { APIError, api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { logDB } from "../log/db";
import { getLogTableInfo } from "../log/table-resolver";

function parseStoredJson(value: unknown): unknown {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
    try {
        return JSON.parse(trimmed);
    } catch {
        return value;
    }
}

export const dumpStoryLogs = api(
    { expose: true, method: "GET", path: "/story/debug-logs/:storyId", auth: true },
    async (req: { storyId: string }) => {
        const auth = getAuthData();
        if (!auth) throw APIError.unauthenticated("authentication required");
        if (auth.role !== "admin") throw APIError.permissionDenied("admin access required");

        try {
            const { qualifiedName: logTable } = await getLogTableInfo();
            const logs = await logDB.rawQueryAll<any>(
                `
                    SELECT id, source, timestamp, request, response, metadata
                    FROM ${logTable}
                    WHERE COALESCE(request::text, '') LIKE '%' || $1 || '%'
                       OR COALESCE(response::text, '') LIKE '%' || $1 || '%'
                       OR COALESCE(metadata::text, '') LIKE '%' || $1 || '%'
                    ORDER BY timestamp ASC
                `,
                req.storyId,
            );

            return {
                logs: logs.map((log) => ({
                    id: log.id,
                    source: log.source,
                    timestamp: log.timestamp,
                    request: parseStoredJson(log.request),
                    response: parseStoredJson(log.response),
                    metadata: parseStoredJson(log.metadata),
                })),
            };
        } catch (error) {
            console.error("[story/debug-logs] Failed to prepare story-log download", {
                storyId: req.storyId,
                error: error instanceof Error ? error.message : String(error),
            });
            // Log export is an administrator diagnostic tool. A missing legacy
            // log table must not turn this endpoint into an empty non-JSON
            // response, because the generated client cannot parse that error.
            // Return a valid export document and retain the diagnostic inside it.
            return {
                logs: [],
                warning: "Stored pipeline logs are currently unavailable. See the server log for details.",
            };
        }
    }
);
