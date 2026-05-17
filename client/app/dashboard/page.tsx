import { headers } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"
import {
  Globe,
  Lock,
  Link2,
  PenSquare,
  MessageSquare,
  LayoutDashboard,
} from "lucide-react"
import { eq, desc, count, and, isNull } from "drizzle-orm"

import { auth } from "@/lib/auth"
import { db } from "@/src"
import { post, comment } from "@/src/db/schema"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination"
import { cn } from "@/lib/utils"

import { ProfileCard } from "./profile-card"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PAGE_SIZE = 10

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

const VISIBILITY_META = {
  public: {
    label: "Public",
    icon: <Globe className="h-3 w-3" />,
    variant: "success" as const,
  },
  unlisted: {
    label: "Unlisted",
    icon: <Link2 className="h-3 w-3" />,
    variant: "warning" as const,
  },
  private: {
    label: "Private",
    icon: <Lock className="h-3 w-3" />,
    variant: "secondary" as const,
  },
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  // ── Auth guard ─────────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/auth?from=/dashboard")

  const user = session.user
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? "1", 10))
  const offset = (page - 1) * PAGE_SIZE

  // ── Fetch user's posts ────────────────────────────────────────────────
  const [totalRow] = await db
    .select({ total: count() })
    .from(post)
    .where(eq(post.authorId, user.id))

  const posts = await db
    .select({
      id: post.id,
      slug: post.slug,
      title: post.title,
      tags: post.tags,
      visibility: post.visibility,
      commentsEnabled: post.commentsEnabled,
      publishedAt: post.publishedAt,
    })
    .from(post)
    .where(eq(post.authorId, user.id))
    .orderBy(desc(post.publishedAt))
    .limit(PAGE_SIZE)
    .offset(offset)

  const total = totalRow?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  // ── Fetch comment counts for each post ────────────────────────────────
  // (one query per post — max 10)
  const commentCountMap: Record<string, number> = {}
  for (const p of posts) {
    const [row] = await db
      .select({ c: count() })
      .from(comment)
      .where(and(eq(comment.postId, p.id), isNull(comment.deletedAt)))
    commentCountMap[p.id] = row?.c ?? 0
  }

  const buildHref = (p: number) => `/dashboard?page=${p}`

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 sm:px-6 lg:px-8">
        <main className="flex-1 py-4 sm:py-6">
          <section className="space-y-4">
            {/* ─── Page header ──────────────────────────────────── */}
            <div className="flex items-center justify-between gap-3 border bg-card p-3 shadow-sm">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">
                  Dashboard
                </h1>
              </div>
              <div className="flex-1"></div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-none px-3 text-xs"
                  render={<Link href="/read" />}
                >
                  Posts
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 rounded-none px-3 text-xs"
                  render={<Link href="/create" />}
                >
                  New
                </Button>
              </div>
            </div>

            {/* ─── Profile card ─────────────────────────────────── */}
            <ProfileCard
              userId={user.id}
              name={user.name}
              email={user.email}
              image={user.image ?? null}
            />

            {/* ─── Posts section ────────────────────────────────── */}
            <div className="border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b p-3">
                <span className="text-sm font-semibold">
                  Your Posts{" "}
                  <span className="font-normal text-muted-foreground">
                    ({total})
                  </span>
                </span>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Comments</TableHead>
                    <TableHead className="text-right">Published</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {posts.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-12 text-center text-muted-foreground"
                      >
                        You haven&apos;t written anything yet.{" "}
                        <Link
                          href="/create"
                          className="underline underline-offset-2"
                        >
                          Write your first post
                        </Link>
                        .
                      </TableCell>
                    </TableRow>
                  ) : (
                    posts.map((p) => {
                      const vis =
                        VISIBILITY_META[
                          p.visibility as keyof typeof VISIBILITY_META
                        ]
                      const tags = JSON.parse(p.tags || "[]") as string[]
                      const commentCount = commentCountMap[p.id] ?? 0

                      return (
                        <TableRow key={p.id}>
                          {/* Title — links to read page; also offers quick edit */}
                          <TableCell className="font-medium">
                            <div className="flex flex-col gap-0.5">
                              <Link
                                href={`/read/${p.slug}`}
                                className={cn(
                                  "line-clamp-1 underline-offset-2 hover:underline",
                                  "text-foreground"
                                )}
                              >
                                {p.title}
                              </Link>
                              <Link
                                href={`/create?id=${p.id}`}
                                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                              >
                                Edit
                              </Link>
                            </div>
                          </TableCell>

                          {/* Visibility */}
                          <TableCell>
                            <Badge
                              variant={vis.variant}
                              className="inline-flex items-center gap-1 rounded-none"
                            >
                              {vis.icon}
                              {vis.label}
                            </Badge>
                          </TableCell>

                          {/* Tags */}
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {tags.slice(0, 2).map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="outline"
                                  className="rounded-none text-xs"
                                >
                                  {tag}
                                </Badge>
                              ))}
                              {tags.length > 2 && (
                                <Badge
                                  variant="outline"
                                  className="rounded-none text-xs"
                                >
                                  +{tags.length - 2}
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          {/* Comment count */}
                          <TableCell>
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 text-xs",
                                !p.commentsEnabled && "opacity-40"
                              )}
                            >
                              <MessageSquare className="h-3 w-3" />
                              {commentCount}
                              {!p.commentsEnabled && " (off)"}
                            </span>
                          </TableCell>

                          {/* Date */}
                          <TableCell className="text-right text-muted-foreground">
                            {formatDate(p.publishedAt)}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* ─── Pagination ───────────────────────────────────── */}
            {totalPages > 1 && (
              <div className="border bg-card p-3 shadow-sm">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href={page > 1 ? buildHref(page - 1) : undefined}
                        render={
                          page <= 1 ? (
                            <span
                              aria-disabled="true"
                              className="pointer-events-none opacity-50"
                            />
                          ) : undefined
                        }
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (p) => (
                        <PaginationItem key={p}>
                          <PaginationLink
                            href={buildHref(p)}
                            isActive={p === page}
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    )}
                    <PaginationItem>
                      <PaginationNext
                        href={
                          page < totalPages ? buildHref(page + 1) : undefined
                        }
                        render={
                          page >= totalPages ? (
                            <span
                              aria-disabled="true"
                              className="pointer-events-none opacity-50"
                            />
                          ) : undefined
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Showing {(page - 1) * PAGE_SIZE + 1}–
                  {Math.min(page * PAGE_SIZE, total)} of {total} posts
                </p>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}
