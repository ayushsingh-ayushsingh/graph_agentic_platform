import { pgTable, index, text, timestamp, unique, boolean, foreignKey, pgEnum, customType } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

const tsvector = customType<{ data: string }>({
	dataType() {
		return "tsvector"
	},
})

export const visibility = pgEnum("visibility", ['public', 'private', 'unlisted'])


export const verification = pgTable("verification", {
	id: text().primaryKey().notNull(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("verification_identifier_idx").using("btree", table.identifier.asc().nullsLast().op("text_ops")),
]);

export const user = pgTable("user", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	image: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("user_email_unique").on(table.email),
]);

export const account = pgTable("account", {
	id: text().primaryKey().notNull(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id").notNull(),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: 'string' }),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { mode: 'string' }),
	scope: text(),
	password: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	index("account_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "account_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const session = pgTable("session", {
	id: text().primaryKey().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	token: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id").notNull(),
}, (table) => [
	index("session_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "session_user_id_user_id_fk"
		}).onDelete("cascade"),
	unique("session_token_unique").on(table.token),
]);

export const comment = pgTable("comment", {
	id: text().primaryKey().notNull(),
	postId: text("post_id").notNull(),
	authorId: text("author_id").notNull(),
	parentId: text("parent_id"),
	body: text().notNull(),
	deletedAt: timestamp("deleted_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("comment_author_idx").using("btree", table.authorId.asc().nullsLast().op("text_ops")),
	index("comment_post_parent_idx").using("btree", table.postId.asc().nullsLast().op("timestamp_ops"), table.parentId.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.postId],
			foreignColumns: [post.id],
			name: "comment_post_id_post_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.authorId],
			foreignColumns: [user.id],
			name: "comment_author_id_user_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.parentId],
			foreignColumns: [table.id],
			name: "comment_parent_id_comment_id_fk"
		}).onDelete("cascade"),
]);

export const post = pgTable("post", {
	id: text().primaryKey().notNull(),
	slug: text().notNull(),
	title: text().notNull(),
	content: text().default('').notNull(),
	tags: text().default('[]').notNull(),
	authorId: text("author_id").notNull(),
	visibility: visibility().default('public').notNull(),
	commentsEnabled: boolean("comments_enabled").default(true).notNull(),
	publishedAt: timestamp("published_at", { mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	authorName: text("author_name").default('').notNull(),
	// tsvector — generated always by Postgres
	searchTsv: tsvector("search_tsv").generatedAlwaysAs(sql`(((setweight(to_tsvector('english'::regconfig, COALESCE(author_name, ''::text)), 'A'::"char") || setweight(to_tsvector('english'::regconfig, COALESCE(title, ''::text)), 'B'::"char")) || setweight(to_tsvector('english'::regconfig, COALESCE(content, ''::text)), 'C'::"char")) || setweight(to_tsvector('english'::regconfig, COALESCE(tags, ''::text)), 'D'::"char"))`),
}, (table) => [
	index("post_author_idx").using("btree", table.authorId.asc().nullsLast().op("text_ops")),
	index("post_author_name_trgm_idx").using("gin", table.authorName.asc().nullsLast().op("gin_trgm_ops")).where(sql`(visibility = 'public'::visibility)`),
	index("post_search_tsv_public_idx").using("gin", table.searchTsv.asc().nullsLast().op("tsvector_ops")).where(sql`(visibility = 'public'::visibility)`),
	index("post_slug_idx").using("btree", table.slug.asc().nullsLast().op("text_ops")),
	index("post_title_trgm_idx").using("gin", table.title.asc().nullsLast().op("gin_trgm_ops")).where(sql`(visibility = 'public'::visibility)`),
	index("post_visibility_published_idx").using("btree", table.visibility.asc().nullsLast().op("enum_ops"), table.publishedAt.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.authorId],
			foreignColumns: [user.id],
			name: "post_author_id_user_id_fk"
		}).onDelete("cascade"),
	unique("post_slug_unique").on(table.slug),
]);
