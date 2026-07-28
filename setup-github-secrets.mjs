#!/usr/bin/env node

/**
 * Setup GitHub Secrets for Railway Test Environment
 *
 * This script adds the required secrets to GitHub for automated test-main deployments.
 *
 * Prerequisites:
 * - GitHub CLI (gh) installed and authenticated
 * - RAILWAY_ENVIRONMENT_ID_TEST - from Railway TEST environment
 * - RAILWAY_SERVICE_ID_TEST - from Railway TEST backend service
 * - RAILWAY_API_TOKEN - already exists
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync } from 'fs';

const execAsync = promisify(exec);

class GitHubSecretsSetup {
  constructor(repo, environmentIdTest, serviceIdTest) {
    this.repo = repo;
    this.environmentIdTest = environmentIdTest;
    this.serviceIdTest = serviceIdTest;
  }

  async runCommand(command) {
    try {
      const { stdout } = await execAsync(command);
      return stdout.trim();
    } catch (error) {
      throw new Error(`Command failed: ${error.message}`);
    }
  }

  async setup() {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║   🔐 GitHub Secrets Setup for Railway Test Environment    ║
╚════════════════════════════════════════════════════════════╝
    `);

    try {
      console.log(`\n📍 Repository: ${this.repo}`);

      // Check if gh CLI is installed
      await this.runCommand('gh --version');
      console.log('✅ GitHub CLI is installed');

      // Verify we're authenticated
      const user = await this.runCommand('gh auth status 2>&1 | grep "Logged in"');
      if (!user) {
        console.error('❌ Not authenticated with GitHub CLI. Run: gh auth login');
        process.exit(1);
      }

      // Set secrets
      console.log('\n📍 Setting GitHub Secrets...\n');

      const secrets = [
        {
          name: 'RAILWAY_ENVIRONMENT_ID_TEST',
          value: this.environmentIdTest,
          description: 'TEST environment ID on Railway',
        },
        {
          name: 'RAILWAY_SERVICE_ID_TEST',
          value: this.serviceIdTest,
          description: 'TEST backend service ID on Railway',
        },
      ];

      for (const secret of secrets) {
        try {
          await this.runCommand(
            `gh secret set ${secret.name} --body "${secret.value}" --repo "${this.repo}"`
          );
          console.log(`✅ ${secret.name}`);
          console.log(`   └─ ${secret.description}\n`);
        } catch (error) {
          console.error(`❌ Failed to set ${secret.name}:`, error.message);
        }
      }

      // Verify secrets
      console.log('\n📍 Verifying secrets...\n');
      const secretsList = await this.runCommand(`gh secret list --repo "${this.repo}"`);
      const hasEnvironmentIdTest = secretsList.includes('RAILWAY_ENVIRONMENT_ID_TEST');
      const hasServiceIdTest = secretsList.includes('RAILWAY_SERVICE_ID_TEST');

      if (hasEnvironmentIdTest && hasServiceIdTest) {
        console.log(`✅ All secrets configured successfully!\n`);
        console.log(`📊 Summary:`);
        console.log(`   ✓ RAILWAY_ENVIRONMENT_ID_TEST = ${this.environmentIdTest}`);
        console.log(`   ✓ RAILWAY_SERVICE_ID_TEST = ${this.serviceIdTest}`);
        console.log(`   ✓ RAILWAY_API_TOKEN (already exists)\n`);
        console.log(`🚀 Next Steps:`);
        console.log(`   1. Push to test-main: git push origin test-main`);
        console.log(`   2. Monitor GitHub Actions for deployment`);
        console.log(`   3. Test at: https://talea-test.up.railway.app\n`);
      } else {
        console.error('❌ Some secrets failed to set. Please check manually.');
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Setup failed:', error.message);
      process.exit(1);
    }
  }
}

// Main
const repo = process.argv[2] || process.env.GITHUB_REPO || 'dschilow/talea-storytelling-platform';
const environmentIdTest = process.argv[3] || process.env.RAILWAY_ENVIRONMENT_ID_TEST;
const serviceIdTest = process.argv[4] || process.env.RAILWAY_SERVICE_ID_TEST;

if (!environmentIdTest || !serviceIdTest) {
  console.error(`
❌ Missing required arguments:

Usage:
  bun run setup-github-secrets.mjs <ENVIRONMENT_ID> <SERVICE_ID>

Or set environment variables:
  RAILWAY_ENVIRONMENT_ID_TEST=xxx
  RAILWAY_SERVICE_ID_TEST=yyy
  bun run setup-github-secrets.mjs

Example:
  bun run setup-github-secrets.mjs abc123def456 xyz789abc

Get these values from Railway:
  1. Open https://railway.app
  2. Go to your Talea project
  3. Select TEST environment
  4. Click backend service
  5. Copy IDs from URL and service details
  `);
  process.exit(1);
}

const setup = new GitHubSecretsSetup(repo, environmentIdTest, serviceIdTest);
setup.setup();
