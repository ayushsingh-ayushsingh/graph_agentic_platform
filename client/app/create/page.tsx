"use client"

import "../styles.scss"
import "./styles.scss"
import "highlight.js/styles/github-dark.css"

import { useEffect, useMemo, useRef, useState } from "react"
import type { ChangeEvent, KeyboardEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import debounce from "lodash/debounce"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import rehypeHighlight from "rehype-highlight"
import {
  Check,
  Circle,
  Copy,
  Loader2,
  Settings,
  Globe,
  Lock,
  Link2,
  MessageSquare,
  AlertCircle,
} from "lucide-react"

import Placeholder from "@tiptap/extension-placeholder"
import { TextStyleKit } from "@tiptap/extension-text-style"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { Markdown } from "tiptap-markdown"
import { Table } from "@tiptap/extension-table"
import TableRow from "@tiptap/extension-table-row"
import TableHeader from "@tiptap/extension-table-header"
import TableCell from "@tiptap/extension-table-cell"
import Image from "@tiptap/extension-image"
import Link from "@tiptap/extension-link"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight"
import { common, createLowlight } from "lowlight"

import { Button } from "@/components/ui/button"
import { Toggle } from "@/components/ui/toggle"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"
import { Popover, PopoverTrigger, PopoverPopup } from "@/components/ui/popover"

import {
  createOrUpdatePost,
  getPostById,
  type PostVisibility,
} from "@/app/actions/posts"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONTENT_KEY = "blog:content"
const TITLE_KEY = "blog:title"
const TAGS_KEY = "blog:tags"

const lowlight = createLowlight(common)

const extensions = [
  TextStyleKit,
  StarterKit.configure({
    codeBlock: false,
    bulletList: { keepMarks: true, keepAttributes: false },
    orderedList: { keepMarks: true, keepAttributes: false },
  }),
  CodeBlockLowlight.configure({
    lowlight,
    defaultLanguage: "plaintext",
    HTMLAttributes: { spellcheck: "false" },
  }),
  Placeholder.configure({ placeholder: "Your story begins here…" }),
  Markdown.configure({
    html: true,
    transformCopiedText: true,
    transformPastedText: true,
  }),
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
  Image.configure({ inline: false, allowBase64: true }),
  Link.configure({ openOnClick: false, autolink: true }),
  TaskList,
  TaskItem.configure({ nested: true }),
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SaveStatus = "idle" | "saving" | "saved" | "error"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMarkdown(editor: ReturnType<typeof useEditor> | null): string {
  if (!editor) return ""
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const md = (editor.storage as any)?.markdown
  return (md?.getMarkdown?.() as string | undefined) ?? editor.getText()
}

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean)
    .filter((tag, idx, arr) => arr.indexOf(tag) === idx)
}

// ---------------------------------------------------------------------------
// MarkdownPre — code block with copy button
// ---------------------------------------------------------------------------

const MarkdownPre: Components["pre"] = ({ children, ...props }) => {
  const preRef = useRef<HTMLPreElement>(null)

  let lang: string | undefined
  for (const child of Array.isArray(children) ? children : [children]) {
    if (
      typeof child === "object" &&
      child &&
      "type" in child &&
      (child as React.ReactElement).type === "code"
    ) {
      const cls =
        ((child as React.ReactElement).props as { className?: string })
          .className ?? ""
      lang = /language-(\w+)/.exec(cls)?.[1]
      break
    }
  }

  const handleCopy = async () => {
    const text = preRef.current?.querySelector("code")?.innerText ?? ""
    if (!text) return
    await navigator.clipboard.writeText(text)
  }

  return (
    <div className="group/code relative my-4">
      <pre
        ref={preRef}
        data-language={lang}
        className={cn(
          "overflow-x-auto rounded-xl border bg-muted/40 p-4 text-sm leading-6 shadow-sm",
          "[&>code]:bg-transparent [&>code]:p-0 [&>code]:text-inherit"
        )}
        {...props}
      >
        {children}
      </pre>
      <div className="absolute top-0 right-0 hidden gap-1 rounded-md border bg-background/95 p-1 shadow-sm backdrop-blur group-hover/code:flex">
        <Button size="icon" variant="secondary" onClick={handleCopy}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Visibility helpers
// ---------------------------------------------------------------------------

const VISIBILITY_OPTIONS: {
  value: PostVisibility
  label: string
  icon: React.ReactNode
  description: string
}[] = [
  {
    value: "public",
    label: "Public",
    icon: <Globe className="h-3.5 w-3.5" />,
    description: "Visible to everyone",
  },
  {
    value: "unlisted",
    label: "Unlisted",
    icon: <Link2 className="h-3.5 w-3.5" />,
    description: "Accessible by link only",
  },
  {
    value: "private",
    label: "Private",
    icon: <Lock className="h-3.5 w-3.5" />,
    description: "Only you can see this",
  },
]

// ---------------------------------------------------------------------------
// TitleArea — isolated component to prevent entire page re-renders on keystroke
// ---------------------------------------------------------------------------

const TitleArea = ({
  initialValue,
  onUpdate,
  onStatusChange,
}: {
  initialValue: string
  onUpdate: (val: string) => void
  onStatusChange: (status: SaveStatus) => void
}) => {
  const [val, setVal] = useState(initialValue)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Sync with prop when parent initializes (e.g. from DB)
  useEffect(() => {
    if (initialValue !== val) {
      setVal(initialValue)
    }
  }, [initialValue])

  const debouncedSync = useMemo(
    () =>
      debounce((newVal: string) => {
        onUpdate(newVal)
        localStorage.setItem(TITLE_KEY, newVal)
        onStatusChange("saved")
      }, 1000),
    [onUpdate, onStatusChange]
  )

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value
    setVal(next)
    onStatusChange("saving")
    debouncedSync(next)
  }

  return (
    <textarea
      ref={textareaRef}
      spellCheck="false"
      value={val}
      onChange={handleChange}
      placeholder="Untitled"
      rows={1}
      style={{ fieldSizing: "content" } as any}
      className={cn(
        "my-2 w-full resize-none border-0 bg-transparent p-0 text-4xl font-semibold tracking-tight outline-none",
        "h-auto min-h-[1em] overflow-hidden placeholder:text-muted-foreground/30 sm:text-5xl"
      )}
    />
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CreatePage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [title, setTitle] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState("")
  const [preview, setPreview] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [previewMarkdown, setPreviewMarkdown] = useState("")

  // Publish settings
  const [postId, setPostId] = useState<string | null>(null)
  const [visibility, setVisibility] = useState<PostVisibility>("public")
  const [commentsEnabled, setCommentsEnabled] = useState(true)

  const didHydrateRef = useRef(false)
  const hydratingEditorRef = useRef(false)
  const isSavingRef = useRef(false)

  // ── Debounced localStorage saves ─────────────────────────────────────────

  const debouncedSaveContent = useMemo(
    () =>
      debounce((markdown: string) => {
        localStorage.setItem(CONTENT_KEY, markdown)
        setSaveStatus("saved")
      }, 3000),
    []
  )

  useEffect(() => {
    return () => {
      debouncedSaveContent.cancel()
    }
  }, [debouncedSaveContent])

  // ── Editor ────────────────────────────────────────────────────────────────

  const editor = useEditor({
    extensions,
    immediatelyRender: false,
    content: "",
    editorProps: {
      attributes: {
        class: cn(
          "w-full outline-none",
          "prose max-w-none prose-neutral dark:prose-invert",
          "prose-headings:scroll-m-20 prose-headings:font-semibold",
          "prose-p:leading-7 prose-li:leading-7",
          "prose-pre:my-0 prose-pre:border prose-pre:bg-muted/40",
          "prose-code:rounded-md prose-code:px-1.5 prose-code:py-0.5 prose-code:font-mono prose-code:text-[0.9em]",
          "prose-img:rounded-xl prose-img:border",
          "focus:outline-none"
        ),
      },
      handlePaste: (view, event) => {
        const hasHtml = event.clipboardData?.types.includes("text/html")
        const text = event.clipboardData?.getData("text/plain") ?? ""
        if (!hasHtml || !text) return false

        event.preventDefault()
        const dt = new DataTransfer()
        dt.setData("text/plain", text)

        view.dom.dispatchEvent(
          new ClipboardEvent("paste", {
            clipboardData: dt,
            bubbles: true,
            cancelable: true,
          })
        )
        return true
      },
    },
    onUpdate: ({ editor }) => {
      if (hydratingEditorRef.current) return
      const markdown = getMarkdown(editor)
      setSaveStatus("saving")
      setSaveError(null)
      debouncedSaveContent(markdown)
      setPreviewMarkdown(markdown)
    },
  })

  // ── Hydrate from localStorage / URL param ─────────────────────────────────

  useEffect(() => {
    if (!editor || didHydrateRef.current) return
    didHydrateRef.current = true

    const idParam = searchParams.get("id")
    if (idParam) {
      // Load existing post from DB
      setPostId(idParam)
      getPostById(idParam).then((result) => {
        if (!result.success) return
        const p = result.post
        setTitle(p.title)
        setTags(p.tags)
        setVisibility(p.visibility)
        setCommentsEnabled(p.commentsEnabled)
        setPreviewMarkdown(p.content)
        hydratingEditorRef.current = true
        editor.commands.setContent(p.content)
        hydratingEditorRef.current = false
      })
      return
    }

    // Fall back to localStorage draft
    const savedTitle = localStorage.getItem(TITLE_KEY) ?? ""
    const savedTagsRaw = localStorage.getItem(TAGS_KEY)
    const savedContent = localStorage.getItem(CONTENT_KEY) ?? ""

    let savedTags: string[] = []
    try {
      savedTags = savedTagsRaw ? (JSON.parse(savedTagsRaw) as string[]) : []
    } catch {
      savedTags = []
    }

    setTitle(savedTitle)
    setTags(savedTags)
    setPreviewMarkdown(savedContent)

    hydratingEditorRef.current = true
    editor.commands.setContent(savedContent)
    hydratingEditorRef.current = false
  }, [editor, searchParams])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const saveTagsImmediately = (next: string[]) => {
    localStorage.setItem(TAGS_KEY, JSON.stringify(next))
  }

  const commitTagInput = () => {
    const next = parseTags(tagDraft)
    if (!next.length) {
      setTagDraft("")
      return
    }
    const merged = Array.from(new Set([...tags, ...next]))
    setTags(merged)
    saveTagsImmediately(merged)
    setTagDraft("")
  }

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      commitTagInput()
      return
    }
    if (e.key === "Backspace" && !tagDraft && tags.length) {
      const next = tags.slice(0, -1)
      setTags(next)
      saveTagsImmediately(next)
    }
  }

  const removeTag = (tag: string) => {
    const next = tags.filter((t) => t !== tag)
    setTags(next)
    saveTagsImmediately(next)
  }

  const togglePreview = () => {
    if (!preview && editor) setPreviewMarkdown(getMarkdown(editor))
    setPreview((current) => !current)
  }

  // ── Save to DB ────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (isSavingRef.current) return
    isSavingRef.current = true
    setSaveStatus("saving")
    setSaveError(null)

    const markdown = getMarkdown(editor)

    const result = await createOrUpdatePost({
      id: postId ?? undefined,
      title: title || "Untitled",
      content: markdown,
      tags,
      visibility,
      commentsEnabled,
    })

    isSavingRef.current = false

    if (!result.success) {
      setSaveStatus("error")
      setSaveError(result.error)
      return
    }

    if (!postId) {
      // First save — update URL without navigation so the page tracks the id
      setPostId(result.postId)
      router.replace(`/create?id=${result.postId}`, { scroll: false })
      // Clear localStorage draft after first DB save
      localStorage.removeItem(CONTENT_KEY)
      localStorage.removeItem(TITLE_KEY)
      localStorage.removeItem(TAGS_KEY)
    }

    setSaveStatus("saved")
  }

  // ── Status indicator ──────────────────────────────────────────────────────

  const statusIcon =
    saveStatus === "saving" ? (
      <Loader2 className="h-4 w-4 animate-spin text-foreground" />
    ) : saveStatus === "saved" ? (
      <Check className="h-4 w-4 text-foreground" />
    ) : saveStatus === "error" ? (
      <AlertCircle className="h-4 w-4 text-destructive" />
    ) : (
      <Circle className="h-3.5 w-3.5 text-foreground opacity-60" />
    )

  const statusLabel =
    saveStatus === "saving"
      ? "Saving…"
      : saveStatus === "saved"
        ? "Saved"
        : saveStatus === "error"
          ? (saveError ?? "Error")
          : "Idle"

  const currentVisibilityOption =
    VISIBILITY_OPTIONS.find((o) => o.value === visibility) ??
    VISIBILITY_OPTIONS[0]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="my-3 bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-4xl flex-col px-4 sm:px-6 lg:px-8">
        <main className="flex-1">
          <section className="space-y-5">
            <div className="flex flex-col rounded-none border bg-card shadow-sm">
              {/* ── Toolbar ────────────────────────────────────────── */}
              <div className="border-b p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="w-full">
                    {/* Title row */}
                    <div className="flex w-full items-center justify-center pb-2">
                      <TitleArea
                        initialValue={title}
                        onUpdate={setTitle}
                        onStatusChange={setSaveStatus}
                      />

                      <div className="flex shrink-0 items-center gap-2">
                        {/* Status icon */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled
                          aria-label={statusLabel}
                          title={statusLabel}
                          className="h-9 w-9 rounded-none border border-transparent text-muted-foreground"
                        >
                          {statusIcon}
                        </Button>

                        {/* Preview toggle */}
                        <Toggle
                          pressed={preview}
                          onPressedChange={togglePreview}
                          aria-label="Toggle preview"
                          className="w-20 rounded-none border-border bg-background px-3 text-sm shadow-sm data-[state=on]:bg-muted"
                        >
                          {preview ? (
                            <span className="inline-flex items-center gap-2">
                              Edit
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2">
                              Preview
                            </span>
                          )}
                        </Toggle>

                        {/* Settings popover */}
                        <Popover>
                          <PopoverTrigger
                            render={
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 rounded-none"
                                aria-label="Publish settings"
                              />
                            }
                          >
                            <Settings className="h-4 w-4" />
                          </PopoverTrigger>
                          <PopoverPopup className="w-72 rounded-none border bg-card p-4 shadow-sm">
                            <p className="mb-3 text-sm font-semibold tracking-tight">
                              Publish Settings
                            </p>

                            {/* Visibility */}
                            <div className="mb-4 space-y-1.5">
                              <label className="text-xs text-muted-foreground">
                                Visibility
                              </label>
                              <Select
                                value={visibility}
                                onValueChange={(v) =>
                                  setVisibility(v as PostVisibility)
                                }
                              >
                                <SelectTrigger className="rounded-none">
                                  <span className="inline-flex items-center gap-2">
                                    {currentVisibilityOption.icon}
                                    <SelectValue />
                                  </span>
                                </SelectTrigger>
                                <SelectPopup className="rounded-none">
                                  {VISIBILITY_OPTIONS.map((opt) => (
                                    <SelectItem
                                      key={opt.value}
                                      value={opt.value}
                                    >
                                      <span className="flex flex-col">
                                        <span className="inline-flex items-center gap-1.5 font-medium">
                                          {opt.icon}
                                          {opt.label}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          {opt.description}
                                        </span>
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectPopup>
                              </Select>
                            </div>

                            {/* Comments toggle */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-sm">Allow comments</span>
                              </div>
                              <Switch
                                checked={commentsEnabled}
                                onCheckedChange={setCommentsEnabled}
                              />
                            </div>
                          </PopoverPopup>
                        </Popover>

                        {/* Save button */}
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={handleSave}
                          disabled={saveStatus === "saving"}
                          className="h-9 rounded-none px-3"
                        >
                          {saveStatus === "saving" ? "Saving…" : "Save"}
                        </Button>
                      </div>
                    </div>

                    {/* Tags row */}
                    <div className="flex flex-wrap items-center gap-2">
                      {tags.map((tag) => (
                        <Button
                          type="button"
                          key={tag}
                          variant={"outline"}
                          onClick={() => removeTag(tag)}
                          aria-label={`Remove ${tag}`}
                          className={cn(
                            "inline-flex items-center justify-center gap-1.5",
                            "border bg-secondary px-3 text-sm",
                            "transition hover:border-destructive/50 hover:text-destructive-foreground"
                          )}
                        >
                          <span>{tag}</span>
                        </Button>
                      ))}

                      <Input
                        value={tagDraft}
                        onChange={(e) => {
                          setTagDraft(e.target.value)
                        }}
                        onKeyDown={handleTagKeyDown}
                        onBlur={commitTagInput}
                        placeholder={
                          tags.length
                            ? "Add more tags…"
                            : "Add tags, separated by commas…"
                        }
                        className={cn(
                          "min-w-xs flex-1 border bg-background text-sm outline-none",
                          "placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        )}
                      />
                    </div>

                    {/* Publish settings summary strip */}
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        {currentVisibilityOption.icon}
                        {currentVisibilityOption.label}
                      </span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        Comments {commentsEnabled ? "on" : "off"}
                      </span>
                      {postId && (
                        <>
                          <span>·</span>
                          <a
                            href={`/read`}
                            className="underline-offset-2 hover:underline"
                          >
                            View all posts
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Editor / Preview ──────────────────────────────── */}
              <div className="flex-1 bg-background">
                {preview ? (
                  <div
                    className="markdown-body prose max-w-none p-3 prose-neutral dark:prose-invert"
                    onClick={() => editor?.commands.focus()}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw, rehypeHighlight]}
                      components={{ pre: MarkdownPre }}
                    >
                      {previewMarkdown || getMarkdown(editor)}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div
                    className="min-h-full cursor-text bg-background"
                    onClick={() => editor?.commands.focus()}
                  >
                    <EditorContent editor={editor} spellCheck="false" />
                  </div>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
