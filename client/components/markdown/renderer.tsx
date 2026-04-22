import "../../app/styles.scss"

import { Children, isValidElement, type ReactNode } from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import rehypeHighlight from "rehype-highlight"

import { CopyButton } from "@/components/markdown/copy-button"
import { cn } from "@/lib/utils"

export const markdownBodyClass = cn(
  "prose prose-neutral dark:prose-invert max-w-none",
  "prose-headings:scroll-m-20 prose-headings:font-semibold",
  "prose-p:leading-7 prose-li:leading-7",
  "prose-pre:my-0 prose-pre:border prose-pre:bg-muted/40",
  "prose-code:rounded-md prose-code:px-1.5 prose-code:py-0.5 prose-code:font-mono prose-code:text-[0.9em]",
  "prose-img:rounded-xl",
  "prose-a:text-primary prose-a:no-underline hover:prose-a:underline"
)

function nodeToText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(nodeToText).join("")
  if (isValidElement(node)) {
    const { children } = node.props as { children?: ReactNode }
    return nodeToText(children)
  }
  return ""
}

export const MarkdownPre: Components["pre"] = ({ children, ...props }) => {
  let lang: string | undefined
  let codeText = ""

  for (const child of Children.toArray(children)) {
    if (isValidElement(child) && child.type === "code") {
      const { className = "", children: codeChildren } = child.props as {
        className?: string
        children?: ReactNode
      }
      lang = /language-([\w-]+)/.exec(className)?.[1]
      codeText = nodeToText(codeChildren)
      break
    }
  }

  return (
    <div className="group/code relative my-4">
      <pre
        data-language={lang}
        className={cn(
          "overflow-x-auto rounded-xl border bg-muted/40 p-4 text-sm leading-6 shadow-sm",
          "[&>code]:bg-transparent [&>code]:p-0 [&>code]:text-inherit"
        )}
        {...props}
      >
        {children}
      </pre>

      <div className="absolute top-0 right-0">
        <CopyButton
          text={codeText}
          label={lang ? `Copy ${lang}` : "Copy code"}
          className="border border-border bg-background/95 shadow-sm backdrop-blur"
        />
      </div>
    </div>
  )
}

const MarkdownImage: Components["img"] = ({
  src,
  alt,
  width,
  height,
  className,
  ...props
}) => {
  if (!src) return null

  const resolvedSrc = typeof src === "string" ? src : src.toString()

  const resolvedWidth =
    typeof width === "number"
      ? width
      : typeof width === "string" && width.trim() !== ""
        ? Number(width)
        : 1200

  const resolvedHeight =
    typeof height === "number"
      ? height
      : typeof height === "string" && height.trim() !== ""
        ? Number(height)
        : 800

  return (
    <span className="my-4 overflow-hidden w-full flex items-center justify-center rounded-xl max-w-xl mx-auto">
      <img
        src={resolvedSrc}
        alt={alt ?? "Image"}
        width={Number.isFinite(resolvedWidth) ? resolvedWidth : 1200}
        height={Number.isFinite(resolvedHeight) ? resolvedHeight : 800}
        className={cn("h-auto mx-auto object-contain", className)}
        {...props}
      />
    </span>
  )
}

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className={cn("markdown-body p-3", markdownBodyClass)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeHighlight, { detect: true, ignoreMissing: true }],
        ]}
        components={{
          pre: MarkdownPre,
          img: MarkdownImage,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}