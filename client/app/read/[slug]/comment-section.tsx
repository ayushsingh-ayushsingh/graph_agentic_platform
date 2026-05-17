"use client"

import { useState, useTransition, useRef } from "react"
import {
  MessageSquare,
  ChevronDown,
  Loader2,
  Pencil,
  Trash2,
  CornerDownRight,
  X,
  Check,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import {
  getRootComments,
  getChildComments,
  addComment,
  editComment,
  deleteComment,
  type CommentData,
} from "@/app/actions/comments"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CurrentUser {
  id: string
  name: string
  image: string | null
}

interface CommentSectionProps {
  postId: string
  postAuthorId: string
  initialComments: CommentData[]
  initialNextCursor: string | null
  initialCount: number
  commentsEnabled: boolean
  currentUser: CurrentUser | null
}

// ---------------------------------------------------------------------------
// Relative time formatter
// ---------------------------------------------------------------------------

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return "just now"
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

// ---------------------------------------------------------------------------
// CommentBox — text area + submit
// ---------------------------------------------------------------------------

function CommentBox({
  placeholder = "What are your thoughts?",
  onSubmit,
  onCancel,
  defaultValue = "",
  submitLabel = "Comment",
  autoFocus = false,
}: {
  placeholder?: string
  onSubmit: (body: string) => Promise<void>
  onCancel?: () => void
  defaultValue?: string
  submitLabel?: string
  autoFocus?: boolean
}) {
  const [body, setBody] = useState(defaultValue)
  const [submitting, startSubmitting] = useTransition()

  const handleSubmit = () => {
    if (!body.trim()) return
    startSubmitting(async () => {
      await onSubmit(body)
      setBody("")
    })
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={body}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
          setBody(e.target.value)
        }
        placeholder={placeholder}
        className="resize-none rounded-none text-sm"
        resize={false}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
      />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleSubmit}
          disabled={submitting || !body.trim()}
          className="rounded-none"
        >
          {submitting ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="mr-1 h-3.5 w-3.5" />
          )}
          {submitLabel}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="rounded-none"
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Cancel
          </Button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CommentCard — single comment with actions + nested replies
// ---------------------------------------------------------------------------

interface CommentCardProps {
  comment: CommentData
  postId: string
  postAuthorId: string
  currentUser: CurrentUser | null
  commentsEnabled: boolean
  depth: number
  onDeleted: (id: string) => void
  onEdited: (id: string, newBody: string) => void
}

function CommentCard({
  comment: c,
  postId,
  postAuthorId,
  currentUser,
  commentsEnabled,
  depth,
  onDeleted,
  onEdited,
}: CommentCardProps) {
  const [replying, setReplying] = useState(false)
  const [editing, setEditing] = useState(false)
  const [children, setChildren] = useState<CommentData[]>([])
  const [childCursor, setChildCursor] = useState<string | null>(null)
  const [childrenLoaded, setChildrenLoaded] = useState(false)
  const [loadingChildren, startLoadingChildren] = useTransition()
  const [loadingMore, startLoadingMore] = useTransition()
  const [deleting, startDeleting] = useTransition()

  const isDeleted = c.deletedAt !== null
  const isCommentAuthor = currentUser?.id === c.author.id
  const isPostAuthor = currentUser?.id === postAuthorId
  const canEdit = isCommentAuthor && !isDeleted
  const canDelete = (isCommentAuthor || isPostAuthor) && !isDeleted
  const canReply = commentsEnabled && !!currentUser && !isDeleted
  const hasReplies = c.replyCount > 0
  const maxDepth = 5 // collapse visual nesting beyond this

  const handleLoadChildren = () => {
    startLoadingChildren(async () => {
      const res = await getChildComments(postId, c.id)
      setChildren(res.comments)
      setChildCursor(res.nextCursor)
      setChildrenLoaded(true)
    })
  }

  const handleLoadMoreChildren = () => {
    startLoadingMore(async () => {
      const res = await getChildComments(postId, c.id, childCursor ?? undefined)
      setChildren((prev) => [...prev, ...res.comments])
      setChildCursor(res.nextCursor)
    })
  }

  const handleReply = async (body: string) => {
    const res = await addComment(postId, body, c.id)
    if (!res.success) return
    setChildren((prev) => [...prev, res.comment])
    setChildrenLoaded(true)
    setReplying(false)
  }

  const handleDelete = () => {
    startDeleting(async () => {
      const res = await deleteComment(c.id)
      if (res.success) onDeleted(c.id)
    })
  }

  const handleEdit = async (body: string) => {
    const res = await editComment(c.id, body)
    if (res.success) {
      onEdited(c.id, body)
      setEditing(false)
    }
  }

  const handleChildDeleted = (id: string) => {
    setChildren((prev) => prev.filter((ch) => ch.id !== id))
  }

  const handleChildEdited = (id: string, newBody: string) => {
    setChildren((prev) =>
      prev.map((ch) => (ch.id === id ? { ...ch, body: newBody } : ch))
    )
  }

  return (
    <div
      className={cn(
        "border-l-2 border-border",
        depth === 0 ? "border-l-0 pl-0" : "pl-3"
      )}
    >
      {/* ── Comment bubble ─────────────────────────────────────────── */}
      <div className={cn("group bg-card p-3", isDeleted && "opacity-60")}>
        {/* Header */}
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          {!isDeleted && (
            <span className="font-medium text-foreground">{c.author.name}</span>
          )}
          {isDeleted && <span className="italic">[deleted]</span>}
          <span>·</span>
          <span>{relativeTime(c.createdAt)}</span>
          {c.updatedAt !== c.createdAt && !isDeleted && (
            <>
              <span>·</span>
              <span className="italic">edited</span>
            </>
          )}
        </div>

        {/* Body */}
        {editing ? (
          <CommentBox
            defaultValue={c.body}
            onSubmit={handleEdit}
            onCancel={() => setEditing(false)}
            submitLabel="Save"
            autoFocus
          />
        ) : (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {c.body}
          </p>
        )}

        {/* Actions */}
        {!editing && (
          <div className="mt-2 flex items-center gap-1">
            {canReply && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setReplying((v) => !v)}
                className="h-6 rounded-none px-2 text-xs text-muted-foreground"
              >
                <CornerDownRight className="mr-1 h-3 w-3" />
                Reply
              </Button>
            )}
            {canEdit && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditing(true)}
                className="h-6 rounded-none px-2 text-xs text-muted-foreground"
              >
                <Pencil className="mr-1 h-3 w-3" />
                Edit
              </Button>
            )}
            {canDelete && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
                className="h-6 rounded-none px-2 text-xs text-muted-foreground hover:border-destructive hover:text-destructive"
              >
                {deleting ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="mr-1 h-3 w-3" />
                )}
                Delete
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── Reply box ──────────────────────────────────────────────── */}
      {replying && (
        <div className="mt-2 border bg-card p-3">
          <CommentBox
            placeholder={`Reply to ${c.author.name}…`}
            onSubmit={handleReply}
            onCancel={() => setReplying(false)}
            submitLabel="Reply"
            autoFocus
          />
        </div>
      )}

      {/* ── Children ───────────────────────────────────────────────── */}
      {hasReplies && !childrenLoaded && (
        <div className="my-2 pl-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleLoadChildren}
            disabled={loadingChildren}
            className="h-6 rounded-none px-2 text-xs text-muted-foreground"
          >
            {loadingChildren ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <ChevronDown className="mr-1 h-3 w-3" />
            )}
            View {c.replyCount} {c.replyCount === 1 ? "reply" : "replies"}
          </Button>
        </div>
      )}

      {childrenLoaded && children.length > 0 && (
        <div className={cn("mt-1 space-y-2 pl-3", depth >= maxDepth && "pl-0")}>
          {children.map((child) => (
            <CommentCard
              key={child.id}
              comment={child}
              postId={postId}
              postAuthorId={postAuthorId}
              currentUser={currentUser}
              commentsEnabled={commentsEnabled}
              depth={depth + 1}
              onDeleted={handleChildDeleted}
              onEdited={handleChildEdited}
            />
          ))}

          {childCursor && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleLoadMoreChildren}
              disabled={loadingMore}
              className="h-6 rounded-none px-2 text-xs text-muted-foreground"
            >
              {loadingMore ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <ChevronDown className="mr-1 h-3 w-3" />
              )}
              Load more replies
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CommentSection — main export
// ---------------------------------------------------------------------------

export function CommentSection({
  postId,
  postAuthorId,
  initialComments,
  initialNextCursor,
  initialCount,
  commentsEnabled,
  currentUser,
}: CommentSectionProps) {
  const [comments, setComments] = useState<CommentData[]>(initialComments)
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor)
  const [count, setCount] = useState(initialCount)
  const [loadingMore, startLoadingMore] = useTransition()

  const handleLoadMore = () => {
    startLoadingMore(async () => {
      const res = await getRootComments(postId, nextCursor ?? undefined)
      setComments((prev) => [...prev, ...res.comments])
      setNextCursor(res.nextCursor)
    })
  }

  const handleAddRoot = async (body: string) => {
    const res = await addComment(postId, body)
    if (!res.success) return
    setComments((prev) => [res.comment, ...prev])
    setCount((n) => n + 1)
  }

  const handleDeleted = (id: string) => {
    setComments((prev) => prev.filter((c) => c.id !== id))
    setCount((n) => Math.max(0, n - 1))
  }

  const handleEdited = (id: string, newBody: string) => {
    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, body: newBody } : c))
    )
  }

  return (
    <div className="border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 border-b p-3">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">
          {count} {count === 1 ? "Comment" : "Comments"}
        </span>
        {!commentsEnabled && (
          <span className="ml-auto text-xs text-muted-foreground italic">
            Comments are disabled
          </span>
        )}
      </div>

      <div className="space-y-4">
        {/* ── New root comment box ────────────────────────────────── */}
        {commentsEnabled && currentUser && (
          <div className="border-b bg-background p-3">
            <p className="mb-2 text-xs text-muted-foreground">
              Commenting as{" "}
              <span className="font-medium text-foreground">
                {currentUser.name}
              </span>
            </p>
            <CommentBox
              onSubmit={handleAddRoot}
              placeholder="What are your thoughts?"
              submitLabel="Add comment"
            />
          </div>
        )}

        {commentsEnabled && !currentUser && (
          <div className="border bg-background p-3 text-center text-sm text-muted-foreground">
            <a href="/auth" className="underline underline-offset-2">
              Sign in
            </a>{" "}
            to leave a comment.
          </div>
        )}

        {/* ── Comment list ────────────────────────────────────────── */}
        {comments.length === 0 && commentsEnabled && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No comments yet. Be the first!
          </p>
        )}

        <div className="space-y-3">
          {comments.map((c) => (
            <CommentCard
              key={c.id}
              comment={c}
              postId={postId}
              postAuthorId={postAuthorId}
              currentUser={currentUser}
              commentsEnabled={commentsEnabled}
              depth={0}
              onDeleted={handleDeleted}
              onEdited={handleEdited}
            />
          ))}
        </div>

        {/* ── Load more root comments ─────────────────────────────── */}
        {nextCursor && (
          <Button
            type="button"
            variant="outline"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="w-full rounded-none"
          >
            {loadingMore ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ChevronDown className="mr-2 h-4 w-4" />
            )}
            Load more comments
          </Button>
        )}
      </div>
    </div>
  )
}
