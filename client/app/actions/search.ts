"use server"

import { sql } from "drizzle-orm"
import { db } from "@/src"

// ---------------------------------------------------------------------------
// searchPosts — Postgres full-text search using websearch_to_tsquery
// ---------------------------------------------------------------------------

export interface SearchResult {
  id: string
  slug: string
  title: string
  authorName: string
  tags: string[]
  publishedAt: string
  rank: number
}

export async function searchPosts(
  query: string,
  limit = 10
): Promise<SearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const rows = await db.execute<{
    id: string
    slug: string
    title: string
    author_name: string
    tags: string
    published_at: string
    rank: number
  }>(sql`
    WITH q AS (
      SELECT websearch_to_tsquery('english', ${trimmed}) AS tsq
    )
    SELECT
      p.id,
      p.slug,
      p.title,
      p.author_name,
      p.tags,
      p.published_at,
      ts_rank_cd(p.search_tsv, q.tsq) AS rank
    FROM public.post p
    CROSS JOIN q
    WHERE p.visibility = 'public'
      AND p.search_tsv @@ q.tsq
    ORDER BY rank DESC, p.published_at DESC
    LIMIT ${limit}
  `)

  return rows.rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    authorName: r.author_name,
    tags: JSON.parse(r.tags || "[]") as string[],
    publishedAt: r.published_at,
    rank: r.rank,
  }))
}
