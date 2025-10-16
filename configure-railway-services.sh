#!/bin/bash
# Script to configure Railway services via GraphQL API
# Usage: Set RAILWAY_TOKEN, BACKEND_SERVICE_ID, NSQ_SERVICE_ID, FRONTEND_SERVICE_ID environment variables

set -e

if [ -z "$RAILWAY_TOKEN" ]; then
  echo "Error: RAILWAY_TOKEN not set"
  exit 1
fi

# Function to update service source to Image Registry
update_backend_to_image() {
  local SERVICE_ID=$1
  local IMAGE=$2

  echo "Configuring Backend Service to use Image Registry: $IMAGE"

  curl -X POST https://api.railway.app/graphql/v2 \
    -H "Authorization: Bearer $RAILWAY_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"query\": \"mutation {
        serviceUpdate(
          id: \\\"$SERVICE_ID\\\",
          input: {
            source: {
              image: \\\"$IMAGE\\\"
            }
          }
        ) {
          id
          name
        }
      }\"
    }"
}

# Function to update service to use Dockerfile
update_to_dockerfile() {
  local SERVICE_ID=$1
  local DOCKERFILE_PATH=$2

  echo "Configuring Service $SERVICE_ID to use Dockerfile: $DOCKERFILE_PATH"

  curl -X POST https://api.railway.app/graphql/v2 \
    -H "Authorization: Bearer $RAILWAY_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"query\": \"mutation {
        serviceUpdate(
          id: \\\"$SERVICE_ID\\\",
          input: {
            source: {
              repo: {
                branch: \\\"main\\\",
                dockerfilePath: \\\"$DOCKERFILE_PATH\\\"
              }
            }
          }
        ) {
          id
          name
        }
      }\"
    }"
}

# Configure Backend Service to use GHCR image
if [ -n "$BACKEND_SERVICE_ID" ]; then
  update_backend_to_image "$BACKEND_SERVICE_ID" "ghcr.io/dschilow/talea-storytelling-platform:latest"
fi

# Configure NSQ Service to use Dockerfile
if [ -n "$NSQ_SERVICE_ID" ]; then
  update_to_dockerfile "$NSQ_SERVICE_ID" "Dockerfile.nsq"
fi

# Configure Frontend Service to use Dockerfile
if [ -n "$FRONTEND_SERVICE_ID" ]; then
  update_to_dockerfile "$FRONTEND_SERVICE_ID" "Dockerfile.frontend"
fi

echo "Railway services configured successfully!"
