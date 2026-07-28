#!/usr/bin/env node

const API_URL = 'https://backboard.railway.com/graphql/v2';

async function main() {
  const {
    RAILWAY_API_TOKEN: token,
    RAILWAY_ENVIRONMENT_ID_TEST: environmentId,
    RAILWAY_SERVICE_ID_TEST: serviceId,
  } = process.env;

  if (!token || !environmentId || !serviceId) {
    console.log('Railway TEST redeploy skipped: missing RAILWAY_API_TOKEN, RAILWAY_ENVIRONMENT_ID_TEST or RAILWAY_SERVICE_ID_TEST.');
    console.log('ℹ️  To enable automatic TEST deployments:');
    console.log('   1. Set RAILWAY_ENVIRONMENT_ID_TEST in GitHub secrets');
    console.log('   2. Set RAILWAY_SERVICE_ID_TEST in GitHub secrets');
    return;
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query: `mutation ServiceInstanceRedeploy($environmentId: String!, $serviceId: String!) {
  serviceInstanceRedeploy(environmentId: $environmentId, serviceId: $serviceId)
}`,
      variables: {
        environmentId,
        serviceId,
      },
    }),
  });

  const body = await response.json();

  if (!response.ok || body.errors) {
    const message = body.errors?.map((err) => err.message).join('; ') || response.statusText;
    throw new Error(`Railway TEST redeploy failed: ${message}`);
  }

  console.log('🧪 Railway TEST redeploy triggered successfully.');
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
