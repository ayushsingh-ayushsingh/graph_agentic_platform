"use client"

import "../styles.scss"

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
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import rehypeHighlight from "rehype-highlight"
import type { Components } from "react-markdown"
import type { FormEvent } from "react"
import { useRef, useState } from "react"
import React from "react"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Form } from "@/components/ui/form"
import { Copy, Edit } from "lucide-react"

// ── lowlight setup ────────────────────────────────────────────
const lowlight = createLowlight(common)

// ── Tiptap extensions ─────────────────────────────────────────
const extensions = [
  TextStyleKit,
  StarterKit.configure({
    codeBlock: false, // replaced by CodeBlockLowlight
    bulletList: { keepMarks: true, keepAttributes: false },
    orderedList: { keepMarks: true, keepAttributes: false },
  }),
  CodeBlockLowlight.configure({
    lowlight,
    defaultLanguage: "plaintext",
    HTMLAttributes: { spellcheck: "false" },
  }),
  Placeholder.configure({ placeholder: "Write something…" }),
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

// ── tiptap-markdown storage accessor (typed) ──────────────────
function getMarkdownContent(editor: ReturnType<typeof useEditor>): string {
  if (!editor) return ""
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const md = (editor.storage as any)?.markdown
  return (md?.getMarkdown?.() as string | undefined) ?? editor.getText()
}

// ── Custom <pre> for ReactMarkdown ────────────────────────────
// Wraps the highlighted block with a copy button.
// rehype-highlight puts language class on <code>, we read it to
// add data-language on <pre> (same attribute Tiptap uses for the
// CSS ::before language label, if you want to add one later).
const MarkdownPre: Components["pre"] = ({ children, ...props }) => {
  const preRef = useRef<HTMLPreElement>(null)

  let lang: string | undefined
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child) && child.type === "code") {
      const cls = (child.props as { className?: string }).className ?? ""
      lang = /language-(\w+)/.exec(cls)?.[1]
    }
  })

  const handleCopy = () => {
    const text = preRef.current?.querySelector("code")?.innerText ?? ""
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="group/code relative">
      <pre ref={preRef} data-language={lang} {...props}>
        {children}
      </pre>
      <div className="absolute top-0 right-0 hidden rounded-md border bg-background shadow-sm backdrop-blur-sm group-hover/code:flex">
        <Button size="icon-xs" variant="secondary" onClick={handleCopy}>
          <Copy />
        </Button>
      </div>
    </div>
  )
}

interface Message {
  id: number
  content: string
}

const seedMessages: Message[] = [
  {
    id: 1,
    content: `**Benchmark Results**

| Model  | Score | Params |
|--------|-------|--------|
| GPT-4  | 86.4  | 1.76T  |
| Claude | 84.9  | ~52B   |

Results are for _instruction-tuned_ models only.`,
  },
  {
    id: 2,
    content: `Here's the evaluation function:

\`\`\`python
def benchmark(model, dataset):
    scores = []
    for sample in dataset:
        result = model.evaluate(sample)
        scores.append(result.score)
    return sum(scores) / len(scores)
\`\`\`

And the TypeScript equivalent:

\`\`\`typescript
async function benchmark(model: Model, dataset: Sample[]): Promise<number> {
  const scores = await Promise.all(dataset.map(s => model.evaluate(s)))
  return scores.reduce((a, b) => a + b, 0) / scores.length
}
\`\`\``,
  },
]

// ── Component ─────────────────────────────────────────────────
export default function App() {
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>(seedMessages)

  const editor = useEditor({
    extensions,
    content: "",
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "prose prose-sm focus:outline-none" },
    },
  })

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editor) return

    const content = getMarkdownContent(editor).trim()
    if (!content) {
      alert("Please enter a message.")
      return
    }

    setLoading(true)
    await new Promise((r) => setTimeout(r, 800))
    setMessages((prev) => [...prev, { id: Date.now(), content }])
    editor.commands.clearContent()
    setLoading(false)
  }

  return (
    <div className="relative mx-auto flex h-screen max-w-4xl flex-col px-2">
      {/* Messages */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto py-4 pb-48">
        {messages.map((msg) => (
          <div key={msg.id} className="group relative border">
            <div className="markdown-body max-h-300 overflow-auto p-3">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                // rehypeRaw must come before rehypeHighlight
                rehypePlugins={[rehypeRaw, rehypeHighlight]}
                components={{ pre: MarkdownPre }}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
            <div className="absolute right-0 bottom-0 hidden rounded-md border bg-background shadow-sm backdrop-blur-sm group-hover:flex">
              <Button
                size="icon-xs"
                variant="secondary"
                onClick={() => navigator.clipboard.writeText(msg.content)}
              >
                <Copy />
              </Button>
              <Button size="icon-xs" variant="secondary">
                <Edit />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="absolute bottom-0 left-0 w-full px-2">
        <Form className="relative flex max-w-full" onSubmit={onSubmit}>
          <Field className="w-full flex-1">
            <FieldLabel className="sr-only">Prompt</FieldLabel>
            <FieldError>This field is required.</FieldError>
            <div className="min-h-16 w-full border bg-background">
              <EditorContent editor={editor}/>
            </div>
          </Field>
          <Button
            loading={loading}
            className="absolute right-1 bottom-1"
            type="submit"
          >
            Submit
          </Button>
        </Form>
      </div>
    </div>
  )
}
