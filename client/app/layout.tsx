import "./globals.css"

import { Geist, Geist_Mono, Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils";
import { ModeToggle } from "@/components/blocks/mode-toggle";

const interHeading = Inter({ subsets: ['latin'], variable: '--font-heading' });
const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' })

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", "font-mono", inter.variable, interHeading.variable, geistMono.variable)}
    >
      <body>
        <ThemeProvider>{children}
          <div className="fixed bottom-2 right-2">
            <ModeToggle />
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
