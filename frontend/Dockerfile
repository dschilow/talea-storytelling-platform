FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_BACKEND_URL
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}

ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY}

COPY package*.json ./

RUN npm install

COPY . ./

RUN rm -rf dist
RUN NODE_ENV=production npm run build

FROM nginx:alpine

RUN apk add --no-cache gettext

ARG VITE_BACKEND_URL
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}

ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY}

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf.template

RUN echo "window.ENV = { BACKEND_URL: '${VITE_BACKEND_URL:-http://localhost:4000}', CLERK_PUBLISHABLE_KEY: '${VITE_CLERK_PUBLISHABLE_KEY}' };" > /usr/share/nginx/html/config.js

EXPOSE 8080
ENV PORT=8080

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
