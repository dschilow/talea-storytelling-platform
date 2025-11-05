// Check fairy_tale_usage_stats table structure
import { api } from "encore.dev/api";
import { fairytalesDB } from "../fairytales/db";

export const checkFairyTaleStats = api(
  { expose: true, method: "GET", path: "/health/check-fairy-tale-stats" },
  async (): Promise<{ 
    tableExists: boolean; 
    columnNames: string[];
    sampleRows: any[];
    error?: string;
  }> => {
    try {
      // Check if table exists and get column names
      const tableInfo = await fairytalesDB.queryAll<any>`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'fairy_tale_usage_stats'
        ORDER BY ordinal_position
      `;

      if (tableInfo.length === 0) {
        return {
          tableExists: false,
          columnNames: [],
          sampleRows: [],
          error: "Table fairy_tale_usage_stats does not exist",
        };
      }

      const columnNames = tableInfo.map(col => `${col.column_name} (${col.data_type})`);

      // Get sample rows
      const sampleRows = await fairytalesDB.queryAll<any>`
        SELECT *
        FROM fairy_tale_usage_stats
        LIMIT 5
      `;

      return {
        tableExists: true,
        columnNames,
        sampleRows,
      };
    } catch (error: any) {
      return {
        tableExists: false,
        columnNames: [],
        sampleRows: [],
        error: error.message || String(error),
      };
    }
  }
);
