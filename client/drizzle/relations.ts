import { relations } from "drizzle-orm/relations";
import { user, account, session, post, comment } from "./schema";

export const accountRelations = relations(account, ({one}) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	}),
}));

export const userRelations = relations(user, ({many}) => ({
	accounts: many(account),
	sessions: many(session),
	comments: many(comment),
	posts: many(post),
}));

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));

export const commentRelations = relations(comment, ({one, many}) => ({
	post: one(post, {
		fields: [comment.postId],
		references: [post.id]
	}),
	user: one(user, {
		fields: [comment.authorId],
		references: [user.id]
	}),
	comment: one(comment, {
		fields: [comment.parentId],
		references: [comment.id],
		relationName: "comment_parentId_comment_id"
	}),
	comments: many(comment, {
		relationName: "comment_parentId_comment_id"
	}),
}));

export const postRelations = relations(post, ({one, many}) => ({
	comments: many(comment),
	user: one(user, {
		fields: [post.authorId],
		references: [user.id]
	}),
}));