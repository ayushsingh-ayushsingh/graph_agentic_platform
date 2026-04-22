import { CopyButton } from "@/components/markdown/copy-button"
import { MarkdownRenderer } from "@/components/markdown/renderer"
import { cn } from "@/lib/utils"

const POST = {
  title: "Building a Markdown Editor with Tiptap and Next.js",
  tags: ["react", "typescript", "nextjs", "markdown", "tiptap"],
  content: await fetch(
    "https://gist.githubusercontent.com/allysonsilva/85fff14a22bbdf55485be947566cc09e/raw/fa8048a906ebed3c445d08b20c9173afd1b4a1e5/Full-Markdown.md"
  )
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
      return res.text()
    })
    .then((res) => res.trim())
    .catch((error) => {
      console.error("Error fetching content:", error)
      return "# ERROR loading Markdown"
    }),
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const markdown = POST.content

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 sm:px-6 lg:px-8">
        <main className="flex-1 py-4 sm:py-6">
          <section className="flex min-h-[calc(100vh-2rem)] flex-col rounded-none border bg-card shadow-sm">
            <header className="border-b p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h1
                    className={cn(
                      "my-2 text-4xl font-semibold tracking-tight",
                      "sm:text-5xl"
                    )}
                  >
                    {POST.title} — {slug}
                  </h1>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {POST.tags.map((tag) => (
                      <span
                        key={tag}
                        className={cn(
                          "inline-flex items-center justify-center gap-1.5",
                          "border bg-secondary px-3 py-1 text-sm",
                          "cursor-default text-foreground/90"
                        )}
                      >
                        {tag}
                      </span>
                    ))}
                    <div className="flex-1" />
                    <div className="shrink-0">
                      <CopyButton
                        text={markdown}
                        label="Copy markdown"
                        className="border border-border bg-background/95 shadow-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </header>

            <div className="flex-1 bg-background">
              <MarkdownRenderer content={markdown} />
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
