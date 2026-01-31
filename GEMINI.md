# Talea - AI Storytelling Platform

## Project Overview

This is an AI-powered storytelling platform where avatars with evolving personalities create unique, personalized stories.

**Technologies:**

*   **Backend:** Encore.ts (TypeScript)
*   **Frontend:** React (TypeScript)
*   **Authentication:** Clerk
*   **Database:** PostgreSQL
*   **AI:** OpenAI GPT

**Architecture:**

The project is a monorepo with a `backend` and `frontend` workspace. The backend is built with Encore.ts and the frontend is a React application built with Vite.

## Building and Running

### Local Development

**1. Run the Backend:**

```bash
cd backend
encore run
```

The backend will be available at `http://localhost:4000`.

**2. Run the Frontend:**

```bash
cd frontend
bun install
npm run dev
```

The frontend will be available at `http://localhost:5173`.

### Building for Production

To build the frontend for production, run the following command in the `frontend` directory:

```bash
npm run build
```

The backend's build process will automatically include the built frontend.

## Development Conventions

*   This project uses `bun` as the package manager.
*   The backend and frontend are in separate workspaces.
*   The backend is built with Encore.ts, and the frontend is a standard Vite/React application.
*   Authentication is handled by Clerk.
*   Database migrations are managed by Encore.
*   Pub/Sub is used for event-driven analytics and logging.

## User Preferences

*   **Language**: ALWAYS respond in German unless explicitly asked otherwise.
*   **TTS Integration**:
    *   TTS Service: Piper (Thorsten Voice) via `tts-service` Docker container.
    *   Deployment: Railway (Docker + Encore Backend).
    *   Default Speed: 1.1 (Slower).

