#!/usr/bin/env node

/**
 * Automated Railway Test Environment Setup
 *
 * This script automates the complete setup of the test-main deployment pipeline:
 * 1. Creates TEST environment on Railway
 * 2. Creates PostgreSQL database for testing
 * 3. Sets up backend service (Encore)
 * 4. Sets up frontend service (React)
 * 5. Configures environment variables
 * 6. Generates GitHub Secrets for automation
 *
 * Prerequisites:
 * - Railway API token (set RAILWAY_API_TOKEN)
 * - Project ID (set RAILWAY_PROJECT_ID)
 * - GitHub token for setting secrets (optional)
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface RailwayConfig {
  apiToken: string;
  projectId: string;
  githubRepo: string;
  repositoryId: string;
}

class RailwayTestSetup {
  private config: RailwayConfig;

  constructor(config: RailwayConfig) {
    this.config = config;
  }

  async log(title: string, message: string) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🚀 ${title}`);
    console.log(`${'═'.repeat(60)}`);
    console.log(message);
  }

  async runCommand(command: string, description: string): Promise<string> {
    console.log(`\n📍 ${description}`);
    console.log(`   Command: ${command}`);
    try {
      const { stdout, stderr } = await execAsync(command);
      if (stderr) console.warn(`   ⚠️  ${stderr}`);
      if (stdout) console.log(`   ✅ ${stdout.trim().substring(0, 100)}`);
      return stdout.trim();
    } catch (error) {
      console.error(`   ❌ Error: ${error}`);
      throw error;
    }
  }

  async queryRailwayGraphQL(query: string, variables?: Record<string, any>) {
    const body = JSON.stringify({
      query,
      variables: variables || {},
    });

    const response = await fetch('https://backboard.railway.com/graphql/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiToken}`,
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`Railway API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.errors) {
      console.error('Railway API Errors:', data.errors);
      throw new Error(`GraphQL error: ${data.errors.map((e: any) => e.message).join('; ')}`);
    }

    return data.data;
  }

  async createTestEnvironment() {
    await this.log(
      'STEP 1: Create TEST Environment',
      'Creating isolated test environment on Railway...'
    );

    const query = `
      mutation CreateEnvironment($input: CreateEnvironmentInput!) {
        environmentCreate(input: $input) {
          id
          name
        }
      }
    `;

    try {
      const result = await this.queryRailwayGraphQL(query, {
        input: {
          projectId: this.config.projectId,
          name: 'test',
        },
      });

      const environmentId = result.environmentCreate.id;
      console.log(`✅ TEST Environment created: ${environmentId}`);
      return environmentId;
    } catch (error) {
      console.error('Failed to create environment:', error);
      throw error;
    }
  }

  async createPostgreSQLDatabase(environmentId: string) {
    await this.log(
      'STEP 2: Create Test PostgreSQL Database',
      'Setting up isolated test database...'
    );

    const query = `
      mutation ServiceCreate($input: ServiceCreateInput!) {
        serviceCreate(input: $input) {
          id
          name
        }
      }
    `;

    try {
      const result = await this.queryRailwayGraphQL(query, {
        input: {
          environmentId,
          name: 'talea-postgres-test',
          source: {
            type: 'postgres',
          },
        },
      });

      const serviceId = result.serviceCreate.id;
      console.log(`✅ PostgreSQL TEST database created: ${serviceId}`);
      return serviceId;
    } catch (error) {
      console.error('Failed to create database:', error);
      throw error;
    }
  }

  async createBackendService(environmentId: string) {
    await this.log(
      'STEP 3: Create Backend Service (Encore)',
      'Setting up automated backend deployment...'
    );

    const query = `
      mutation ServiceCreate($input: ServiceCreateInput!) {
        serviceCreate(input: $input) {
          id
          name
        }
      }
    `;

    try {
      const result = await this.queryRailwayGraphQL(query, {
        input: {
          environmentId,
          name: 'talea-backend-test',
          source: {
            type: 'github',
            repo: this.config.githubRepo,
            branch: 'test-main',
            rootDirectory: 'backend',
          },
        },
      });

      const serviceId = result.serviceCreate.id;
      console.log(`✅ Backend TEST service created: ${serviceId}`);
      return serviceId;
    } catch (error) {
      console.error('Failed to create backend service:', error);
      throw error;
    }
  }

  async createFrontendService(environmentId: string) {
    await this.log(
      'STEP 4: Create Frontend Service (React)',
      'Setting up automated frontend deployment...'
    );

    const query = `
      mutation ServiceCreate($input: ServiceCreateInput!) {
        serviceCreate(input: $input) {
          id
          name
        }
      }
    `;

    try {
      const result = await this.queryRailwayGraphQL(query, {
        input: {
          environmentId,
          name: 'talea-frontend-test',
          source: {
            type: 'github',
            repo: this.config.githubRepo,
            branch: 'test-main',
            rootDirectory: 'frontend',
          },
        },
      });

      const serviceId = result.serviceCreate.id;
      console.log(`✅ Frontend TEST service created: ${serviceId}`);
      return serviceId;
    } catch (error) {
      console.error('Failed to create frontend service:', error);
      throw error;
    }
  }

  async setEnvironmentVariables(
    serviceId: string,
    variables: Record<string, string>,
    environmentId: string
  ) {
    await this.log(
      'STEP 5: Configure Environment Variables',
      `Setting up ${Object.keys(variables).length} variables...`
    );

    const query = `
      mutation VariableCreate($input: VariableCreateInput!) {
        variableCreate(input: $input) {
          id
          name
          value
        }
      }
    `;

    for (const [key, value] of Object.entries(variables)) {
      try {
        await this.queryRailwayGraphQL(query, {
          input: {
            serviceId,
            environmentId,
            name: key,
            value,
          },
        });
        console.log(`✅ ${key} = ***`);
      } catch (error) {
        console.error(`Failed to set ${key}:`, error);
      }
    }
  }

  async printSummary(environmentId: string, backendServiceId: string, frontendServiceId: string) {
    await this.log(
      'SETUP COMPLETE! 🎉',
      `
Your test environment is ready. Here's what was created:

TEST Environment Details:
  Environment ID: ${environmentId}
  Backend Service ID: ${backendServiceId}
  Frontend Service ID: ${frontendServiceId}

Next Steps:
  1. Add these GitHub Secrets:
     - RAILWAY_ENVIRONMENT_ID_TEST = ${environmentId}
     - RAILWAY_SERVICE_ID_TEST = ${backendServiceId}

  2. Push to test-main branch:
     git push origin test-main

  3. GitHub Actions will automatically:
     ✅ Build Docker image
     ✅ Deploy to test environment
     ✅ Make available at talea-test.up.railway.app

  4. Test your features, then merge to main when ready!

Configuration Files Created:
  ✅ .github/workflows/deploy-railway-test.yml
  ✅ scripts/trigger-railway-deploy-test.mjs
  ✅ railway.test.toml
  ✅ RAILWAY_TEST_SETUP.md

Railway Dashboard: https://railway.app/project/${this.config.projectId}/environment/${environmentId}
    `
    );
  }

  async setup() {
    try {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║   🚀 Railway Test Environment Automated Setup              ║
║   Setting up test-main → talea-test.up.railway.app         ║
╚════════════════════════════════════════════════════════════╝
      `);

      // Step 1: Create environment
      const environmentId = await this.createTestEnvironment();

      // Step 2: Create database
      const databaseServiceId = await this.createPostgreSQLDatabase(environmentId);

      // Step 3: Create backend service
      const backendServiceId = await this.createBackendService(environmentId);

      // Step 4: Create frontend service
      const frontendServiceId = await this.createFrontendService(environmentId);

      // Step 5: Configure environment variables for backend
      await this.setEnvironmentVariables(
        backendServiceId,
        {
          PORT: '8080',
          ENVIRONMENT: 'test',
          NODE_ENV: 'production',
          // Add more as needed based on your setup
        },
        environmentId
      );

      // Step 6: Configure environment variables for frontend
      await this.setEnvironmentVariables(
        frontendServiceId,
        {
          NODE_ENV: 'production',
        },
        environmentId
      );

      // Print summary
      await this.printSummary(environmentId, backendServiceId, frontendServiceId);
    } catch (error) {
      console.error('\n❌ Setup failed:', error);
      process.exit(1);
    }
  }
}

// Main
const apiToken = process.env.RAILWAY_API_TOKEN;
const projectId = process.env.RAILWAY_PROJECT_ID;
const githubRepo = process.env.RAILWAY_GITHUB_REPO || 'dschilow/talea-storytelling-platform';
const repositoryId = process.env.RAILWAY_REPOSITORY_ID || '';

if (!apiToken || !projectId) {
  console.error(`
❌ Missing required environment variables:

   RAILWAY_API_TOKEN=your_token
   RAILWAY_PROJECT_ID=your_project_id

Get these from: https://railway.app/account/tokens

Then run:
   RAILWAY_API_TOKEN=... RAILWAY_PROJECT_ID=... bun run setup-railway-test-env.ts
  `);
  process.exit(1);
}

const setup = new RailwayTestSetup({
  apiToken,
  projectId,
  githubRepo,
  repositoryId,
});

setup.setup().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
