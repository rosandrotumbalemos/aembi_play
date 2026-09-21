import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  integer,
  smallint,
  boolean,
  timestamp,
  jsonb,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────
// Enums — PROJECT_BRIEF.md seção 6
// ─────────────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", ["admin", "operador"]);

export const adStatusEnum = pgEnum("ad_status", [
  "rascunho",
  "agendado",
  "publicado",
  "arquivado",
]);

export const storageTierEnum = pgEnum("storage_tier", ["local", "drive"]);

// Orientação da tela (seção 2.5): 0=paisagem, 90=retrato,
// 180=paisagem invertida, 270=retrato invertido.
export const screenOrientationEnum = pgEnum("screen_orientation", [
  "0",
  "90",
  "180",
  "270",
]);

export const jobTypeEnum = pgEnum("job_type", [
  "validate_video",
  "backup_to_drive",
  "restore_from_drive",
  "archive_local_file",
  "expire_campaign",
]);

export const jobStatusEnum = pgEnum("job_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

export const auditActionEnum = pgEnum("audit_action", [
  "adicionado",
  "editado",
  "removido",
  "publicado",
  "arquivado",
  "expirado",
  "backup",
  "mudanca_status_tela",
]);

// ─────────────────────────────────────────────────────────────────────────
// users
// ─────────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("operador"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────
// advertisers (anunciantes)
// ─────────────────────────────────────────────────────────────────────────

export const advertisers = pgTable("advertisers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  document: varchar("document", { length: 32 }), // CNPJ/CPF, opcional
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 32 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────
// categories
// ─────────────────────────────────────────────────────────────────────────

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────
// ads (anúncios) — seção 2.4 / 6
// ─────────────────────────────────────────────────────────────────────────

export const ads = pgTable(
  "ads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    advertiserId: uuid("advertiser_id")
      .notNull()
      .references(() => advertisers.id, { onDelete: "restrict" }),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description"),
    storageKey: text("storage_key").notNull(), // caminho no MinIO
    thumbnailKey: text("thumbnail_key"), // frame extraído pelo worker (ffmpeg) após validar
    driveFileId: text("drive_file_id"), // id no Google Drive (backup)
    sizeBytes: integer("size_bytes").notNull(),
    durationSeconds: integer("duration_seconds").notNull(),
    videoCodec: varchar("video_codec", { length: 32 }),
    audioCodec: varchar("audio_codec", { length: 32 }),
    sha256: varchar("sha256", { length: 64 }).notNull(),
    storageTier: storageTierEnum("storage_tier").notNull().default("local"),
    status: adStatusEnum("status").notNull().default("rascunho"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ads_advertiser_id_idx").on(table.advertiserId),
    index("ads_status_idx").on(table.status),
  ],
);

// ─────────────────────────────────────────────────────────────────────────
// screens (telas) — seção 2.5 / 6
// ─────────────────────────────────────────────────────────────────────────

export const screens = pgTable(
  "screens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    location: text("location"),
    orientation: screenOrientationEnum("orientation").notNull().default("0"),
    deviceToken: text("device_token").unique(),
    pairingCode: varchar("pairing_code", { length: 16 }),
    pairingCodeExpiresAt: timestamp("pairing_code_expires_at", { withTimezone: true }),
    pairedAt: timestamp("paired_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    emergencyMode: boolean("emergency_mode").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("screens_device_token_idx").on(table.deviceToken)],
);

// ─────────────────────────────────────────────────────────────────────────
// plans (planos) — seção 2.3 / 6
// ─────────────────────────────────────────────────────────────────────────

export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  insertionsPerCycle: integer("insertions_per_cycle").notNull(),
  maxDurationSeconds: integer("max_duration_seconds").notNull(),
  maxScreens: integer("max_screens").notNull(),
  primeTimeAccess: boolean("prime_time_access").notNull().default(false),
  // Faixa de horário opcional (ex.: "18:00-22:00"); nulo = qualquer horário.
  timeWindowStart: varchar("time_window_start", { length: 5 }),
  timeWindowEnd: varchar("time_window_end", { length: 5 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────
// campaigns (campanhas) — seção 2.1 / 6
// ─────────────────────────────────────────────────────────────────────────

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    advertiserId: uuid("advertiser_id")
      .notNull()
      .references(() => advertisers.id, { onDelete: "restrict" }),
    adId: uuid("ad_id")
      .notNull()
      .references(() => ads.id, { onDelete: "restrict" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }).notNull(),
    // Janela de horário diária (ex.: "08:00"-"20:00") e dias da semana
    // (0=domingo .. 6=sábado), conforme seção 2.2/10 (Fase 3: agendamento avançado).
    timeWindowStart: varchar("time_window_start", { length: 5 }),
    timeWindowEnd: varchar("time_window_end", { length: 5 }),
    daysOfWeek: jsonb("days_of_week").$type<number[]>().notNull().default([0, 1, 2, 3, 4, 5, 6]),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("campaigns_advertiser_id_idx").on(table.advertiserId),
    index("campaigns_date_range_idx").on(table.startDate, table.endDate),
  ],
);

// ─────────────────────────────────────────────────────────────────────────
// campaign_screens (N:N campanhas × telas) — seção 6
// ─────────────────────────────────────────────────────────────────────────

export const campaignScreens = pgTable(
  "campaign_screens",
  {
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    screenId: uuid("screen_id")
      .notNull()
      .references(() => screens.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.campaignId, table.screenId] })],
);

// ─────────────────────────────────────────────────────────────────────────
// playlists — loop materializado por tela, versionado (seção 5.2 / 6)
// ─────────────────────────────────────────────────────────────────────────

export const playlists = pgTable(
  "playlists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    screenId: uuid("screen_id")
      .notNull()
      .references(() => screens.id, { onDelete: "cascade" }),
    version: text("version").notNull(), // usado como ETag do manifesto
    loopDurationSeconds: integer("loop_duration_seconds").notNull().default(300),
    // Espaços do ciclo já montados e intercalados (ver seção 2.3), na ordem
    // de reprodução. Cada item referencia um ad_id; slots vazios recebem
    // conteúdo institucional.
    items: jsonb("items")
      .$type<
        Array<{
          adId: string | null;
          durationSeconds: number;
          slotIndex: number;
        }>
      >()
      .notNull()
      .default([]),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("playlists_screen_id_idx").on(table.screenId),
    uniqueIndex("playlists_screen_version_idx").on(table.screenId, table.version),
  ],
);

// ─────────────────────────────────────────────────────────────────────────
// audit_logs — somente inserção (seção 8)
// ─────────────────────────────────────────────────────────────────────────

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    actorLabel: text("actor_label").notNull().default("Sistema"), // "Sistema" quando actorId é nulo
    action: auditActionEnum("action").notNull(),
    entity: text("entity").notNull(), // ex.: "ads", "screens", "campaigns"
    entityId: uuid("entity_id").notNull(),
    detail: text("detail"),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_logs_entity_idx").on(table.entity, table.entityId),
    index("audit_logs_created_at_idx").on(table.createdAt),
    index("audit_logs_actor_id_idx").on(table.actorId),
  ],
);

// ─────────────────────────────────────────────────────────────────────────
// play_logs — proof of play (seção 2.3 / 5.5 / 6)
// ─────────────────────────────────────────────────────────────────────────

export const playLogs = pgTable(
  "play_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    screenId: uuid("screen_id")
      .notNull()
      .references(() => screens.id, { onDelete: "cascade" }),
    adId: uuid("ad_id")
      .notNull()
      .references(() => ads.id, { onDelete: "cascade" }),
    playedAt: timestamp("played_at", { withTimezone: true }).notNull(),
    durationSeconds: integer("duration_seconds").notNull(),
    manifestVersion: text("manifest_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("play_logs_screen_id_idx").on(table.screenId),
    index("play_logs_ad_id_idx").on(table.adId),
    index("play_logs_played_at_idx").on(table.playedAt),
  ],
);

// ─────────────────────────────────────────────────────────────────────────
// jobs — fila compartilhada TS/Python (seção 3.1 / 6)
// Consumida com `SELECT ... FOR UPDATE SKIP LOCKED` pelo worker Python.
// ─────────────────────────────────────────────────────────────────────────

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: jobTypeEnum("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    status: jobStatusEnum("status").notNull().default("pending"),
    attempts: smallint("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("jobs_status_created_at_idx").on(table.status, table.createdAt),
  ],
);

// ─────────────────────────────────────────────────────────────────────────
// Relations
// ─────────────────────────────────────────────────────────────────────────

export const advertisersRelations = relations(advertisers, ({ many }) => ({
  ads: many(ads),
  campaigns: many(campaigns),
}));

export const adsRelations = relations(ads, ({ one, many }) => ({
  advertiser: one(advertisers, {
    fields: [ads.advertiserId],
    references: [advertisers.id],
  }),
  category: one(categories, {
    fields: [ads.categoryId],
    references: [categories.id],
  }),
  campaigns: many(campaigns),
  playLogs: many(playLogs),
}));

export const screensRelations = relations(screens, ({ many }) => ({
  campaignScreens: many(campaignScreens),
  playlists: many(playlists),
  playLogs: many(playLogs),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  advertiser: one(advertisers, {
    fields: [campaigns.advertiserId],
    references: [advertisers.id],
  }),
  ad: one(ads, { fields: [campaigns.adId], references: [ads.id] }),
  plan: one(plans, { fields: [campaigns.planId], references: [plans.id] }),
  campaignScreens: many(campaignScreens),
}));

export const campaignScreensRelations = relations(campaignScreens, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignScreens.campaignId],
    references: [campaigns.id],
  }),
  screen: one(screens, {
    fields: [campaignScreens.screenId],
    references: [screens.id],
  }),
}));

export const playlistsRelations = relations(playlists, ({ one }) => ({
  screen: one(screens, { fields: [playlists.screenId], references: [screens.id] }),
}));

export const playLogsRelations = relations(playLogs, ({ one }) => ({
  screen: one(screens, { fields: [playLogs.screenId], references: [screens.id] }),
  ad: one(ads, { fields: [playLogs.adId], references: [ads.id] }),
}));
