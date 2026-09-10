import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth";

export default async function RootPage() {
  const user = await getCurrentUser();
  redirect(user ? homeFor(user.role) : "/login");
}
