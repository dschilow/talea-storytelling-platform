#!/usr/bin/env bun

/**
 * Production Story Generation Test Runner
 * Runs tests against Railway production backend
 */

const PRODUCTION_BACKEND = 'https://backend-2-production-3de1.up.railway.app';
const TEST_USER_ID = 'optimization-test-user';

interface TestConfig {
  name: string;
  genre: string;
  setting: string;
  ageGroup: "3-5" | "6-8" | "9-12" | "13+";
  complexity: "simple" | "medium" | "complex";
  length: "short" | "medium" | "long";
  avatarCount: number;
}

const TEST_CONFIGS: TestConfig[] = [
  {
    name: "Test 1: Klassisches Märchen",
    genre: "Klassische Märchen",
    setting: "Magischer Wald mit alten Bäumen",
    ageGroup: "6-8",
    complexity: "medium",
    length: "medium",
    avatarCount: 2
  },
  {
    name: "Test 2: Märchenwelten",
    genre: "Märchenwelten und Magie",
    setting: "Verzaubertes Schloss",
    ageGroup: "9-12",
    complexity: "complex",
    length: "long",
    avatarCount: 1
  }
];

async function main() {
  console.log('🚀 Production Story Generation Test Runner');
  console.log(`Backend: ${PRODUCTION_BACKEND}`);
  console.log('');

  // Test 1: Check if test endpoints are available
  console.log('📡 Checking test endpoints availability...');

  try {
    const response = await fetch(`${PRODUCTION_BACKEND}/story/test/configs`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log(`❌ Test endpoints not available: ${response.status}`);
      console.log('Response:', await response.text());
      console.log('');
      console.log('ℹ️  The test endpoints require authentication.');
      console.log('I will use the direct story generation endpoint instead.');
      return;
    }

    const data = await response.json();
    console.log('✅ Test endpoints available!');
    console.log(`Available configs: ${data.configs?.length || 0}`);
    console.log('');

  } catch (error) {
    console.log('❌ Error checking endpoints:', error);
  }
}

main();
