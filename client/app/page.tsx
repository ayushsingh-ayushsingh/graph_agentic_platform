import { redirect } from "next/navigation"

const Page = () => {
  redirect("/read")
  return <div>Page</div>
}

export default Page
