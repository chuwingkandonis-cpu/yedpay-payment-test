import {
  mysqlTable,
  serial,
  varchar,
  text,
  boolean,
  int,
  timestamp,
} from "drizzle-orm/mysql-core";

// History of API test calls made from the console
export const apiCallLogs = mysqlTable("api_call_logs", {
  id: serial("id").primaryKey(),
  endpointKey: varchar("endpoint_key", { length: 64 }).notNull(),
  label: varchar("label", { length: 191 }).notNull(),
  method: varchar("method", { length: 8 }).notNull(),
  url: text("url").notNull(),
  environment: varchar("environment", { length: 16 }).notNull(),
  requestBody: text("request_body"),
  httpStatus: int("http_status"),
  ok: boolean("ok").notNull().default(false),
  responseBody: text("response_body"),
  durationMs: int("duration_ms"),
  customId: varchar("custom_id", { length: 64 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Demo store orders — each order maps to one Yedpay online payment
export const orders = mysqlTable("orders", {
  id: serial("id").primaryKey(),
  customId: varchar("custom_id", { length: 64 }).notNull().unique(),
  items: text("items").notNull(), // JSON: [{productId, name, qty, price}]
  amount: varchar("amount", { length: 15 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("HKD"),
  status: varchar("status", { length: 32 }).notNull().default("pending"),
  paymentToken: varchar("payment_token", { length: 191 }),
  checkoutUrl: text("checkout_url"),
  txnStatus: varchar("txn_status", { length: 32 }),
  lastResponse: text("last_response"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// Async notifications (webhooks) sent by Yedpay to our notify_url
export const webhookNotifications = mysqlTable("webhook_notifications", {
  id: serial("id").primaryKey(),
  rawBody: text("raw_body").notNull(),
  parsedBody: text("parsed_body"),
  signValid: boolean("sign_valid"),
  signValue: varchar("sign_value", { length: 128 }),
  requestType: varchar("request_type", { length: 32 }),
  customId: varchar("custom_id", { length: 64 }),
  txnStatus: varchar("txn_status", { length: 32 }),
  sourceIp: varchar("source_ip", { length: 64 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Tokenization API — registered cards used for monthly-billing policies.
// One row per precreate-token call; linked to a policy via customId.
export const paymentTokens = mysqlTable("payment_tokens", {
  id: serial("id").primaryKey(),
  tokenId: varchar("token_id", { length: 32 }).notNull().unique(), // Yedpay token id
  customId: varchar("custom_id", { length: 64 }).notNull().unique(), // policy INS-xxx
  companyId: varchar("company_id", { length: 32 }).notNull(),
  storeId: varchar("store_id", { length: 32 }),
  status: varchar("status", { length: 32 }).notNull().default("pending"), // pending | active
  name: varchar("name", { length: 64 }), // e.g. "Visa 0580"
  cardType: varchar("card_type", { length: 32 }), // token "type" field
  registerUrl: text("register_url"),
  months: int("months").notNull().default(12),
  monthsPaid: int("months_paid").notNull().default(0),
  monthlyAmount: varchar("monthly_amount", { length: 15 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("HKD"),
  lastChargeId: varchar("last_charge_id", { length: 64 }), // custom_id of latest token charge
  lastResponse: text("last_response"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});
