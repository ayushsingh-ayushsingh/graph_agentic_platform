"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { LogoIcon } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { signInWithGithub, signInWithGoogle } from "@/lib/auth-client"

export default function AuthPage() {
  const searchParams = useSearchParams()
  // `from` is the URL-encoded path where the user came from (set by middleware)
  const from = searchParams.get("from")
  const callbackURL = from ? decodeURIComponent(from) : "/dashboard"

  return (
    <section className="flex min-h-screen bg-background px-4 py-16 md:py-32">
      <div className="m-auto h-fit w-full max-w-sm rounded-none border bg-card shadow-md">
        <div className="p-8 pb-6">
          <div>
            <Link href="/" aria-label="go home">
              <LogoIcon />
            </Link>
            <h1 className="mt-4 mb-1 text-xl font-semibold">Sign in</h1>
            <p className="text-sm text-muted-foreground">
              Continue with your Google or GitHub account
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            {/* Google */}
            <Button
              type="button"
              variant="outline"
              size="xl"
              className="flex w-full gap-4 rounded-none"
              onClick={() => signInWithGoogle(callbackURL)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="0.98em"
                height="1em"
                viewBox="0 0 256 262"
              >
                <path
                  fill="#4285f4"
                  d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622l38.755 30.023l2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"
                />
                <path
                  fill="#34a853"
                  d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055c-34.523 0-63.824-22.773-74.269-54.25l-1.531.13l-40.298 31.187l-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"
                />
                <path
                  fill="#fbbc05"
                  d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82c0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602z"
                />
                <path
                  fill="#eb4335"
                  d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0C79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"
                />
              </svg>
              <span>Login with Google</span>
            </Button>

            {/* GitHub */}
            <Button
              type="button"
              variant="outline"
              size="xl"
              className="flex w-full gap-4 rounded-none"
              onClick={() => signInWithGithub(callbackURL)}
            >
              <svg
                fill="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12.026 2c-5.509 0-9.974 4.465-9.974 9.974 0 4.406 2.857 8.145 6.821 9.465.499.09.679-.217.679-.481 0-.237-.008-.865-.011-1.696-2.775.602-3.361-1.338-3.361-1.338-.452-1.152-1.107-1.459-1.107-1.459-.905-.619.069-.605.069-.605 1.002.07 1.527 1.028 1.527 1.028.89 1.524 2.336 1.084 2.902.829.091-.645.351-1.085.635-1.334-2.214-.251-4.542-1.107-4.542-4.93 0-1.087.389-1.979 1.024-2.675-.101-.253-.446-1.268.099-2.64 0 0 .837-.269 2.742 1.021a9.582 9.582 0 0 1 2.496-.336 9.554 9.554 0 0 1 2.496.336c1.906-1.291 2.742-1.021 2.742-1.021.545 1.372.203 2.387.099 2.64.64.696 1.024 1.587 1.024 2.675 0 3.833-2.33 4.675-4.552 4.922.355.308.675.916.675 1.846 0 1.334-.012 2.41-.012 2.737 0 .267.178.577.687.479C19.146 20.115 22 16.379 22 11.974 22 6.465 17.535 2 12.026 2z"
                />
              </svg>
              <span>Login with GitHub</span>
            </Button>
          </div>

          <hr className="my-6 border-dashed border-border" />
        </div>

        <div className="border-t bg-muted/40 p-3">
          <p className="text-center text-sm text-muted-foreground">
            <Link
              href="/"
              className="font-medium text-foreground underline decoration-1 underline-offset-4"
            >
              Back to Homepage
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}
