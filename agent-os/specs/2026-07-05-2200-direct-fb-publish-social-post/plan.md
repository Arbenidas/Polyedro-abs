# Port direct-fb-publish into Polyedro-abs-main

> Implementation prompt/spec. Not yet executed — work starts in a later session. When picking this up: `cd /home/braker/Polyedro-abs-main`, checkout `main`, branch `direct-fb-publish` from it, implement everything below, then commit and push `direct-fb-publish` (never touch `main`).

## Context

Two repos are clones of the same GitHub repo (`Arbenidas/Polyedro-abs.git`):
- `/home/braker/Polyedro-ads`, branch `direct-fb-publish` — an early prototype that added direct Meta Graph API publishing (SQLite/better-sqlite3, no auth, standalone `posts` table, local-disk file uploads, node-cron scheduler, calendar UI).
- `/home/braker/Polyedro-abs-main`, branch `main` — the real, actively developed product (Postgres via Supabase, Supabase-authenticated multi-tenant API, brand → campaign → {strategy, ad_copies, creative_assets, video_scripts, voiceovers} pipeline, a single-page "LabsApp" dashboard, and a partially-built n8n → Meta Ads export that stops at "transform payload" and never actually calls the Graph API — see `docs/n8n/README.md`, "Fase 2: not yet implemented").

Both branches share a common ancestor (`6cb7f30`) but diverged onto **incompatible architectures** (SQLite vs. Postgres, no auth vs. Supabase JWT auth, flat unscoped routes vs. brand/campaign-owned routes). A `git merge` between them is not viable — it would merge two different databases and would leave broken, unauthenticated code. This is a **feature port/reimplementation**, not a merge.

Decisions (confirmed with the user):
- New posts are tied to an existing **campaign** (and its `creative_assets`), completing the unfinished Meta Ads export pipeline, rather than a standalone entity.
- Posts publish existing `creative_assets` (already in Supabase Storage) — no new file-upload endpoint, no local disk (Railway's filesystem is ephemeral anyway).
- This becomes the real implementation of "Fase 2" of the Meta Ads export docs (actual Graph API call), not a second parallel system.
- All edits use files/conventions from `main`, but the branch worked on and pushed is `direct-fb-publish`; `main` itself is never modified.

Given the architectures don't share reusable code, the port keeps only the **working logic** from the old branch — the Graph API call, the scheduling logic — and rebuilds everything else (schema, routes, UI) to match `main`'s existing conventions exactly.

## Scope simplification

The old branch scaffolded 4 platforms (Facebook/Instagram/TikTok/LinkedIn) but only Facebook was ever really implemented (others were `mockPublish` stubs). Per "don't modify anything extra or not needed," the port targets **Facebook only** — single status field, no platform array/JSON blob. Multi-platform can be added later as a real enum value + branch in the publish function.

## Backend changes (apps/server)

**Schema** — add to `apps/server/src/db/schema/index.ts` (main keeps one schema file, unlike the old repo's split `schema/posts.ts`):
```ts
export const socialPostStatusEnum = pgEnum("social_post_status", [
  "draft", "scheduled", "publishing", "published", "failed",
]);

export const socialPosts = pgTable("social_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  creativeAssetId: uuid("creative_asset_id").notNull().references(() => creativeAssets.id, { onDelete: "restrict" }),
  caption: text("caption").notNull(),
  status: socialPostStatusEnum("status").notNull().default("draft"),
  scheduledAt: timestamp("scheduled_at"),
  publishedAt: timestamp("published_at"),
  externalPostId: text("external_post_id"),
  errorMessage: text("error_message"),
  ...timestamps,
}, (table) => [index("social_posts_campaign_id_idx").on(table.campaignId)]).enableRLS();
```
Add `campaign`/`creativeAsset` relations and `socialPosts: many(socialPosts)` onto `campaignsRelations`/`creativeAssetsRelations`, following the existing relations block style. Generate the migration with `pnpm --filter server db:generate` (reads schema, writes SQL under `apps/server/src/db/migrations`; does not need a live DB).

**Env** — add to `packages/env/src/server.ts`: `FB_PAGE_ID: z.string().min(1).optional()`, `FB_PAGE_ACCESS_TOKEN: z.string().min(1).optional()` (optional so the app boots without them; the publish call throws a clear error if missing, same as the old code). No `DATABASE_URL` change needed — main is Postgres-only already.

**Service** — new `apps/server/src/api/services/social-post.ts`, modeled on `campaign.ts`'s style (`ApiError`, `requireOne`, ownership checks):
- `listCampaignPosts(campaignId)`, `createPost`, `updatePost`, `reschedulePost` — same validation rules as the old `lib/posts.ts`/`routes/posts.ts` (only draft/scheduled posts can be edited/rescheduled; `scheduledAt` in the future ⇒ status `scheduled`, else `draft`).
- `publishPost(postId)`: loads the post + its `creativeAsset.imageUrl` (already a public Supabase URL), calls the Meta Graph API. Because the asset URL is already remote, the old code's local-file/`FormData`/`Blob` branch is dropped entirely — this becomes a plain `fetch` with `URLSearchParams({ url, caption, access_token })` POST to `https://graph.facebook.com/v19.0/{FB_PAGE_ID}/photos`. On success: `status: published`, `externalPostId`; on failure: `status: failed`, `errorMessage`. This is the direct port of the one piece of real "working logic" from the old branch (`apps/server/src/lib/posts.ts`'s `publishToFacebook`).
- `fireDueScheduledPosts()`: same due-post claim query as old `jobs/scheduler.ts` (`status = scheduled AND scheduledAt <= now`, atomic claim via conditional update), ported to the async postgres client (already async, no `db.get`/sync calls to adapt).

**Job** — new `apps/server/src/jobs/scheduler.ts`: `node-cron`, `startScheduledPublishJob()` runs `fireDueScheduledPosts` every minute, started from `apps/server/src/index.ts` alongside existing wiring. Requires adding the `node-cron` dependency to `apps/server/package.json` (the only new runtime dependency this feature needs — no `better-sqlite3`, no other old-stack tooling).

**Routes** — new `apps/server/src/api/routes/social-post.ts`, flat convention like `campaign.ts`, reusing `requireCampaignOwnership`/`parseBody`/`parseUuidParam` from `@/api/shared` and `@/api/services/campaign`:
- `GET /campaigns/:campaignId/posts`, `POST /campaigns/:campaignId/posts`, `PATCH /posts/:id`, `PATCH /posts/:id/schedule`, `POST /posts/:id/publish` — same 5 operations as the old routes, now ownership-checked and mounted under `/api` (so `requireAuth` applies). Register in `apps/server/src/api/routes/index.ts`.

**Tests** — `apps/server/src/api/services/social-post.test.ts`, following `campaign.test.ts`'s exact harness (`vi.mock("@/db", ...)` → PGlite `testDb`, `applyMigrations`/`resetDb`, mock `global.fetch` for the Graph API call instead of hitting the network). Covers: create → publish (success + failure), reschedule rules, and the due-post scheduler query. This gives real end-to-end verification without needing live Meta/Supabase credentials.

## Frontend changes (apps/web)

`LabsApp` (`apps/web/src/components/labs/labs-app.tsx`) is a single hand-rolled component (no router, no shared UI-kit usage, no Context — plain `useState` + prop drilling), navigated via a `View` string union (`defs.ts`) and a sidebar `NAV_DEFS`. The port follows this exactly rather than introducing new UI primitives (no `Dialog`/`Table`/`Badge` — those don't exist anywhere in this app and aren't needed here):

- `apps/web/src/lib/api.ts`: add `SocialPost` type + `listCampaignPosts`, `createSocialPost`, `updateSocialPost`, `reschedulePost`, `publishPost`, all via the existing `apiFetch` helper (already attaches the Supabase bearer token).
- `apps/web/src/components/labs/defs.ts`: add `"publish"` to the `View` union and a `NAV_DEFS` entry, next to `campaign`/`brandkit`/`agents`/`automation`.
- New `apps/web/src/components/labs/publish-view.tsx`, modeled on `campaign-view.tsx`'s `AssetCard` pattern: lists the current campaign's approved `creative_assets`; each has an inline expand (no modal) with a caption textarea (prefilled from the matching `ad_copies` entry when available) and a native `<input type="datetime-local">` for optional scheduling, plus "Publicar ahora"/"Programar" actions. Below, a list of the campaign's existing posts with a status chip (reusing `STATUS_STYLE`/chip styling already in `campaign-view.tsx`) and "Reprogramar" per row — this is the direct equivalent of the old calendar/posts pages, scoped to the campaign like every other view in this app already is.
- Wire the new callbacks in `labs-app.tsx` the same way `approve`/`regen`/`pushToMetaAds` are wired today, and render `PublishView` when `view === "publish"`.

## Docs

Fold a short new section into the existing `docs/features.md` (new "F-Publish" block, matching its existing table format) and `docs/api.md` (new endpoints). Do not port the old repo's standalone docs (`direct-publish.md`, `scheduled-publishing.md`, etc.) verbatim — they describe the SQLite architecture and would be misleading here.

## Git workflow

1. In `/home/braker/Polyedro-abs-main`: `git checkout main && git pull`, then `git checkout -b direct-fb-publish`. All work happens on this branch; `main` is never touched.
2. Implement schema → env → service → job → routes → tests → frontend → docs, in that order (each layer buildable/typecheckable before the next depends on it).
3. `pnpm install` (adds `node-cron` to the lockfile — the only install this task needs; nothing from the old SQLite stack).
4. `pnpm --filter server db:generate` for the migration.
5. Verify: `pnpm --filter server check-types`, `pnpm --filter web check-types`, `pnpm --filter server test` (new PGlite-backed test), `pnpm --filter server build`, `pnpm --filter web build`. No live Supabase/Meta credentials exist in this environment, so full live E2E (real server boot + real Graph API call) isn't possible here — the PGlite test plus a mocked-fetch publish test is the closest real verification available; say so explicitly rather than claim a live smoke test.
6. Commit on `direct-fb-publish` (logical commits per layer, or one — confirm with the user at commit time).
7. **Callout:** the shared repo already has a stale `direct-fb-publish` branch (old SQLite commits, tip `e40edf0`). Since the new branch is freshly cut from `main` rather than merged, pushing it will require `git push --force-with-lease origin direct-fb-publish` (not a fast-forward). Confirm with the user again at that exact moment before force-pushing, since it overwrites a shared branch.

## Reference facts gathered during investigation (for whoever resumes this)

- Origin remote for both repos: `https://github.com/Arbenidas/Polyedro-abs.git`. Merge-base of `main` and the old `direct-fb-publish`: commit `6cb7f30`.
- Old branch touched 40 files (~2728 insertions); of those, 12 files also changed on `main` since the fork (`.gitignore`, `README.md`, both `.env.example`s, both `package.json`s, `apps/server/src/db/schema/index.ts`, `apps/server/src/index.ts`, `apps/web/src/lib/api.ts`, `packages/env/src/server.ts`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`) — confirming real architectural overlap/conflict, not just additive files.
- Old DB client: `apps/server/src/db/index.ts` used `better-sqlite3` + `drizzle-orm/better-sqlite3`. Main uses `postgres` + `drizzle-orm/postgres-js` against Supabase.
- Old routes mounted unauthenticated at root (`/media`, `/posts`); main requires Supabase JWT auth on everything under `/api/*` via `apps/server/src/middleware/auth.ts`'s `requireAuth`, with ownership resolved per-request by joining up to `brands.userId` (see `requireCampaignOwnership` in `apps/server/src/api/services/campaign.ts:132`).
- Main has zero user-upload endpoints; all media is AI-generated and stored via `apps/server/src/api/services/storage.ts`'s `uploadGeneratedAsset` (Supabase Storage bucket `generated-assets`).
- Existing (incomplete) Meta Ads export: `POST /campaigns/:campaignId/meta-ads/export` → `exportCampaignToMetaAds` (`apps/server/src/api/services/campaign.ts:462`) → `dispatchCampaignExport` (`apps/server/src/api/services/n8n.ts`) → n8n webhook that only transforms/returns a payload, per `docs/n8n/README.md`. UI trigger: "Publicar en Meta Ads" button in `labs-app.tsx:1004-1025`.
- `apps/server` has a real test harness: PGlite in-process Postgres at `apps/server/src/test/db.ts` (`applyMigrations`/`resetDb`/`testDb`), used by `apps/server/src/api/services/campaign.test.ts` — mocks `@/db` to point at PGlite and mocks external calls (e.g. `@/api/services/n8n`). The new social-post tests should follow this exact pattern, mocking `global.fetch` for the Graph API call.
- `packages/ui/src/components/` has `button/card/checkbox/dropdown-menu/input/label/tooltip/...` but the dashboard (`LabsApp`) doesn't use them — it hand-rolls its own neobrutalist styling from `apps/web/src/components/labs/defs.ts`. No dialog/modal/date-picker exists anywhere in `apps/web`. Build the new UI consistent with `campaign-view.tsx`'s own local patterns, not `packages/ui`.
