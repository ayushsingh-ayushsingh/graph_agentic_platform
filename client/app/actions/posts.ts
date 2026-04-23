"use server"

import { headers } from "next/headers"
import { eq, and, or, desc, count, ne } from "drizzle-orm"
import { db } from "@/src"
import { post, user } from "@/src/db/schema"
import { auth } from "@/lib/auth"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "untitled"
}

async function getSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PostVisibility = "public" | "private" | "unlisted"

export interface CreatePostInput {
  id?: string
  title: string
  content: string
  tags: string[]
  visibility: PostVisibility
  commentsEnabled: boolean
}

export interface PostListItem {
  id: string
  slug: string
  title: string
  tags: string[]
  visibility: PostVisibility
  authorId: string
  authorName: string
  authorImage: string | null
  publishedAt: string
  commentsEnabled: boolean
}

export interface PostDetail extends PostListItem {
  content: string
}

export interface ListPostsResult {
  posts: PostListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ---------------------------------------------------------------------------
// createOrUpdatePost
// Save draft / publish. Generates slug on first save.
// Returns the post id and slug.
// ---------------------------------------------------------------------------

export async function createOrUpdatePost(
  input: CreatePostInput
): Promise<{ success: true; postId: string; slug: string } | { success: false; error: string }> {
  try {
    const session = await getSession()
    if (!session?.user) return { success: false, error: "Not authenticated" }

    const tagsJson = JSON.stringify(input.tags)

    if (input.id) {
      // ── Update existing post ──────────────────────────────────────────────
      const [existing] = await db
        .select({ id: post.id, slug: post.slug, authorId: post.authorId })
        .from(post)
        .where(eq(post.id, input.id))
        .limit(1)

      if (!existing) return { success: false, error: "Post not found" }
      if (existing.authorId !== session.user.id)
        return { success: false, error: "Forbidden" }

      await db
        .update(post)
        .set({
          title: input.title,
          content: input.content,
          tags: tagsJson,
          visibility: input.visibility,
          commentsEnabled: input.commentsEnabled,
        })
        .where(eq(post.id, input.id))

      return { success: true, postId: existing.id, slug: existing.slug }
    } else {
      // ── Create new post ───────────────────────────────────────────────────
      const uuid = crypto.randomUUID()
      const slug = `${slugify(input.title)}-${uuid}`
      const postId = uuid

      await db.insert(post).values({
        id: postId,
        slug,
        title: input.title,
        content: input.content,
        tags: tagsJson,
        authorId: session.user.id,
        visibility: input.visibility,
        commentsEnabled: input.commentsEnabled,
      })

      return { success: true, postId, slug }
    }
  } catch (err) {
    console.error("[createOrUpdatePost]", err)
    return { success: false, error: "Internal server error" }
  }
}

// ---------------------------------------------------------------------------
// updatePostSettings
// Author-only: patch visibility / commentsEnabled after publish.
// ---------------------------------------------------------------------------

export async function updatePostSettings(
  postId: string,
  patch: { visibility?: PostVisibility; commentsEnabled?: boolean }
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession()
    if (!session?.user) return { success: false, error: "Not authenticated" }

    const [existing] = await db
      .select({ authorId: post.authorId })
      .from(post)
      .where(eq(post.id, postId))
      .limit(1)

    if (!existing) return { success: false, error: "Post not found" }
    if (existing.authorId !== session.user.id)
      return { success: false, error: "Forbidden" }

    await db
      .update(post)
      .set({
        ...(patch.visibility !== undefined && { visibility: patch.visibility }),
        ...(patch.commentsEnabled !== undefined && {
          commentsEnabled: patch.commentsEnabled,
        }),
      })
      .where(eq(post.id, postId))

    return { success: true }
  } catch (err) {
    console.error("[updatePostSettings]", err)
    return { success: false, error: "Internal server error" }
  }
}

// ---------------------------------------------------------------------------
// deletePost
// ---------------------------------------------------------------------------

export async function deletePost(
  postId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession()
    if (!session?.user) return { success: false, error: "Not authenticated" }

    const [existing] = await db
      .select({ authorId: post.authorId })
      .from(post)
      .where(eq(post.id, postId))
      .limit(1)

    if (!existing) return { success: false, error: "Post not found" }
    if (existing.authorId !== session.user.id)
      return { success: false, error: "Forbidden" }

    await db.delete(post).where(eq(post.id, postId))

    return { success: true }
  } catch (err) {
    console.error("[deletePost]", err)
    return { success: false, error: "Internal server error" }
  }
}

// ---------------------------------------------------------------------------
// getPost
// Fetch a single post by slug, enforcing visibility rules.
// ---------------------------------------------------------------------------

export async function getPost(
  slug: string
): Promise<{ success: true; post: PostDetail } | { success: false; error: string; status?: number }> {
  try {
    const session = await getSession()

    const rows = await db
      .select({
        id: post.id,
        slug: post.slug,
        title: post.title,
        content: post.content,
        tags: post.tags,
        visibility: post.visibility,
        authorId: post.authorId,
        authorName: user.name,
        authorImage: user.image,
        publishedAt: post.publishedAt,
        commentsEnabled: post.commentsEnabled,
      })
      .from(post)
      .innerJoin(user, eq(post.authorId, user.id))
      .where(eq(post.slug, slug))
      .limit(1)

    if (!rows.length) return { success: false, error: "Not found", status: 404 }

    const p = rows[0]

    if (p.visibility === "private" && p.authorId !== session?.user?.id) {
      return { success: false, error: "Not found", status: 404 }
    }

    return {
      success: true,
      post: {
        ...p,
        tags: JSON.parse(p.tags || "[]") as string[],
        publishedAt: p.publishedAt.toISOString(),
      },
    }
  } catch (err) {
    console.error("[getPost]", err)
    return { success: false, error: "Internal server error", status: 500 }
  }
}

// ---------------------------------------------------------------------------
// listPosts
// Returns public + unlisted posts (private excluded unless you are the author).
// page is 1-indexed.
// ---------------------------------------------------------------------------

export async function listPosts(
  page = 1,
  pageSize = 10
): Promise<ListPostsResult> {
  const session = await getSession()
  const authorId = session?.user?.id

  const offset = (page - 1) * pageSize

  // Build visibility filter:
  // - Always show public + unlisted
  // - If authenticated, also show this user's private posts
  const visibilityFilter = authorId
    ? or(
        ne(post.visibility, "private"),
        and(eq(post.visibility, "private"), eq(post.authorId, authorId))
      )
    : ne(post.visibility, "private")

  const [totalRow] = await db
    .select({ total: count() })
    .from(post)
    .where(visibilityFilter)

  const rows = await db
    .select({
      id: post.id,
      slug: post.slug,
      title: post.title,
      tags: post.tags,
      visibility: post.visibility,
      authorId: post.authorId,
      authorName: user.name,
      authorImage: user.image,
      publishedAt: post.publishedAt,
      commentsEnabled: post.commentsEnabled,
    })
    .from(post)
    .innerJoin(user, eq(post.authorId, user.id))
    .where(visibilityFilter)
    .orderBy(desc(post.publishedAt))
    .limit(pageSize)
    .offset(offset)

  const total = totalRow?.total ?? 0

  return {
    posts: rows.map((r) => ({
      ...r,
      tags: JSON.parse(r.tags || "[]") as string[],
      publishedAt: r.publishedAt.toISOString(),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

// ---------------------------------------------------------------------------
// getPostById — used by the create page to re-load a draft by id
// ---------------------------------------------------------------------------

export async function getPostById(
  postId: string
): Promise<{ success: true; post: PostDetail } | { success: false; error: string }> {
  try {
    const session = await getSession()
    if (!session?.user) return { success: false, error: "Not authenticated" }

    const rows = await db
      .select({
        id: post.id,
        slug: post.slug,
        title: post.title,
        content: post.content,
        tags: post.tags,
        visibility: post.visibility,
        authorId: post.authorId,
        authorName: user.name,
        authorImage: user.image,
        publishedAt: post.publishedAt,
        commentsEnabled: post.commentsEnabled,
      })
      .from(post)
      .innerJoin(user, eq(post.authorId, user.id))
      .where(and(eq(post.id, postId), eq(post.authorId, session.user.id)))
      .limit(1)

    if (!rows.length) return { success: false, error: "Not found" }

    const p = rows[0]
    return {
      success: true,
      post: {
        ...p,
        tags: JSON.parse(p.tags || "[]") as string[],
        publishedAt: p.publishedAt.toISOString(),
      },
    }
  } catch (err) {
    console.error("[getPostById]", err)
    return { success: false, error: "Internal server error" }
  }
}
