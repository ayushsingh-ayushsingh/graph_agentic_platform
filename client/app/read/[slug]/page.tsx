import { notFound } from "next/navigation"
import { headers } from "next/headers"

import { getPost } from "@/app/actions/posts"
import { getRootComments, getCommentCount } from "@/app/actions/comments"
import { auth } from "@/lib/auth"

import { CopyButton } from "@/components/markdown/copy-button"
import { MarkdownRenderer } from "@/components/markdown/renderer"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import { CommentSection } from "./comment-section"
import { AuthorControls } from "./author-controls"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  // ── Fetch post ─────────────────────────────────────────────────────────
  const postResult = await getPost(slug)
  if (!postResult.success) notFound()

  const post = postResult.post

  // ── Auth ───────────────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  const currentUser = session?.user
    ? {
        id: session.user.id,
        name: session.user.name,
        image: session.user.image ?? null,
      }
    : null

  const isAuthor = currentUser?.id === post.authorId

  // ── Comments (SSR initial load) ────────────────────────────────────────
  const [commentsPage, commentCount] = await Promise.all([
    post.commentsEnabled
      ? getRootComments(post.id)
      : Promise.resolve({ comments: [], nextCursor: null }),
    getCommentCount(post.id),
  ])

  const markdown = post.content

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 sm:px-6 lg:px-8">
        <main className="flex-1 py-4 sm:py-6">
          <section className="flex flex-col gap-4">
            {/* ─────────────────── Article card ─────────────────── */}
            <div className="flex flex-col rounded-none border bg-card shadow-sm">
              {/* Header */}
              <header className="border-b p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h1
                      className={cn(
                        "my-2 text-4xl tracking-tight font-semibold",
                        "sm:text-5xl"
                      )}
                    >
                      {post.title}
                    </h1>

                    {/* Meta */}
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {post.authorName}
                      </span>
                      <span>·</span>
                      <span>{formatDate(post.publishedAt)}</span>
                    </div>

                    {/* Tags + copy button */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {post.tags.map((tag) => (
                        <span
                          key={tag}
                          className={cn(
                            "inline-flex items-center justify-center gap-1.5",
                            "border bg-secondary px-3 py-1 text-sm",
                            "cursor-default text-foreground/90"
                          )}
                        >
                          {tag}
                        </span>
                      ))}
                      <div className="flex-1" />
                      <div className="shrink-0">
                        <CopyButton
                          text={markdown}
                          label="Copy markdown"
                          className="border border-border bg-background/95 shadow-sm"
                        />
                      </div>
                    </div>

                    {/* Author controls (only visible to the author) */}
                    {isAuthor && (
                      <AuthorControls
                        postId={post.id}
                        slug={post.slug}
                        initialVisibility={post.visibility}
                        initialCommentsEnabled={post.commentsEnabled}
                      />
                    )}
                  </div>
                </div>
              </header>

              {/* Body */}
              <div className="flex-1 bg-background">
                <MarkdownRenderer content={markdown} />
              </div>
            </div>

            {/* ─────────────────── Comment section ──────────────── */}
            <CommentSection
              postId={post.id}
              postAuthorId={post.authorId}
              initialComments={commentsPage.comments}
              initialNextCursor={commentsPage.nextCursor}
              initialCount={commentCount}
              commentsEnabled={post.commentsEnabled}
              currentUser={currentUser}
            />
          </section>
        </main>
      </div>
    </div>
  )
}
