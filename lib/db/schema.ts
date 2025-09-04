import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
  date,
  foreignKey,
  integer,
  json,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const user = pgTable("User", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  email: varchar("email", { length: 64 }).notNull(),
  password: varchar("password", { length: 64 }),
  supabaseId: uuid("supabaseId"), // Supabase user ID for OAuth mapping
});

export type User = InferSelectModel<typeof user>;

// User settings table for storing user preferences
export const userSettings = pgTable("UserSettings", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id)
    .unique(),
  settings: json("settings").notNull().default({}),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type UserSettings = InferSelectModel<typeof userSettings>;

export const chat = pgTable("Chat", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull(),
  title: text("title").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
});

export type Chat = InferSelectModel<typeof chat>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const messageDeprecated = pgTable("Message", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  content: json("content").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export type MessageDeprecated = InferSelectModel<typeof messageDeprecated>;

export const message = pgTable("Message_v2", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  parts: json("parts").notNull(),
  attachments: json("attachments").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const voteDeprecated = pgTable(
  "Vote",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => messageDeprecated.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  }
);

export type VoteDeprecated = InferSelectModel<typeof voteDeprecated>;

export const vote = pgTable(
  "Vote_v2",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  }
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  "Document",
  {
    id: uuid("id").notNull().defaultRandom(),
    createdAt: timestamp("createdAt").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    kind: varchar("text", { enum: ["text", "code", "image", "sheet"] })
      .notNull()
      .default("text"),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.id, table.createdAt] }),
    };
  }
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  "Suggestion",
  {
    id: uuid("id").notNull().defaultRandom(),
    documentId: uuid("documentId").notNull(),
    documentCreatedAt: timestamp("documentCreatedAt").notNull(),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    description: text("description"),
    isResolved: boolean("isResolved").notNull().default(false),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  })
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  "Stream",
  {
    id: uuid("id").notNull().defaultRandom(),
    chatId: uuid("chatId").notNull(),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
  })
);

export type Stream = InferSelectModel<typeof stream>;

// Billing & Usage

export const subscription = pgTable("Subscription", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  plan: varchar("plan", { length: 32 }).notNull().default("free"), // free | pro
  status: varchar("status", { length: 32 }).notNull().default("active"), // active | past_due | canceled
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type Subscription = InferSelectModel<typeof subscription>;

export const payment = pgTable("Payment", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  orderId: varchar("orderId", { length: 64 }).notNull(),
  paymentId: varchar("paymentId", { length: 64 }),
  amountPaise: integer("amountPaise").notNull(),
  currency: varchar("currency", { length: 8 }).notNull().default("INR"),
  status: varchar("status", { length: 32 }).notNull().default("created"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type Payment = InferSelectModel<typeof payment>;

export const creditLedger = pgTable("CreditLedger", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  tokensDelta: integer("tokensDelta").notNull(),
  reason: varchar("reason", { length: 64 }).notNull().default("topup"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type CreditLedger = InferSelectModel<typeof creditLedger>;

export const usageDaily = pgTable(
  "UsageDaily",
  {
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    day: date("day").notNull(),
    modelId: varchar("modelId", { length: 64 }).notNull(),
    tokensIn: integer("tokensIn").notNull().default(0),
    tokensOut: integer("tokensOut").notNull().default(0),
    messages: integer("messages").notNull().default(0), // New: track message count
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.day, table.modelId] }),
  })
);

// New table for tracking monthly usage for pro users
export const usageMonthly = pgTable(
  "UsageMonthly",
  {
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    month: date("month").notNull(), // YYYY-MM-01 format
    messages: integer("messages").notNull().default(0),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.month] }),
  })
);

export type UsageDaily = InferSelectModel<typeof usageDaily>;
export type UsageMonthly = InferSelectModel<typeof usageMonthly>;

// Enhanced payment tracking with full lifecycle
export const paymentEvent = pgTable("PaymentEvent", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  paymentId: varchar("paymentId", { length: 64 }).notNull(),
  orderId: varchar("orderId", { length: 64 }),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  eventType: varchar("eventType", { length: 32 }).notNull(), // authorized, captured, failed
  status: varchar("status", { length: 32 }).notNull(),
  amountPaise: integer("amountPaise").notNull(),
  currency: varchar("currency", { length: 8 }).notNull().default("INR"),
  method: varchar("method", { length: 32 }), // card, upi, netbanking, etc
  errorCode: varchar("errorCode", { length: 64 }),
  errorDescription: text("errorDescription"),
  metadata: json("metadata"), // Store full webhook payload
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type PaymentEvent = InferSelectModel<typeof paymentEvent>;

// Refund tracking
export const refund = pgTable("Refund", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  refundId: varchar("refundId", { length: 64 }).notNull().unique(),
  paymentId: varchar("paymentId", { length: 64 }).notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  amountPaise: integer("amountPaise").notNull(),
  currency: varchar("currency", { length: 8 }).notNull().default("INR"),
  status: varchar("status", { length: 32 }).notNull(), // processed, failed, pending
  reason: varchar("reason", { length: 128 }),
  errorCode: varchar("errorCode", { length: 64 }),
  razorpayCreatedAt: timestamp("razorpayCreatedAt"),
  processedAt: timestamp("processedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type Refund = InferSelectModel<typeof refund>;

// Service downtime tracking
export const serviceDowntime = pgTable("ServiceDowntime", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  downtimeId: varchar("downtimeId", { length: 64 }).notNull().unique(),
  method: varchar("method", { length: 32 }).notNull(), // card, upi, netbanking
  status: varchar("status", { length: 32 }).notNull(), // started, resolved, updated
  severity: varchar("severity", { length: 16 }).notNull(), // low, medium, high
  instrument: json("instrument"), // issuer, network, type details
  startedAt: timestamp("startedAt"),
  resolvedAt: timestamp("resolvedAt"),
  scheduled: boolean("scheduled").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type ServiceDowntime = InferSelectModel<typeof serviceDowntime>;

// User notifications for important events
export const userNotification = pgTable("UserNotification", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  type: varchar("type", { length: 32 }).notNull(), // payment_failed, refund_processed, downtime_alert
  title: varchar("title", { length: 128 }).notNull(),
  message: text("message").notNull(),
  metadata: json("metadata"), // Additional context
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type UserNotification = InferSelectModel<typeof userNotification>;

// AI Compare feature tables
export const compareRun = pgTable("CompareRun", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  prompt: text("prompt").notNull(),
  modelIds: json("modelIds").$type<string[]>().notNull(),
  status: varchar("status", { length: 32 }).notNull().default("running"), // running|completed|canceled|failed
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type CompareRun = InferSelectModel<typeof compareRun>;

export const compareResult = pgTable(
  "CompareResult",
  {
    id: uuid("id").notNull().defaultRandom(),
    runId: uuid("runId")
      .notNull()
      .references(() => compareRun.id, { onDelete: "cascade" }),
    modelId: varchar("modelId", { length: 64 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("running"), // running|completed|canceled|failed
    content: text("content").default(""),
    reasoning: text("reasoning").default(""), // AI reasoning/thinking content
    usage: json("usage"),
    error: text("error"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    completedAt: timestamp("completedAt"),
    // Server-side timing fields
    serverStartedAt: timestamp("serverStartedAt"),
    serverCompletedAt: timestamp("serverCompletedAt"),
    inferenceTimeMs: integer("inferenceTimeMs"), // Pure inference time in milliseconds
  },
  (table) => ({
    pk: primaryKey({ columns: [table.runId, table.modelId] }),
  })
);

export type CompareResult = InferSelectModel<typeof compareResult>;
