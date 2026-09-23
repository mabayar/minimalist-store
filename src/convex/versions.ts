import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";

async function requireAdmin(ctx: MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Oturum açmanız gerekiyor.");
  const user = await ctx.db.get(userId);
  if (user?.role !== "admin")
    throw new Error("Bu işlem için yönetici yetkisi gerekir.");
}

/** /admin/ayarlar: sürüm listesi (admin). */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (user?.role !== "admin") return null;

    const versions = await ctx.db.query("appVersions").collect();
    return versions
      .sort((a, b) => b.uploadedAt - a.uploadedAt)
      .map((v) => ({
        _id: v._id,
        version: v.version,
        fileName: v.fileName,
        notes: v.notes ?? null,
        isActive: v.isActive,
        uploadedAt: v.uploadedAt,
      }));
  },
});

/** Landing + /panel: güncel (aktif) sürüm. */
export const latest = query({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db
      .query("appVersions")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .order("desc")
      .first();
    if (!active) return null;
    const url = await ctx.storage.getUrl(active.storageId);
    return {
      version: active.version,
      fileName: active.fileName,
      notes: active.notes ?? null,
      uploadedAt: active.uploadedAt,
      downloadUrl: url,
    };
  },
});

/** Yeni sürüm yükle: diğerlerini pasifleştir, bunu aktif yap. */
export const upload = mutation({
  args: {
    version: v.string(),
    fileName: v.string(),
    storageId: v.id("_storage"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { version, fileName, storageId, notes }) => {
    await requireAdmin(ctx);

    const previous = await ctx.db
      .query("appVersions")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    for (const p of previous) await ctx.db.patch(p._id, { isActive: false });

    await ctx.db.insert("appVersions", {
      version,
      fileName,
      storageId,
      notes,
      isActive: true,
      uploadedAt: Date.now(),
    });
  },
});

/** Sürümü siler. */
export const remove = mutation({
  args: { versionId: v.id("appVersions") },
  handler: async (ctx, { versionId }) => {
    await requireAdmin(ctx);
    const doc = await ctx.db.get(versionId);
    if (!doc) return;
    await ctx.storage.delete(doc.storageId);
    await ctx.db.delete(versionId);
  },
});
