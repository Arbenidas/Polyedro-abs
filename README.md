# Polyedro-abs

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines Next.js, Hono, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **Next.js** - Full-stack React framework
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **Hono** - Lightweight, performant server framework
- **Node.js** - Runtime environment
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
pnpm install
```

Then, run the development server:

```bash
pnpm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the web application.
The API is running at [http://localhost:3000](http://localhost:3000).

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@Polyedro-abs/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Project Structure

```
Polyedro-abs/
├── apps/
│   ├── web/         # Frontend application (Next.js)
│   └── server/      # Backend API (Hono)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
```

## Available Scripts

- `pnpm run dev`: Start all applications in development mode
- `pnpm run build`: Build all applications
- `pnpm run dev:web`: Start only the web application
- `pnpm run dev:server`: Start only the server
- `pnpm run check-types`: Check TypeScript types across all apps

## Deployment

- **Web (`apps/web`)** → Netlify (`netlify.toml`, `base = "apps/web"`). Set `NEXT_PUBLIC_SERVER_URL` (the deployed API origin) plus `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Site settings → Environment variables.
- **Server (`apps/server`)** → Railway, config-as-code in `railway.json` (build `pnpm install --frozen-lockfile && pnpm --filter server build`, start `pnpm --filter server start`, healthcheck `/`).

> **Single instance, always on.** The server keeps campaign progress in an in-memory, per-process bus (`apps/server/src/api/services/progress.ts`) and streams it over SSE. Railway is configured for **one replica with sleep disabled** (`numReplicas: 1`, `sleepApplication: false`). Do **not** enable horizontal autoscaling or scale-to-zero until the bus is moved to a shared store (e.g. Redis pub/sub) — otherwise SSE clients can connect to an instance that never sees the events.

Required server env vars (validated at boot in `packages/env/src/server.ts`): `CORS_ORIGIN` (the web origin), `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`. Optional: `DIRECT_URL`, `OPENAI_API_KEY` (+ image-provider keys), `NODE_ENV`. `PORT` is injected by the platform. See `apps/server/.env.example`.
