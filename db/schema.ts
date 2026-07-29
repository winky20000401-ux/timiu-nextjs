import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  displayName: text("display_name"),
  role: text("role", { enum: ["admin", "editor"] }).notNull().default("editor"),
  ...timestamps,
}, (table) => [uniqueIndex("users_email_unique").on(table.email)]);

export const adminLoginCodes = sqliteTable("admin_login_codes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  codeHash: text("code_hash").notNull(),
  requestIpHash: text("request_ip_hash").notNull(),
  expiresAt: integer("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  consumedAt: integer("consumed_at"),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
}, (table) => [
  index("admin_login_codes_email_created_idx").on(table.email, table.createdAt),
  index("admin_login_codes_ip_created_idx").on(table.requestIpHash, table.createdAt),
]);

export const adminSessions = sqliteTable("admin_sessions", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  expiresAt: integer("expires_at").notNull(),
  lastSeenAt: integer("last_seen_at").notNull(),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
}, (table) => [
  index("admin_sessions_email_idx").on(table.email),
  index("admin_sessions_expires_idx").on(table.expiresAt),
]);

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
}, (table) => [uniqueIndex("categories_slug_unique").on(table.slug)]);

export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("tags_slug_unique").on(table.slug)]);

export const articles = sqliteTable("articles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  slug: text("slug").notNull(),
  seoTitle: text("seo_title").notNull().default(""),
  description: text("description").notNull().default(""),
  contentHtml: text("content_html").notNull().default(""),
  categoryId: integer("category_id").references(() => categories.id),
  authorId: integer("author_id").references(() => users.id),
  status: text("status", { enum: ["draft", "review", "scheduled", "published", "failed", "archived"] }).notNull().default("draft"),
  confidence: real("confidence").notNull().default(0),
  requiresReview: integer("requires_review", { mode: "boolean" }).notNull().default(true),
  reviewReason: text("review_reason").notNull().default(""),
  canonicalUrl: text("canonical_url").notNull().default(""),
  coverObjectKey: text("cover_object_key"),
  coverSource: text("cover_source"),
  coverCopyright: text("cover_copyright"),
  scheduledAt: text("scheduled_at"),
  publishedAt: text("published_at"),
  ...timestamps,
}, (table) => [
  uniqueIndex("articles_slug_unique").on(table.slug),
  index("articles_status_idx").on(table.status),
  index("articles_category_idx").on(table.categoryId),
  index("articles_published_idx").on(table.publishedAt),
]);

export const articleTags = sqliteTable("article_tags", {
  articleId: integer("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  tagId: integer("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (table) => [uniqueIndex("article_tags_unique").on(table.articleId, table.tagId)]);

export const sources = sqliteTable("sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  url: text("url").notNull(),
  title: text("title").notNull().default(""),
  publisher: text("publisher").notNull().default(""),
  publishedAt: text("published_at"),
  fetchedAt: text("fetched_at"),
  httpStatus: integer("http_status"),
  extractedChars: integer("extracted_chars").notNull().default(0),
  isValid: integer("is_valid", { mode: "boolean" }).notNull().default(false),
  copyrightNote: text("copyright_note").notNull().default(""),
  ...timestamps,
}, (table) => [uniqueIndex("sources_url_unique").on(table.url)]);

export const feedItems = sqliteTable("feed_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  externalId: text("external_id").notNull(),
  feedUrl: text("feed_url").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  summary: text("summary").notNull().default(""),
  publishedAt: text("published_at"),
  fingerprint: text("fingerprint").notNull(),
  processingStatus: text("processing_status").notNull().default("new"),
  duplicateOfId: integer("duplicate_of_id"),
  rawJson: text("raw_json").notNull().default("{}"),
  ...timestamps,
}, (table) => [
  uniqueIndex("feed_items_external_unique").on(table.externalId),
  uniqueIndex("feed_items_fingerprint_unique").on(table.fingerprint),
  index("feed_items_status_idx").on(table.processingStatus),
]);

export const articleSources = sqliteTable("article_sources", {
  articleId: integer("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  sourceId: integer("source_id").notNull().references(() => sources.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["primary", "supporting", "grounding"] }).notNull().default("supporting"),
  similarity: real("similarity").notNull().default(0),
  usedInGeneration: integer("used_in_generation", { mode: "boolean" }).notNull().default(false),
}, (table) => [uniqueIndex("article_sources_unique").on(table.articleId, table.sourceId)]);

export const automationJobs = sqliteTable("automation_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(),
  status: text("status", { enum: ["queued", "running", "succeeded", "failed"] }).notNull().default("queued"),
  provider: text("provider"),
  model: text("model"),
  inputCount: integer("input_count").notNull().default(0),
  outputCount: integer("output_count").notNull().default(0),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  estimatedCostMicrousd: integer("estimated_cost_microusd").notNull().default(0),
  attempt: integer("attempt").notNull().default(0),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
  ...timestamps,
}, (table) => [index("automation_jobs_status_idx").on(table.status)]);

export const publicationLogs = sqliteTable("publication_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  articleId: integer("article_id").notNull().references(() => articles.id),
  userId: integer("user_id").references(() => users.id),
  action: text("action", { enum: ["publish", "unpublish", "schedule", "archive"] }).notNull(),
  fromStatus: text("from_status").notNull(),
  toStatus: text("to_status").notNull(),
  note: text("note").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("publication_logs_article_idx").on(table.articleId)]);

export const aiGenerationLogs = sqliteTable("ai_generation_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  articleId: integer("article_id").references(() => articles.id),
  jobId: integer("job_id").references(() => automationJobs.id),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  sourceCount: integer("source_count").notNull().default(0),
  outputChars: integer("output_chars").notNull().default(0),
  requiresReview: integer("requires_review", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const siteSettings = sqliteTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  isSecret: integer("is_secret", { mode: "boolean" }).notNull().default(false),
  updatedBy: integer("updated_by").references(() => users.id),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
