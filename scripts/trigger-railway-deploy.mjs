#!/usr/bin/env node

const API_URL = 'https://backboard.railway.com/graphql/v2';

async function main() {
  const {
    RAILWAY_API_TOKEN: token,
    RAILWAY_ENVIRONMENT_ID: environmentId,
    RAILWAY_SERVICE_ID: serviceId,
  } = process.env;

  // A missing secret used to return quietly with exit code 0. Combined with
  // `continue-on-error` on the calling step that made the whole pipeline lie:
  // production ran a stale image from 2026-07-28 to 2026-07-31 while every run
  // on main reported success, because "image pushed to ghcr.io" was the only
  // thing actually being verified. Fail loudly instead — a build nobody
  // deploys is a failed build.
  const missing = [
    ['RAILWAY_API_TOKEN', token],
    ['RAILWAY_ENVIRONMENT_ID', environmentId],
    ['RAILWAY_SERVICE_ID', serviceId],
  ].filter(([, value]) => !value).map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `Railway redeploy cannot run: missing ${missing.join(', ')}. `
      + 'Set the secret(s) in the repository settings, or remove this step if the '
      + 'service is intentionally deployed by hand.'
    );
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
