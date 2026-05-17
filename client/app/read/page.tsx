import Link from "next/link"
import { Globe, Lock, Link2, Search, PenSquare } from "lucide-react"

import { listPosts } from "@/app/actions/posts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  PaginationEllipsis,
} from "@/components/ui/pagination"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
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
    variant: "error" as const,
  },
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ReadPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? "1", 10))
  // q is reserved for future postgres FTS — not implemented yet
  // const query = params.q ?? ""

  const result = await listPosts(page, 10)

  const buildHref = (p: number) => {
    const url = new URLSearchParams()
    url.set("page", String(p))
    return `/read?${url.toString()}`
  }

  // Generate page numbers to show in pagination
  const paginationPages: (number | "ellipsis")[] = []
  const { totalPages } = result
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) paginationPages.push(i)
  } else {
    paginationPages.push(1)
    if (page > 3) paginationPages.push("ellipsis")
    for (
      let i = Math.max(2, page - 1);
      i <= Math.min(totalPages - 1, page + 1);
      i++
    ) {
      paginationPages.push(i)
    }
    if (page < totalPages - 2) paginationPages.push("ellipsis")
    paginationPages.push(totalPages)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 sm:px-6 lg:px-8">
        <main className="flex-1 py-4 sm:py-6">
          <section className="space-y-4">
            {/* ─── Header ──────────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-3 border bg-card p-3 shadow-sm">
              <h1 className="text-2xl font-semibold tracking-tight">Blog</h1>
              <Button
                variant="secondary"
                className="h-9 rounded-none px-3"
                render={<Link href="/create" />}
              >
                <PenSquare className="mr-2 h-4 w-4" />
                New post
              </Button>
            </div>

            {/* ─── Search bar (stub — Postgres FTS not implemented yet) ─ */}
            <div className="flex items-center gap-2 border bg-card shadow-sm">
              <div className="relative flex-1">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="blog-search"
                  type="search"
                  placeholder="Search posts… (full-text search coming soon)"
                  disabled
                  className="rounded-none pl-9 text-sm"
                />
              </div>
            </div>

            {/* ─── Posts table ─────────────────────────────────────── */}
            <div className="border bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[45%]">Title</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Published</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.posts.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-12 text-center text-muted-foreground"
                      >
                        No posts yet.{" "}
                        <Link
                          href="/create"
                          className="underline underline-offset-2"
                        >
                          Write the first one
                        </Link>
                        .
                      </TableCell>
                    </TableRow>
                  ) : (
                    result.posts.map((post) => {
                      const vis = VISIBILITY_META[post.visibility]
                      return (
                        <TableRow key={post.id}>
                          {/* Title */}
                          <TableCell className="font-medium">
                            <Link
                              href={`/read/${post.slug}`}
                              className={cn(
                                "line-clamp-2 underline-offset-2 hover:underline",
                                "max-w-80 truncate text-foreground"
                              )}
                            >
                              {post.title}
                            </Link>
                          </TableCell>

                          {/* Author */}
                          <TableCell className="text-muted-foreground">
                            <span className="line-clamp-1 max-w-20 truncate">
                              {post.authorName}
                            </span>
                          </TableCell>

                          {/* Tags */}
                          <TableCell>
                            <div className="scrollbar-hide flex w-full max-w-36 gap-1 overflow-y-auto">
                              {post.tags.length == 0 && (
                                <div className="text-muted-foreground italic">
                                  None
                                </div>
                              )}
                              {post.tags.slice(0, 1).map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="outline"
                                  size={"lg"}
                                  className="rounded-none text-xs"
                                >
                                  {tag}
                                </Badge>
                              ))}
                              {post.tags.length > 1 && (
                                <Badge
                                  variant="outline"
                                  size={"lg"}
                                  className="rounded-none text-xs text-muted-foreground"
                                >
                                  +{post.tags.length - 1}
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          {/* Visibility badge */}
                          <TableCell>
                            <Badge
                              variant={vis.variant}
                              className="inline-flex items-center gap-1 rounded-none"
                            >
                              {vis.icon}
                              {vis.label}
                            </Badge>
                          </TableCell>

                          {/* Date */}
                          <TableCell className="text-right text-muted-foreground">
                            {formatDate(post.publishedAt)}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* ─── Pagination ───────────────────────────────────────── */}
            {totalPages > 1 && (
              <div className="border bg-card p-3 shadow-sm">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        render={
                          page <= 1 ? (
                            <span
                              aria-disabled="true"
                              className="pointer-events-none opacity-50"
                            />
                          ) : undefined
                        }
                        href={page > 1 ? buildHref(page - 1) : undefined}
                      />
                    </PaginationItem>

                    {paginationPages.map((p, i) =>
                      p === "ellipsis" ? (
                        <PaginationItem key={`ell-${i}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
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
                        render={
                          page >= totalPages ? (
                            <span
                              aria-disabled="true"
                              className="pointer-events-none opacity-50"
                            />
                          ) : undefined
                        }
                        href={
                          page < totalPages ? buildHref(page + 1) : undefined
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>

                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Showing {(page - 1) * 10 + 1}–
                  {Math.min(page * 10, result.total)} of {result.total} posts
                </p>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}
