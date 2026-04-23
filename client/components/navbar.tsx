"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  PenSquare,
  BookOpen,
  User,
  ArrowUp,
} from "lucide-react"

import { useSession } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { LogoIcon } from "@/components/logo"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"
import { useState, useEffect } from "react"

export function Navbar() {
  const { data: session, isPending } = useSession()
  const pathname = usePathname()
  const user = session?.user

  // Scroll state
  const [isVisible, setIsVisible] = useState(true)
  const [showScrollTop, setShowScrollTop] = useState(false)

  useEffect(() => {
    let lastScrollY = window.scrollY

    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const isAtTop = currentScrollY < 10
      const isScrollingDown = currentScrollY > lastScrollY

      // Navbar visibility logic: Show at top, hide when scrolling down
      if (isAtTop) {
        setIsVisible(true)
      } else if (isScrollingDown) {
        setIsVisible(false)
      } else {
        // Stay hidden when scrolling up until we reach the top
        setIsVisible(false)
      }

      // Scroll to top button visibility
      setShowScrollTop(currentScrollY > 400)

      lastScrollY = currentScrollY
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Don't render the Navbar on the auth page — it's a full-screen sign-in form
  if (pathname.startsWith("/auth")) return null

  const navLinks = [
    { href: "/read", label: "Blog", icon: BookOpen },
    { href: "/create", label: "Write", icon: PenSquare },
  ]

  return (
    <>
      <nav
        className={cn(
          "sticky top-0 z-50 border-b bg-card transition-transform duration-300 ease-in-out",
          !isVisible && "-translate-y-full"
        )}
      >
        <div className="mx-auto flex h-12 max-w-4xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link href="/" className="shrink-0" aria-label="Home">
            <LogoIcon className="h-5 w-5" />
          </Link>

          {/* Auth controls */}
          <div className="flex items-center gap-2">
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : user ? (
              <>
                {/* Avatar + dashboard link */}
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "rounded-none p-0 text-xs",
                    pathname.startsWith("/dashboard") && "bg-muted"
                  )}
                  render={<Link href="/dashboard" />}
                >
                  {user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.image}
                      alt={user.name}
                      className="size-6 object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="flex h-5 w-5 items-center justify-center bg-muted text-xs font-semibold">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </Button>
              </>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                className="h-8 rounded-none px-3 text-xs"
                render={
                  <Link href={`/auth?from=${encodeURIComponent(pathname)}`} />
                }
              >
                <User className="mr-1.5 h-3.5 w-3.5" />
                Sign in
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Scroll to Top Button */}
      <Button
        variant="secondary"
        size="icon"
        className={cn(
          "fixed bottom-6 right-6 z-50 h-10 w-10 rounded-full shadow-lg transition-all duration-300",
          showScrollTop
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-10 opacity-0"
        )}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <ArrowUp className="h-5 w-5" />
      </Button>
    </>
  )
}
