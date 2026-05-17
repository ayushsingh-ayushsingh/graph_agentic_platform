"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { Search, Loader2, X } from "lucide-react"

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
import { searchPosts, type SearchResult } from "@/app/actions/search"

// ---------------------------------------------------------------------------
// SearchBar — client component with debounced FTS
// ---------------------------------------------------------------------------

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function SearchBar() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  const doSearch = useCallback(
    (q: string) => {
      startTransition(async () => {
        const data = await searchPosts(q, 8)
        setResults(data)
        setOpen(true)
      })
    },
    []
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!val.trim()) {
      setResults([])
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(() => doSearch(val), 500)
  }

  const handleClear = () => {
    setQuery("")
    setResults([])
    setOpen(false)
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex items-center gap-2 border bg-card shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="blog-search"
            type="search"
            placeholder="Search posts…"
            value={query}
            onChange={handleChange}
            onFocus={() => query.trim() && results.length > 0 && setOpen(true)}
            className="rounded-none pl-9 pr-9 text-sm"
          />
          {/* Loading / clear */}
          <div className="absolute top-1/2 right-3 -translate-y-1/2">
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : query ? (
              <Button variant="ghost" size="icon" type="button" onClick={handleClear} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Dropdown results */}
      {open && (
        <div className="absolute inset-x-0 z-50 mt-1 max-h-80 overflow-y-auto border bg-card shadow-md">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No results found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[45%]">Title</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead className="text-right">Published</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <Link
                        href={`/read/${r.slug}`}
                        onClick={() => setOpen(false)}
                        className="truncate max-w-60 block underline-offset-2 hover:underline"
                      >
                        {r.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <span className="line-clamp-1 max-w-20 truncate">{r.authorName}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-36 gap-1 overflow-hidden">
                        {r.tags.length === 0 && (
                          <span className="text-muted-foreground italic text-xs">None</span>
                        )}
                        {r.tags.slice(0, 1).map((tag) => (
                          <Badge key={tag} variant="outline" size="lg" className="rounded-none text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {r.tags.length > 1 && (
                          <Badge variant="outline" size="lg" className="rounded-none text-xs text-muted-foreground">
                            +{r.tags.length - 1}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatDate(r.publishedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  )
}
