"use server"

import { headers } from "next/headers"
import { eq, and, isNull, gt, asc, count, isNotNull } from "drizzle-orm"
import { db } from "@/src"
import { comment, post, user } from "@/src/db/schema"
import { auth } from "@/lib/auth"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PAGE_SIZE = 10

async function getSession() {
  return auth.api.getSession({ headers: await headers() })
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommentAuthor {
  id: string
  name: string
  image: string | null
}

export interface CommentData {
  id: string
  postId: string
  parentId: string | null
  body: string
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  author: CommentAuthor
  /** Direct reply count for the "View N replies" button */
  replyCount: number
}

export interface PaginatedComments {
  comments: CommentData[]
  nextCursor: string | null
}

// ---------------------------------------------------------------------------
// Shared row → CommentData mapper
// ---------------------------------------------------------------------------

function mapRow(row: {
  id: string
  postId: string
  parentId: string | null
  body: string
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
  authorId: string
  authorName: string
  authorImage: string | null
  replyCount: number
}): CommentData {
  const isDeleted = row.deletedAt !== null
  return {
    id: row.id,
    postId: row.postId,
    parentId: row.parentId,
    body: isDeleted ? "[deleted]" : row.body,
    deletedAt: row.deletedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    author: isDeleted
      ? { id: row.authorId, name: "[deleted]", image: null }
      : { id: row.authorId, name: row.authorName, image: row.authorImage },
    replyCount: row.replyCount,
  }
}

// ---------------------------------------------------------------------------
// getRootComments
// Fetches 10 root (parentId IS NULL) comments for a post.
// cursor = createdAt ISO string of the last seen comment (for "Load more").
// ---------------------------------------------------------------------------

export async function getRootComments(
  postId: string,
  cursor?: string
): Promise<PaginatedComments> {
  const cursorDate = cursor ? new Date(cursor) : undefined

  // Count replies per root comment in a subquery isn't straightforward in
  // Drizzle without raw SQL, so we do a second count query per call. This is
  // acceptable since we load max 10 roots at a time.
  const filter = cursorDate
    ? and(eq(comment.postId, postId), isNull(comment.parentId), gt(comment.createdAt, cursorDate))
    : and(eq(comment.postId, postId), isNull(comment.parentId))

  const rows = await db
    .select({
      id: comment.id,
      postId: comment.postId,
      parentId: comment.parentId,
      body: comment.body,
      deletedAt: comment.deletedAt,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      authorId: comment.authorId,
      authorName: user.name,
      authorImage: user.image,
    })
    .from(comment)
    .innerJoin(user, eq(comment.authorId, user.id))
    .where(filter)
    .orderBy(asc(comment.createdAt))
    .limit(PAGE_SIZE + 1)

  const hasMore = rows.length > PAGE_SIZE
  const slice = hasMore ? rows.slice(0, PAGE_SIZE) : rows

  // Fetch reply counts for this batch
  const ids = slice.map((r) => r.id)
  const replyCounts: Record<string, number> = {}

  if (ids.length > 0) {
    for (const parentId of ids) {
      const [rc] = await db
        .select({ c: count() })
        .from(comment)
        .where(eq(comment.parentId, parentId))
      replyCounts[parentId] = rc?.c ?? 0
    }
  }

  const comments = slice.map((r) =>
    mapRow({ ...r, replyCount: replyCounts[r.id] ?? 0 })
  )

  return {
    comments,
    nextCursor: hasMore ? slice[slice.length - 1].createdAt.toISOString() : null,
  }
}

// ---------------------------------------------------------------------------
// getChildComments
// Fetches 10 replies to a specific parentId.
// ---------------------------------------------------------------------------

export async function getChildComments(
  postId: string,
  parentId: string,
  cursor?: string
): Promise<PaginatedComments> {
  const cursorDate = cursor ? new Date(cursor) : undefined

  const filter = cursorDate
    ? and(
        eq(comment.postId, postId),
        eq(comment.parentId, parentId),
        gt(comment.createdAt, cursorDate)
      )
    : and(eq(comment.postId, postId), eq(comment.parentId, parentId))

  const rows = await db
    .select({
      id: comment.id,
      postId: comment.postId,
      parentId: comment.parentId,
      body: comment.body,
      deletedAt: comment.deletedAt,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      authorId: comment.authorId,
      authorName: user.name,
      authorImage: user.image,
    })
    .from(comment)
    .innerJoin(user, eq(comment.authorId, user.id))
    .where(filter)
    .orderBy(asc(comment.createdAt))
    .limit(PAGE_SIZE + 1)

  const hasMore = rows.length > PAGE_SIZE
  const slice = hasMore ? rows.slice(0, PAGE_SIZE) : rows

  // Fetch reply counts for this batch
  const replyCounts: Record<string, number> = {}
  for (const r of slice) {
    const [rc] = await db
      .select({ c: count() })
      .from(comment)
      .where(eq(comment.parentId, r.id))
    replyCounts[r.id] = rc?.c ?? 0
  }

  return {
    comments: slice.map((r) =>
      mapRow({ ...r, replyCount: replyCounts[r.id] ?? 0 })
    ),
    nextCursor: hasMore ? slice[slice.length - 1].createdAt.toISOString() : null,
  }
}

// ---------------------------------------------------------------------------
// addComment
// ---------------------------------------------------------------------------

export async function addComment(
  postId: string,
  body: string,
  parentId?: string
): Promise<{ success: true; comment: CommentData } | { success: false; error: string }> {
  try {
    const session = await getSession()
    if (!session?.user) return { success: false, error: "Not authenticated" }

    const trimmed = body.trim()
    if (!trimmed) return { success: false, error: "Comment cannot be empty" }
    if (trimmed.length > 10_000)
      return { success: false, error: "Comment too long (max 10,000 chars)" }

    // Check post exists and comments are enabled
    const [p] = await db
      .select({ commentsEnabled: post.commentsEnabled })
      .from(post)
      .where(eq(post.id, postId))
      .limit(1)

    if (!p) return { success: false, error: "Post not found" }
    if (!p.commentsEnabled)
      return { success: false, error: "Comments are disabled on this post" }

    const id = crypto.randomUUID()

    await db.insert(comment).values({
      id,
      postId,
      authorId: session.user.id,
      parentId: parentId ?? null,
      body: trimmed,
    })

    const [inserted] = await db
      .select({
        id: comment.id,
        postId: comment.postId,
        parentId: comment.parentId,
        body: comment.body,
        deletedAt: comment.deletedAt,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        authorId: comment.authorId,
        authorName: user.name,
        authorImage: user.image,
      })
      .from(comment)
      .innerJoin(user, eq(comment.authorId, user.id))
      .where(eq(comment.id, id))
      .limit(1)

    return {
      success: true,
      comment: mapRow({ ...inserted, replyCount: 0 }),
    }
  } catch (err) {
    console.error("[addComment]", err)
    return { success: false, error: "Internal server error" }
  }
}

// ---------------------------------------------------------------------------
// editComment
// ---------------------------------------------------------------------------

export async function editComment(
  commentId: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession()
    if (!session?.user) return { success: false, error: "Not authenticated" }

    const trimmed = body.trim()
    if (!trimmed) return { success: false, error: "Comment cannot be empty" }

    const [existing] = await db
      .select({ authorId: comment.authorId, deletedAt: comment.deletedAt })
      .from(comment)
      .where(eq(comment.id, commentId))
      .limit(1)

    if (!existing) return { success: false, error: "Comment not found" }
    if (existing.deletedAt) return { success: false, error: "Cannot edit a deleted comment" }
    if (existing.authorId !== session.user.id)
      return { success: false, error: "Forbidden" }

    await db
      .update(comment)
      .set({ body: trimmed })
      .where(eq(comment.id, commentId))

    return { success: true }
  } catch (err) {
    console.error("[editComment]", err)
    return { success: false, error: "Internal server error" }
  }
}

// ---------------------------------------------------------------------------
// deleteComment
// Soft-delete. Allowed for: comment author OR post author.
// ---------------------------------------------------------------------------

export async function deleteComment(
  commentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession()
    if (!session?.user) return { success: false, error: "Not authenticated" }

    const rows = await db
      .select({
        commentAuthorId: comment.authorId,
        postAuthorId: post.authorId,
        deletedAt: comment.deletedAt,
      })
      .from(comment)
      .innerJoin(post, eq(comment.postId, post.id))
      .where(eq(comment.id, commentId))
      .limit(1)

    if (!rows.length) return { success: false, error: "Comment not found" }

    const { commentAuthorId, postAuthorId, deletedAt } = rows[0]
    if (deletedAt) return { success: false, error: "Already deleted" }

    const isCommentAuthor = commentAuthorId === session.user.id
    const isPostAuthor = postAuthorId === session.user.id

    if (!isCommentAuthor && !isPostAuthor)
      return { success: false, error: "Forbidden" }

    await db
      .update(comment)
      .set({ deletedAt: new Date() })
      .where(eq(comment.id, commentId))

    return { success: true }
  } catch (err) {
    console.error("[deleteComment]", err)
    return { success: false, error: "Internal server error" }
  }
}

// ---------------------------------------------------------------------------
// getCommentCount
// Returns total non-deleted comment count for a post.
// ---------------------------------------------------------------------------

export async function getCommentCount(postId: string): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(comment)
    .where(and(eq(comment.postId, postId), isNull(comment.deletedAt)))

  return row?.c ?? 0
}
