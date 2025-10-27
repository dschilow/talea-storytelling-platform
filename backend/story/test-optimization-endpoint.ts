/**
 * Test Optimization Endpoint
 *
 * API endpoint to run the enhanced test suite and validate all optimizations.
 */

import { api } from "encore.dev/api";
import { runEnhancedTestSuite } from "./enhanced-test-suite";

/**
 * Test optimization request
 */
export interface TestOptimizationRequest {
  runFullSuite?: boolean;
  specificTests?: string[];
}

/**
 * Test optimization response
 */
export interface TestOptimizationResponse {
  suiteResults: {
    results: Array<{
      name: string;
      passed: boolean;
      score: number;
      issues: string[];
    }>;
    summary: {
      totalTests: number;
      passed: number;
      failed: number;
      averageScore: number;
      successRate: number;
    };
  };
  timestamp: string;
  version: string;
}

/**
 * Run optimization test suite
 */
export const testOptimization = api<
  TestOptimizationRequest,
  TestOptimizationResponse
>(
  { expose: true, method: "POST", path: "/test/optimization-suite" },
  async (req) => {
    console.log("[test-endpoint] 🚀 Starting optimization test suite...");

    try {
      const suiteResults = await runEnhancedTestSuite();

      const response: TestOptimizationResponse = {
        suiteResults,
        timestamp: new Date().toISOString(),
        version: "10.0-optimization-v1.0"
      };

      console.log("[test-endpoint] ✅ Test suite completed");
      console.log(`[test-endpoint] 📊 Success rate: ${suiteResults.summary.successRate}%`);
      console.log(`[test-endpoint] 🎯 Average score: ${suiteResults.summary.averageScore}/10`);

      return response;

    } catch (error) {
      console.error("[test-endpoint] ❌ Test suite failed:", error);

      throw new Error(`Test suite failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
