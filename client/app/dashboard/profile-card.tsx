"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Camera,
  Check,
  Loader2,
  Pencil,
  X,
  LogOut,
  User,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { cn } from "@/lib/utils"

import { updateProfile } from "@/app/actions/profile"
import { signOutUser } from "@/lib/auth-client"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProfileCardProps {
  userId: string
  name: string
  email: string
  image: string | null
}

// ---------------------------------------------------------------------------
// ProfileCard — editable profile info card
// ---------------------------------------------------------------------------

export function ProfileCard({ name, email, image }: ProfileCardProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState(false)
  const [nameValue, setNameValue] = useState(name)
  const [imageValue, setImageValue] = useState(image ?? "")
  const [error, setError] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [signOutPending, startSignOut] = useTransition()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setFileError("Please select a valid image file (JPG, PNG, or WebP).")
      return
    }
    if (file.size > 1000 * 1024) {
      setFileError(
        `The selected image is ${(file.size / 1024).toFixed(0)} KB. Please choose an image under 1000 KB.`
      )
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setImageValue(reader.result as string)
      setError(null)
    }
    reader.readAsDataURL(file)
  }

  const handleSave = () => {
    setError(null)
    startTransition(async () => {
      const result = await updateProfile({
        name: nameValue,
        image: imageValue,
      })
      if (!result.success) {
        setError(result.error ?? "Failed to update profile")
        return
      }
      setEditing(false)
      router.refresh()
    })
  }

  const handleCancel = () => {
    setNameValue(name)
    setImageValue(image ?? "")
    setError(null)
    setEditing(false)
  }

  const handleSignOut = () => {
    startSignOut(async () => {
      await signOutUser("/")
    })
  }

  const avatarSrc = imageValue || image || null

  return (
    <div className="border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b p-3">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Profile</span>
        </div>
        <div className="flex items-center gap-2">
          {!editing && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-none px-2 text-xs"
                onClick={() => setEditing(true)}
              >
                <Pencil className="mr-1 h-3 w-3" />
                Edit
              </Button>

              {/* Sign out */}
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button
                      variant="destructive-outline"
                      size="sm"
                      className="h-7 rounded-none px-2 text-xs hover:border-destructive/50 hover:text-destructive"
                    />
                  }
                >
                  <LogOut className="mr-1 h-3 w-3" />
                  Sign out
                </AlertDialogTrigger>
                <AlertDialogPopup>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Sign out?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You will be redirected to the homepage.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogClose
                      render={<Button variant="outline" className="rounded-none" />}
                    >
                      Cancel
                    </AlertDialogClose>
                    <Button
                      variant="destructive"
                      className="rounded-none"
                      onClick={handleSignOut}
                      disabled={signOutPending}
                    >
                      {signOutPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Sign out
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogPopup>
              </AlertDialog>
            </>
          )}

          {editing && (
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 rounded-none px-2 text-xs"
                onClick={handleSave}
                disabled={pending}
              >
                {pending ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Check className="mr-1 h-3 w-3" />
                )}
                Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 rounded-none px-2 text-xs"
                onClick={handleCancel}
              >
                <X className="mr-1 h-3 w-3" />
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          {/* Avatar */}
          <div className="relative shrink-0 self-center sm:self-start">
            <div
              className={cn(
                "size-24 flex items-center justify-center border bg-muted text-muted-foreground",
                "overflow-hidden"
              )}
            >
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarSrc}
                  alt={nameValue}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-3xl font-semibold">
                  {nameValue.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Fields */}
          <div className="min-w-0 flex-1 space-y-3">
            {/* Name */}
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Display name
              </label>
              {editing ? (
                <Input
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  className="rounded-none"
                  placeholder="Your name"
                  id="profile-name"
                />
              ) : (
                <p className="text-sm font-medium">{name}</p>
              )}
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Email
              </label>
              <p className="text-sm text-muted-foreground">{email}</p>
            </div>

            {/* Avatar upload */}
            {editing && (
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-none flex gap-3 px-3 text-xs w-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="h-3 w-3" />
                  Upload avatar
                </Button>
                <p className="mt-1 text-xs text-muted-foreground">
                  JPG, PNG or WebP — max 1000 KB.
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}

            {/* File error dialog */}
            <AlertDialog open={!!fileError} onOpenChange={(open) => !open && setFileError(null)}>
              <AlertDialogPopup>
                <AlertDialogHeader>
                  <AlertDialogTitle>Upload failed</AlertDialogTitle>
                  <AlertDialogDescription>{fileError}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogClose
                    render={<Button variant="outline" className="rounded-none" />}
                  >
                    OK
                  </AlertDialogClose>
                </AlertDialogFooter>
              </AlertDialogPopup>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  )
}
