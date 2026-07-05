import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

import { ApiError, requireOne } from "@/api/shared";
import { brands, campaigns, creativeAssets, socialPosts, users } from "@/db/schema";
import { applyMigrations, resetDb, testDb } from "@/test/db";

// Los servicios importan `db` desde @/db; lo apuntamos a la instancia PGlite.
vi.mock("@/db", async () => {
  const { testDb } = await import("@/test/db");
  return { db: testDb };
});

vi.mock("@Polyedro-abs/env/server", () => ({
  env: { FB_PAGE_ID: "test-page-id", FB_PAGE_ACCESS_TOKEN: "test-token" },
}));

const {
  createPost,
  fireDueScheduledPosts,
  listCampaignPosts,
  publishPost,
  reschedulePost,
  runPublishWorkflow,
  updatePost,
} = await import("@/api/services/social-post");

let seedCounter = 0;

const seedCampaignWithAsset = async () => {
  seedCounter += 1;
  const user = requireOne(
    (await testDb
      .insert(users)
      .values({ email: `owner-${seedCounter}@test.dev`, name: "Owner" })
      .returning())[0],
    "seed user",
  );

  const brand = requireOne(
    (await testDb
      .insert(brands)
      .values({ userId: user.id, name: "NovaGear Tech", status: "approved" })
      .returning())[0],
    "seed brand",
  );

  const campaign = requireOne(
    (await testDb
      .insert(campaigns)
      .values({
        brandId: brand.id,
        name: "NovaGear Earbuds Launch",
        objective: "Sell more earbuds",
        status: "ready_to_publish",
      })
      .returning())[0],
    "seed campaign",
  );

  const creativeAsset = requireOne(
    (await testDb
      .insert(creativeAssets)
      .values({
        campaignId: campaign.id,
        variant: "a",
        status: "approved",
        imageUrl: "https://storage.test/generated-assets/creative-a.png",
      })
      .returning())[0],
    "seed creative asset",
  );

  return { user, brand, campaign, creativeAsset };
};

const fetchJson = (body: unknown, ok = true) =>
  vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 400,
    json: async () => body,
  });

beforeAll(async () => {
  await applyMigrations();
});

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("createPost", () => {
  it("creates a draft post when scheduledAt is not set", async () => {
    const seed = await seedCampaignWithAsset();

    const post = await createPost(seed.campaign.id, {
      creativeAssetId: seed.creativeAsset.id,
      caption: "Launching soon!",
      scheduledAt: null,
    });

    expect(post.status).toBe("draft");
    expect(post.caption).toBe("Launching soon!");
  });

  it("creates a scheduled post when scheduledAt is in the future", async () => {
    const seed = await seedCampaignWithAsset();
    const future = new Date(Date.now() + 60_000);

    const post = await createPost(seed.campaign.id, {
      creativeAssetId: seed.creativeAsset.id,
      caption: "Launching soon!",
      scheduledAt: future,
    });

    expect(post.status).toBe("scheduled");
    expect(post.scheduledAt?.getTime()).toBe(future.getTime());
  });

  it("rejects a creative asset that does not belong to the campaign", async () => {
    const seed = await seedCampaignWithAsset();
    const other = await seedCampaignWithAsset();

    await expect(
      createPost(seed.campaign.id, {
        creativeAssetId: other.creativeAsset.id,
        caption: "Launching soon!",
        scheduledAt: null,
      }),
    ).rejects.toThrow(ApiError);
  });
});

describe("updatePost / reschedulePost", () => {
  it("rejects updates once the post is no longer draft/scheduled", async () => {
    const seed = await seedCampaignWithAsset();
    const post = await createPost(seed.campaign.id, {
      creativeAssetId: seed.creativeAsset.id,
      caption: "Launching soon!",
      scheduledAt: null,
    });
    await testDb.update(socialPosts).set({ status: "published" }).where(eq(socialPosts.id, post.id));

    await expect(
      updatePost(seed.campaign.id, post.id, { caption: "Edited" }),
    ).rejects.toThrow(ApiError);
  });

  it("rejects rescheduling to a past date", async () => {
    const seed = await seedCampaignWithAsset();
    const post = await createPost(seed.campaign.id, {
      creativeAssetId: seed.creativeAsset.id,
      caption: "Launching soon!",
      scheduledAt: null,
    });

    await expect(
      reschedulePost(seed.campaign.id, post.id, new Date(Date.now() - 60_000)),
    ).rejects.toThrow(ApiError);
  });

  it("moves a post back to draft when scheduledAt is cleared", async () => {
    const seed = await seedCampaignWithAsset();
    const post = await createPost(seed.campaign.id, {
      creativeAssetId: seed.creativeAsset.id,
      caption: "Launching soon!",
      scheduledAt: new Date(Date.now() + 60_000),
    });

    const updated = await reschedulePost(seed.campaign.id, post.id, null);

    expect(updated.status).toBe("draft");
    expect(updated.scheduledAt).toBeNull();
  });
});

describe("publishPost / runPublishWorkflow", () => {
  it("marks the post as publishing immediately", async () => {
    const seed = await seedCampaignWithAsset();
    const post = await createPost(seed.campaign.id, {
      creativeAssetId: seed.creativeAsset.id,
      caption: "Launching soon!",
      scheduledAt: null,
    });

    const publishing = await publishPost(seed.campaign.id, post.id);

    expect(publishing.status).toBe("publishing");
  });

  it("marks the post published with the Graph API post id on success", async () => {
    vi.stubGlobal("fetch", fetchJson({ id: "17895695668004550" }));
    const seed = await seedCampaignWithAsset();
    const post = await createPost(seed.campaign.id, {
      creativeAssetId: seed.creativeAsset.id,
      caption: "Launching soon!",
      scheduledAt: null,
    });

    await runPublishWorkflow({ ...post, status: "publishing" });

    const updated = await testDb.query.socialPosts.findFirst({ where: eq(socialPosts.id, post.id) });
    expect(updated?.status).toBe("published");
    expect(updated?.externalPostId).toBe("17895695668004550");
    expect(updated?.errorMessage).toBeNull();
  });

  it("marks the post failed with the Graph API error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      fetchJson({ error: { message: "Invalid OAuth access token" } }, false),
    );
    const seed = await seedCampaignWithAsset();
    const post = await createPost(seed.campaign.id, {
      creativeAssetId: seed.creativeAsset.id,
      caption: "Launching soon!",
      scheduledAt: null,
    });

    await runPublishWorkflow({ ...post, status: "publishing" });

    const updated = await testDb.query.socialPosts.findFirst({ where: eq(socialPosts.id, post.id) });
    expect(updated?.status).toBe("failed");
    expect(updated?.errorMessage).toBe("Invalid OAuth access token");
  });
});

describe("fireDueScheduledPosts", () => {
  it("publishes due posts and leaves future ones untouched", async () => {
    vi.stubGlobal("fetch", fetchJson({ id: "due-post-id" }));
    const seed = await seedCampaignWithAsset();

    const due = await createPost(seed.campaign.id, {
      creativeAssetId: seed.creativeAsset.id,
      caption: "Due now",
      scheduledAt: new Date(Date.now() + 60_000),
    });
    await testDb
      .update(socialPosts)
      .set({ scheduledAt: new Date(Date.now() - 60_000) })
      .where(eq(socialPosts.id, due.id));

    const future = await createPost(seed.campaign.id, {
      creativeAssetId: seed.creativeAsset.id,
      caption: "Not due yet",
      scheduledAt: new Date(Date.now() + 60 * 60_000),
    });

    await fireDueScheduledPosts();

    const posts = await listCampaignPosts(seed.campaign.id);
    const duePost = posts.find((p) => p.id === due.id);
    const futurePost = posts.find((p) => p.id === future.id);

    expect(duePost?.status).toBe("published");
    expect(futurePost?.status).toBe("scheduled");
  });
});
