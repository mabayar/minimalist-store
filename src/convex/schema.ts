import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

export const tierValidator = v.union(v.literal("VIP"), v.literal("VIP+"));
export type Tier = Infer<typeof tierValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // Lisans tablosu: admin tarafından üretilir, müşteri /panel üzerinden
    // kendi hesabına bağlar (userId). Client .exe /api/verify ile sorgular.
    licenses: defineTable({
      licenseKey: v.string(),
      hwid: v.optional(v.string()),
      tier: tierValidator,
      expireDate: v.optional(v.number()), // ms timestamp; tanımsızsa süresiz
      isActive: v.boolean(),
      userId: v.optional(v.id("users")), // lisansın bağlı olduğu müşteri
      createdAt: v.number(),
    })
      .index("by_license_key", ["licenseKey"])
      .index("by_user", ["userId"]),

    // Müşteri profili: auth kullanıcısı + HWID sıfırlama kredisi.
    customers: defineTable({
      userId: v.id("users"),
      email: v.optional(v.string()),
      hwidResetCredits: v.number(), // yeni kayıtta varsayılan 1
      createdAt: v.number(),
    }).index("by_user_id", ["userId"]),

    // .exe sürüm yönetimi: admin /admin/ayarlar üzerinden yükler.
    appVersions: defineTable({
      version: v.string(),
      fileName: v.string(),
      storageId: v.id("_storage"),
      notes: v.optional(v.string()),
      isActive: v.boolean(),
      uploadedAt: v.number(),
    }).index("by_active", ["isActive"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
