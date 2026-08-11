import { Injectable } from "@angular/core";
import Dexie, { type Table } from "dexie";
import type { CutoutRecord, EditorialTemplate, LibraryAsset, SceneDocument, StorageStatus } from "./editor.models";
import type { ContentProject } from "../content/content.models";
import type { TopicDraft } from "../topic/topic.models";

type StoredAsset = Omit<LibraryAsset, "blob"> & { blob?: Blob };

class PolyedroDatabase extends Dexie {
  scenes!: Table<SceneDocument, string>;
  assets!: Table<StoredAsset, string>;
  templates!: Table<EditorialTemplate, string>;
  contentProjects!: Table<ContentProject, string>;
  cutouts!: Table<CutoutRecord, string>;
  topicDrafts!: Table<TopicDraft, string>;

  constructor() {
    super("polyedro-local-v1");
    this.version(1).stores({
      scenes: "id, projectId, slideId, updatedAt",
      assets: "id, hash, technology, kind, source, lastUsedAt, *tags, *themes",
      templates: "id, family, channel, slideRole, density, style, favorite, *tags",
    });
    this.version(2).stores({
      scenes: "id, projectId, slideId, updatedAt",
      assets: "id, hash, technology, kind, source, lastUsedAt, *tags, *themes",
      templates: "id, family, channel, slideRole, density, style, favorite, source, catalogVersion, recipeId, *tags",
      contentProjects: "id, brandId, status, updatedAt",
    });
    this.version(3).stores({
      scenes: "id, projectId, slideId, updatedAt",
      assets: "id, hash, technology, kind, source, derivedFromAssetId, lastUsedAt, *tags, *themes",
      templates: "id, family, channel, slideRole, density, style, favorite, source, catalogVersion, recipeId, *tags",
      contentProjects: "id, brandId, status, updatedAt",
      cutouts: "outputAssetId, sourceAssetId, updatedAt",
    });
    this.version(4).stores({
      scenes: "id, projectId, slideId, updatedAt",
      assets: "id, hash, technology, kind, source, derivedFromAssetId, lastUsedAt, *tags, *themes",
      templates: "id, family, channel, slideRole, density, style, favorite, source, catalogVersion, recipeId, *tags",
      contentProjects: "id, brandId, status, updatedAt",
      cutouts: "outputAssetId, sourceAssetId, updatedAt",
      topicDrafts: "id, category, createdAt",
    });
  }
}

@Injectable({ providedIn: "root" })
export class LocalLibraryService {
  private readonly db = new PolyedroDatabase();

  async initialize(): Promise<StorageStatus> {
    await this.db.open();
    const persistent = await navigator.storage?.persist?.().catch(() => false) ?? false;
    return this.storageStatus(persistent);
  }

  async storageStatus(persistent?: boolean): Promise<StorageStatus> {
    const estimate = await navigator.storage?.estimate?.().catch(() => ({ usage: 0, quota: 0 }));
    return {
      usage: estimate?.usage ?? 0,
      quota: estimate?.quota ?? 0,
      persistent: persistent ?? await navigator.storage?.persisted?.().catch(() => false) ?? false,
    };
  }

  saveScene(scene: SceneDocument) { return this.db.scenes.put(structuredClone(scene)); }
  scene(id: string) { return this.db.scenes.get(id); }
  deleteScene(id: string) { return this.db.scenes.delete(id); }
  scenes() { return this.db.scenes.orderBy("updatedAt").reverse().toArray(); }
  templates() { return this.db.templates.toArray(); }
  saveTemplate(template: EditorialTemplate) { return this.db.templates.put(structuredClone(template)); }
  async upsertBuiltinTemplates(templates: EditorialTemplate[]) {
    const current = await this.db.templates.where("source").equals("builtin").toArray();
    const versions = new Map(current.map((item) => [item.id, item.catalogVersion ?? 0]));
    const updates = templates.filter((item) => (versions.get(item.id) ?? -1) < item.catalogVersion);
    if (updates.length) await this.db.templates.bulkPut(updates.map((item) => structuredClone(item)));
  }
  saveProject(project: ContentProject) { return this.db.contentProjects.put(structuredClone(project)); }
  project(id: string) { return this.db.contentProjects.get(id); }
  projects(brandId?: string) {
    return brandId
      ? this.db.contentProjects.where("brandId").equals(brandId).reverse().sortBy("updatedAt")
      : this.db.contentProjects.orderBy("updatedAt").reverse().toArray();
  }
  saveTopicDraft(draft: TopicDraft) { return this.db.topicDrafts.put(structuredClone(draft)); }
  topicDraft(id: string) { return this.db.topicDrafts.get(id); }
  topicDrafts() { return this.db.topicDrafts.orderBy("createdAt").reverse().toArray(); }
  deleteTopicDraft(id: string) { return this.db.topicDrafts.delete(id); }
  async assets(): Promise<LibraryAsset[]> {
    const assets = await this.db.assets.toArray();
    return assets.sort((a, b) => {
      const usedA = a.lastUsedAt ? Date.parse(a.lastUsedAt) : 0;
      const usedB = b.lastUsedAt ? Date.parse(b.lastUsedAt) : 0;
      return usedB - usedA || b.useCount - a.useCount || a.name.localeCompare(b.name);
    });
  }
  asset(id: string) { return this.db.assets.get(id) as Promise<LibraryAsset | undefined>; }
  cutout(outputAssetId: string) { return this.db.cutouts.get(outputAssetId); }
  cutouts() { return this.db.cutouts.orderBy("updatedAt").reverse().toArray(); }
  saveCutout(cutout: CutoutRecord) { return this.db.cutouts.put(structuredClone(cutout)); }
  async deleteAsset(id: string) {
    await this.db.assets.delete(id);
    await this.db.cutouts.delete(id);
    try {
      const root = await navigator.storage.getDirectory();
      const directory = await root.getDirectoryHandle("polyedro-assets");
      await directory.removeEntry(id);
    } catch {
      // SVGs and small assets live only in IndexedDB; a missing OPFS entry is expected.
    }
  }

  async saveAsset(asset: LibraryAsset, options: { deduplicate?: boolean } = {}): Promise<LibraryAsset> {
    if (options.deduplicate !== false) {
      const duplicate = await this.db.assets.where("hash").equals(asset.hash).first();
      if (duplicate) return duplicate as LibraryAsset;
    }
    await this.db.assets.put(asset);
    return asset;
  }

  async markAssetUsed(id: string) {
    const asset = await this.db.assets.get(id);
    if (!asset) return;
    await this.db.assets.update(id, { useCount: asset.useCount + 1, lastUsedAt: new Date().toISOString() });
  }

  async writeLargeBlob(id: string, blob: Blob): Promise<"opfs" | "indexeddb"> {
    try {
      const root = await navigator.storage.getDirectory();
      const directory = await root.getDirectoryHandle("polyedro-assets", { create: true });
      const handle = await directory.getFileHandle(id, { create: true });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return "opfs";
    } catch {
      const asset = await this.db.assets.get(id);
      if (asset) await this.db.assets.update(id, { blob });
      return "indexeddb";
    }
  }

  async readLargeBlob(id: string): Promise<Blob | undefined> {
    try {
      const root = await navigator.storage.getDirectory();
      const directory = await root.getDirectoryHandle("polyedro-assets");
      const handle = await directory.getFileHandle(id);
      return await handle.getFile();
    } catch {
      return (await this.db.assets.get(id))?.blob;
    }
  }

  async clearAll() {
    await this.db.transaction("rw", ["scenes", "assets", "templates", "contentProjects", "cutouts", "topicDrafts"], () =>
      Promise.all([this.db.scenes.clear(), this.db.assets.clear(), this.db.templates.clear(), this.db.contentProjects.clear(), this.db.cutouts.clear(), this.db.topicDrafts.clear()]));
  }
}
