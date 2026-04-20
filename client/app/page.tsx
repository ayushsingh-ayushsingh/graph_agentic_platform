"use client"

import "./styles.scss"
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
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import {
  oneLight,
  oneDark,
} from "react-syntax-highlighter/dist/esm/styles/prism"
import { useTheme } from "next-themes" // or however you detect dark mode
import type { Components } from "react-markdown"
import type { FormEvent } from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Form } from "@/components/ui/form"
import { Copy, Edit } from "lucide-react"

// ── lowlight: register all common languages ───────────────────
const lowlight = createLowlight(common)

// ── Tiptap extensions ─────────────────────────────────────────
const extensions = [
  TextStyleKit,
  StarterKit.configure({
    // Disable built-in codeBlock — CodeBlockLowlight replaces it
    codeBlock: false,
    bulletList: { keepMarks: true, keepAttributes: false },
    orderedList: { keepMarks: true, keepAttributes: false },
  }),
  CodeBlockLowlight.configure({
    lowlight,
    defaultLanguage: "plaintext",
    // Adds data-language attribute (used by our CSS ::before label)
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

// ── Typed helper to read tiptap-markdown storage ──────────────
// Storage is intentionally untyped by Tiptap — cast to access it safely
function getMarkdownContent(editor: ReturnType<typeof useEditor>): string {
  if (!editor) return ""
  const storage = editor.storage as unknown as Record<
    string,
    | {
        getMarkdown?: () => string
      }
    | undefined
  >
  return storage.markdown?.getMarkdown?.() ?? editor.getText()
}

// ── ReactMarkdown custom code block with syntax highlighting ──
function MarkdownCodeBlock({ isDark }: { isDark: boolean }) {
  const CodeBlock: Components["code"] = ({ className, children, ...rest }) => {
    // Fenced code blocks have className like "language-typescript"
    const match = /language-(\w+)/.exec(className ?? "")
    const language = match?.[1] ?? "text"
    const isInline = !match

    if (isInline) {
      return (
        <code
          className={className}
          style={{
            backgroundColor: "var(--muted)",
            padding: "0.2em 0.4em",
            borderRadius: "0.25rem",
            fontFamily: "monospace",
            fontSize: "0.875em",
          }}
          {...rest}
        >
          {children}
        </code>
      )
    }

    return (
      <SyntaxHighlighter
        style={isDark ? oneDark : oneLight}
        language={language}
        PreTag="div"
        customStyle={{
          borderRadius: "0.5rem",
          margin: "1em 0",
          fontSize: "0.875em",
        }}
      >
        {String(children).replace(/\n$/, "")}
      </SyntaxHighlighter>
    )
  }

  return CodeBlock
}

// ── Types ─────────────────────────────────────────────────────
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

  // Detect dark mode — swap to your own approach if not using next-themes
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

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

  const CodeBlock = MarkdownCodeBlock({ isDark })

  return (
    <div className="relative mx-auto flex h-screen max-w-4xl flex-col px-2">
      {/* ── Messages ── */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto py-4 pb-48">
        {messages.map((msg) => (
          <div key={msg.id} className="group relative border">
            <div className="markdown-body max-h-[50vh] overflow-auto p-3">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{ code: CodeBlock }}
              >
                {msg.content}
              </ReactMarkdown>
            </div>

            <div className="absolute right-0 bottom-0 hidden rounded-md border bg-background shadow-sm backdrop-blur-sm group-hover:flex">
              <Button
                size="icon-sm"
                variant="secondary"
                onClick={() => navigator.clipboard.writeText(msg.content)}
              >
                <Copy />
              </Button>
              <Button size="icon-sm" variant="secondary">
                <Edit />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Input ── */}
      <div className="absolute bottom-0 left-0 w-full px-2 pb-2">
        <Form className="relative flex max-w-full" onSubmit={onSubmit}>
          <Field className="w-full flex-1">
            <FieldLabel className="sr-only">Prompt</FieldLabel>
            <FieldError>This field is required.</FieldError>
            <div className="min-h-16 w-full border bg-background">
              <EditorContent editor={editor} />
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
