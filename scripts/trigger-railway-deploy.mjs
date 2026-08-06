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
      // serviceInstanceDeployV2, NOT serviceInstanceRedeploy. The latter replays
      // the previous deployment together with the image it was built from, so
      // it never picks up a changed source. That is why production kept
      // serving ':test-main' from 2026-07-28 to 2026-08-06 after its source had
      // been corrected to ':latest' — every redeploy faithfully re-ran the same
      // digest and reported success. V2 creates a new deployment from the
      // source the service is currently configured with.
      //
      // The plain `serviceInstanceDeploy` this replaced is no longer part of
      // the Railway schema at all, so the call failed with "Cannot query field"
      // and no push to main reached production between those two dates.
      // It returns the new deployment's id (String!), which is logged below so
      // a run can be traced back to a specific deployment.
      query: `mutation ServiceInstanceDeployV2($environmentId: String!, $serviceId: String!) {
  serviceInstanceDeployV2(environmentId: $environmentId, serviceId: $serviceId)
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
    throw new Error(`Railway deploy failed: ${message}`);
  }

  const deploymentId = body.data?.serviceInstanceDeployV2;
  if (!deploymentId) {
    throw new Error(
      'Railway deploy returned no deployment id. The mutation reported no error, '
      + 'so treat this as "nothing was deployed" rather than success.'
    );
  }

  console.log(`Railway deployment triggered successfully: ${deploymentId}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
