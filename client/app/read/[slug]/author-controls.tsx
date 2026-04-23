"use client"

import { useState, useTransition } from "react"
import { Globe, Link2, Lock, MessageSquare, Loader2, Pencil, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogPopup,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogClose,
} from "@/components/ui/alert-dialog"

import { updatePostSettings, deletePost, type PostVisibility } from "@/app/actions/posts"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthorControlsProps {
  postId: string
  slug: string
  initialVisibility: PostVisibility
  initialCommentsEnabled: boolean
  onVisibilityChange?: (v: PostVisibility) => void
  onCommentsChange?: (v: boolean) => void
}

const VISIBILITY_OPTIONS: {
  value: PostVisibility
  label: string
  icon: React.ReactNode
}[] = [
  { value: "public", label: "Public", icon: <Globe className="h-3.5 w-3.5" /> },
  { value: "unlisted", label: "Unlisted", icon: <Link2 className="h-3.5 w-3.5" /> },
  { value: "private", label: "Private", icon: <Lock className="h-3.5 w-3.5" /> },
]

// ---------------------------------------------------------------------------
// AuthorControls
// ---------------------------------------------------------------------------

export function AuthorControls({
  postId,
  slug,
  initialVisibility,
  initialCommentsEnabled,
}: AuthorControlsProps) {
  const router = useRouter()
  const [visibility, setVisibility] = useState<PostVisibility>(initialVisibility)
  const [commentsEnabled, setCommentsEnabled] = useState(initialCommentsEnabled)
  const [settingsPending, startSettings] = useTransition()
  const [deletePending, startDelete] = useTransition()

  const handleVisibilityChange = (v: string | null) => {
    if (!v) return
    const newVis = v as PostVisibility
    setVisibility(newVis)
    startSettings(async () => {
      await updatePostSettings(postId, { visibility: newVis })
    })
  }

  const handleCommentsChange = (val: boolean) => {
    setCommentsEnabled(val)
    startSettings(async () => {
      await updatePostSettings(postId, { commentsEnabled: val })
    })
  }

  const handleDelete = () => {
    startDelete(async () => {
      await deletePost(postId)
      router.push("/read")
    })
  }

  const currentOpt = VISIBILITY_OPTIONS.find((o) => o.value === visibility)

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 border-t pt-3 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">Author controls</span>

      {/* Visibility */}
      <div className="flex items-center gap-2">
        <span>Visibility</span>
        <Select value={visibility} onValueChange={handleVisibilityChange}>
          <SelectTrigger className="h-7 w-32 rounded-none text-xs">
            <span className="inline-flex items-center gap-1.5">
              {currentOpt?.icon}
              <SelectValue />
            </span>
          </SelectTrigger>
          <SelectPopup className="rounded-none">
            {VISIBILITY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <span className="inline-flex items-center gap-1.5">
                  {opt.icon}
                  {opt.label}
                </span>
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      </div>

      {/* Comments toggle */}
      <div className="flex items-center gap-2">
        <MessageSquare className="h-3.5 w-3.5" />
        <span>Comments</span>
        <Switch
          checked={commentsEnabled}
          onCheckedChange={handleCommentsChange}
        />
      </div>

      {settingsPending && (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      )}

      <div className="ml-auto flex items-center gap-2">
        {/* Edit */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 rounded-none px-2 text-xs"
          render={<a href={`/create?id=${postId}`} />}
        >
          <Pencil className="mr-1 h-3 w-3" />
          Edit
        </Button>

        {/* Delete */}
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="h-7 rounded-none px-2 text-xs hover:border-destructive/50 hover:text-destructive"
              />
            }
          >
            <Trash2 className="mr-1 h-3 w-3" />
            Delete
          </AlertDialogTrigger>
          <AlertDialogPopup>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this post?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. The blog post and all its comments
                will be permanently removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogClose
                render={
                  <Button variant="outline" className="rounded-none" />
                }
              >
                Cancel
              </AlertDialogClose>
              <Button
                variant="destructive"
                className="rounded-none"
                onClick={handleDelete}
                disabled={deletePending}
              >
                {deletePending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Delete post
              </Button>
            </AlertDialogFooter>
          </AlertDialogPopup>
        </AlertDialog>
      </div>
    </div>
  )
}
