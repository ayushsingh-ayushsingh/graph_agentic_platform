/**
 * Auth pages have their own full-page layout.
 * We suppress the global <Navbar /> by returning children directly.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
