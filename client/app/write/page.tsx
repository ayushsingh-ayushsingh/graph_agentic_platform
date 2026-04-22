"use client"

import "../styles.scss"
import "./styles.scss"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ChangeEvent, KeyboardEvent } from "react"
import debounce from "lodash/debounce"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import rehypeHighlight from "rehype-highlight"
import { Check, Circle, Copy, Loader2 } from "lucide-react"

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

type SaveStatus = "idle" | "saving" | "saved"

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

export default function MarkdownEditor() {
  const [title, setTitle] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState("")
  const [preview, setPreview] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const [previewMarkdown, setPreviewMarkdown] = useState("")

  const titleRef = useRef<HTMLTextAreaElement>(null)
  const didHydrateRef = useRef(false)
  const hydratingEditorRef = useRef(false)

  const growTitle = useCallback(() => {
    const el = titleRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [])

  const debouncedSaveContent = useMemo(
    () =>
      debounce((markdown: string) => {
        localStorage.setItem(CONTENT_KEY, markdown)
        setSaveStatus("saved")
      }, 700),
    []
  )

  const debouncedSaveTitle = useMemo(
    () =>
      debounce((value: string) => {
        localStorage.setItem(TITLE_KEY, value)
        setSaveStatus("saved")
      }, 250),
    []
  )

  useEffect(() => {
    return () => {
      debouncedSaveContent.cancel()
      debouncedSaveTitle.cancel()
    }
  }, [debouncedSaveContent, debouncedSaveTitle])

  const editor = useEditor({
    extensions,
    immediatelyRender: false,
    content: "",
    editorProps: {
      attributes: {
        class: cn(
          "min-h-[55vh] w-full outline-none",
          "prose prose-neutral dark:prose-invert max-w-none",
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
      debouncedSaveContent(markdown)
      setPreviewMarkdown(markdown)
    },
  })

  useEffect(() => {
    if (!editor || didHydrateRef.current) return

    didHydrateRef.current = true

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
  }, [editor])

  useEffect(() => {
    growTitle()
  }, [title, growTitle])

  const handleTitleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setTitle(value)
    setSaveStatus("saving")
    debouncedSaveTitle(value)
    growTitle()
  }

  const saveTagsImmediately = (next: string[]) => {
    localStorage.setItem(TAGS_KEY, JSON.stringify(next))
    setSaveStatus("saved")
  }

  const commitTagInput = () => {
    const next = parseTags(tagDraft)
    if (!next.length) {
      setTagDraft("")
      return
    }

    const merged = Array.from(new Set([...tags, ...next]))
    setTags(merged)
    setSaveStatus("saving")
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
      setSaveStatus("saving")
      saveTagsImmediately(next)
    }
  }

  const removeTag = (tag: string) => {
    const next = tags.filter((t) => t !== tag)
    setTags(next)
    setSaveStatus("saving")
    saveTagsImmediately(next)
  }

  const togglePreview = () => {
    if (!preview && editor) setPreviewMarkdown(getMarkdown(editor))
    setPreview((current) => !current)
  }

  const handleSaveToDb = () => {
    // TODO: wire this to your database save action.
    // Current state is intentionally left as a UI stub.
  }

  const statusIcon =
    saveStatus === "saving" ? (
      <Loader2 className="h-4 w-4 animate-spin text-foreground" />
    ) : saveStatus === "saved" ? (
      <Check className="h-4 w-4 text-foreground" />
    ) : (
      <Circle className="h-3.5 w-3.5 text-foreground opacity-60" />
    )

  const statusLabel =
    saveStatus === "saving"
      ? "Saving"
      : saveStatus === "saved"
        ? "Saved"
        : "Idle"

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 sm:px-6 lg:px-8">
        <main className="flex-1">
          <section className="space-y-5">
            <div className="flex min-h-screen flex-col rounded-none border bg-card shadow-sm">
              <div className="border-b p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="w-full">
                    <div className="flex w-full items-center justify-center">
                      <textarea
                        ref={titleRef}
                        spellCheck="false"
                        value={title}
                        onChange={handleTitleChange}
                        placeholder="Untitled"
                        rows={1}
                        className={cn(
                          "my-2 w-full resize-none border-0 bg-transparent p-0 text-4xl font-semibold tracking-tight outline-none",
                          "placeholder:text-muted-foreground/50 sm:text-5xl"
                        )}
                      />

                      <div className="flex items-center gap-2">
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

                        <Button
                          type="button"
                          variant="secondary"
                          onClick={handleSaveToDb}
                          className="h-9 rounded-none px-3"
                        >
                          Save
                        </Button>
                      </div>
                    </div>

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
                          setSaveStatus("saving")
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
                  </div>
                </div>
              </div>

              <div className="flex-1 bg-background">
                {preview ? (
                  <div
                    className="markdown-body prose prose-neutral dark:prose-invert max-w-none p-3"
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
