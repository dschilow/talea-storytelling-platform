#!/usr/bin/env node

const API_URL = 'https://backboard.railway.com/graphql/v2';

async function main() {
  const {
    RAILWAY_API_TOKEN: token,
    RAILWAY_ENVIRONMENT_ID: environmentId,
    RAILWAY_SERVICE_ID: serviceId,
  } = process.env;

  if (!token || !environmentId || !serviceId) {
    console.log('Railway redeploy skipped: missing RAILWAY_API_TOKEN, RAILWAY_ENVIRONMENT_ID or RAILWAY_SERVICE_ID.');
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
    throw new Error(`Railway redeploy failed: ${message}`);
  }

  console.log('Railway redeploy triggered successfully.');
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
