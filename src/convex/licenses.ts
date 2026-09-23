import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { tierValidator } from "./schema";

type CustomerId = Id<"customers">;

/** Auth kullanıcı -> customers satırı (yoksa null). */
async function getCustomer(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("customers")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .unique();
}

/** Admin mi? (users.role === "admin") */
async function isAdmin(ctx: QueryCtx, userId: Id<"users"> | null) {
  if (!userId) return false;
  const user = await ctx.db.get(userId);
  return user?.role === "admin";
}

async function requireUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Oturum açmanız gerekiyor.");
  return userId;
}

/** Yoksa müşteri profilini oluşturur (1 varsayılan HWID kredisi). */
async function ensureCustomer(ctx: MutationCtx, userId: Id<"users">) {
  const existing = await getCustomer(ctx, userId);
  if (existing) return existing;
  const id: CustomerId = await ctx.db.insert("customers", {
    userId,
    hwidResetCredits: 1,
    createdAt: Date.now(),
  });
  return await ctx.db.get(id);
}

/* ------------------------------- MÜŞTERİ ------------------------------- */

/** /panel ilk açılışta profil satırını garanti eder. */
export const ensureProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const customer = await ensureCustomer(ctx, userId);
    return { hwidResetCredits: customer?.hwidResetCredits ?? 1 };
  },
});

/** /panel: profil + kendi lisansları (salt-okunur). */
export const myProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const customer = await getCustomer(ctx, userId);
    const licenses = await ctx.db
      .query("licenses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return {
      email: customer?.email ?? (await ctx.db.get(userId))?.email ?? null,
      // Profil henüz oluşmadıysa varsayılan 1 kredi göster.
      hwidResetCredits: customer?.hwidResetCredits ?? 1,
      licenses: licenses.map((l) => ({
        _id: l._id,
        licenseKey: l.licenseKey,
        hwid: l.hwid ?? null,
        tier: l.tier,
        expireDate: l.expireDate ?? null,
        isActive: l.isActive,
        createdAt: l.createdAt,
      })),
    };
  },
});

/** Müşteri elindeki key'i kendi hesabına bağlar. */
export const claimLicense = mutation({
  args: { licenseKey: v.string() },
  handler: async (ctx, { licenseKey }) => {
    const userId = await requireUserId(ctx);
    await ensureCustomer(ctx, userId);

    const key = licenseKey.trim().toUpperCase();
    if (!key) throw new Error("Lisans anahtarı boş olamaz.");

    const license = await ctx.db
      .query("licenses")
      .withIndex("by_license_key", (q) => q.eq("licenseKey", key))
      .unique();

    if (!license) throw new Error("Böyle bir lisans anahtarı bulunamadı.");
    if (license.userId && license.userId !== userId)
      throw new Error("Bu lisans zaten başka bir hesaba bağlı.");

    await ctx.db.patch(license._id, { userId });
    return { ok: true };
  },
});

/** Müşteri kendi lisansının HWID'sini sıfırlar; 1 kredi düşer. */
export const resetHwid = mutation({
  args: { licenseId: v.id("licenses") },
  handler: async (ctx, { licenseId }) => {
    const userId = await requireUserId(ctx);

    const customer = await getCustomer(ctx, userId);
    if (!customer || customer.hwidResetCredits <= 0)
      throw new Error(
        "Sıfırlama hakkınız bitti, yöneticinizle iletişime geçin.",
      );

    const license = await ctx.db.get(licenseId);
    if (!license || license.userId !== userId)
      throw new Error("Bu lisans size ait değil.");

    await ctx.db.patch(license._id, { hwid: undefined });
    await ctx.db.patch(customer._id, {
      hwidResetCredits: customer.hwidResetCredits - 1,
    });
    return { ok: true, remainingCredits: customer.hwidResetCredits - 1 };
  },
});

/* --------------------------------- ADMIN -------------------------------- */

async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await requireUserId(ctx);
  if (!(await isAdmin(ctx, userId)))
    throw new Error("Bu işlem için yönetici yetkisi gerekir.");
  return userId;
}

/** /admin: tüm lisanslar. */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const licenses = await ctx.db.query("licenses").collect();
    const rows = await Promise.all(
      licenses.map(async (l) => {
        const owner = l.userId ? await ctx.db.get(l.userId) : null;
        const customer = l.userId ? await getCustomer(ctx, l.userId) : null;
        return {
          _id: l._id,
          licenseKey: l.licenseKey,
          hwid: l.hwid ?? null,
          tier: l.tier,
          expireDate: l.expireDate ?? null,
          isActive: l.isActive,
          ownerEmail: owner?.email ?? null,
          ownerCredits: customer?.hwidResetCredits ?? null,
          createdAt: l.createdAt,
        };
      }),
    );
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return rows;
  },
});

/** Yeni lisans üretir. */
export const createLicense = mutation({
  args: { tier: tierValidator, days: v.optional(v.number()) },
  handler: async (ctx, { tier, days }) => {
    await requireAdmin(ctx);
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const pick = () =>
      Array.from(
        { length: 5 },
        () => alphabet[Math.floor(Math.random() * alphabet.length)],
      ).join("");
    const licenseKey = `PNX-${tier === "VIP+" ? "VP" : "VIP"}-${pick()}-${pick()}-${pick()}`;

    await ctx.db.insert("licenses", {
      licenseKey,
      tier,
      isActive: true,
      userId: undefined,
      hwid: undefined,
      expireDate: days && days > 0 ? Date.now() + days * 86_400_000 : undefined,
      createdAt: Date.now(),
    });
    return { licenseKey };
  },
});

export const setActive = mutation({
  args: { licenseId: v.id("licenses"), isActive: v.boolean() },
  handler: async (ctx, { licenseId, isActive }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(licenseId, { isActive });
  },
});

export const adminResetHwid = mutation({
  args: { licenseId: v.id("licenses") },
  handler: async (ctx, { licenseId }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(licenseId, { hwid: undefined });
  },
});

export const removeLicense = mutation({
  args: { licenseId: v.id("licenses") },
  handler: async (ctx, { licenseId }) => {
    await requireAdmin(ctx);
    await ctx.db.delete(licenseId);
  },
});

/** /admin/kullanicilar: müşteri listesi. */
export const listCustomers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const customers = await ctx.db.query("customers").collect();
    const rows = await Promise.all(
      customers.map(async (c) => {
        const user = await ctx.db.get(c.userId);
        const licenses = await ctx.db
          .query("licenses")
          .withIndex("by_user", (q) => q.eq("userId", c.userId))
          .collect();
        return {
          _id: c._id,
          email: c.email ?? user?.email ?? user?.name ?? "—",
          licenseCount: licenses.length,
          hwidResetCredits: c.hwidResetCredits,
          createdAt: c.createdAt,
        };
      }),
    );
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return rows;
  },
});

/** Admin müşteriye manuel HWID sıfırlama kredisi ekler. */
export const grantCredits = mutation({
  args: { customerId: v.id("customers"), amount: v.number() },
  handler: async (ctx, { customerId, amount }) => {
    await requireAdmin(ctx);
    const customer = await ctx.db.get(customerId);
    if (!customer) throw new Error("Müşteri bulunamadı.");
    await ctx.db.patch(customerId, {
      hwidResetCredits: Math.max(0, customer.hwidResetCredits + amount),
    });
  },
});

/* ----------------------- CLIENT (.exe) DOĞRULAMA ----------------------- */

/** /api/verify içinde kullanılan doğrulama mantığı. */
export const verifyInternal = internalMutation({
  args: { licenseKey: v.string(), hwid: v.string() },
  handler: async (ctx, { licenseKey, hwid }) => {
    const license = await ctx.db
      .query("licenses")
      .withIndex("by_license_key", (q) => q.eq("licenseKey", licenseKey))
      .unique();

    if (!license) return { status: "invalid" as const };
    if (!license.isActive) return { status: "disabled" as const };
    if (license.expireDate !== undefined && license.expireDate < Date.now())
      return { status: "expired" as const };

    if (!license.hwid) {
      // İlk aktivasyon: gelen makine HWID'si yazılır.
      await ctx.db.patch(license._id, { hwid });
      return { status: "ok" as const, tier: license.tier };
    }
    if (license.hwid !== hwid) return { status: "hwid_mismatch" as const };
    return { status: "ok" as const, tier: license.tier };
  },
});
