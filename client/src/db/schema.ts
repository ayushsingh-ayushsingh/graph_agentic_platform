import { relations } from "drizzle-orm"
import type { AnyPgColumn } from "drizzle-orm/pg-core"
import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
  pgEnum,
} from "drizzle-orm/pg-core"

// ---------------------------------------------------------------------------
// Auth tables (managed by BetterAuth — do not remove)
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
})

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)]
)

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)]
)

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
)

// ---------------------------------------------------------------------------
// Blog tables
// ---------------------------------------------------------------------------

export const visibilityEnum = pgEnum("visibility", [
  "public",
  "private",
  "unlisted",
])

export const post = pgTable(
  "post",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    /** slugified-title-{uuid} — immutable after first save */
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    /** Markdown string */
    content: text("content").notNull().default(""),
    /** Comma-separated tags stored as a JSON array string for pg compatibility */
    tags: text("tags").notNull().default("[]"),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    visibility: visibilityEnum("visibility").notNull().default("public"),
    commentsEnabled: boolean("comments_enabled").notNull().default(true),
    publishedAt: timestamp("published_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("post_author_idx").on(table.authorId),
    index("post_slug_idx").on(table.slug),
    index("post_visibility_published_idx").on(
      table.visibility,
      table.publishedAt
    ),
  ]
)

export const comment = pgTable(
  "comment",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    postId: text("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /**
     * Null = root comment. Non-null = reply.
     * We cast via `(): AnyPgColumn =>` to satisfy Drizzle's self-ref requirement.
     */
    parentId: text("parent_id").references(
      (): AnyPgColumn => comment.id,
      { onDelete: "cascade" }
    ),
    body: text("body").notNull(),
    /** Soft-delete timestamp. When set, body is hidden in the UI. */
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("comment_post_parent_idx").on(
      table.postId,
      table.parentId,
      table.createdAt
    ),
    index("comment_author_idx").on(table.authorId),
  ]
)

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  posts: many(post),
  comments: many(comment),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}))

export const postRelations = relations(post, ({ one, many }) => ({
  author: one(user, {
    fields: [post.authorId],
    references: [user.id],
  }),
  comments: many(comment),
}))

export const commentRelations = relations(comment, ({ one, many }) => ({
  post: one(post, {
    fields: [comment.postId],
    references: [post.id],
  }),
  author: one(user, {
    fields: [comment.authorId],
    references: [user.id],
  }),
  parent: one(comment, {
    fields: [comment.parentId],
    references: [comment.id],
    relationName: "comment_parent",
  }),
  children: many(comment, { relationName: "comment_parent" }),
}))

// ---------------------------------------------------------------------------
// Inferred types (use these in Server Actions and UI)
// ---------------------------------------------------------------------------

export type Post = typeof post.$inferSelect
export type NewPost = typeof post.$inferInsert
export type Comment = typeof comment.$inferSelect
export type NewComment = typeof comment.$inferInsert
export type User = typeof user.$inferSelect
