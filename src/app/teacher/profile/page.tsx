import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/ProfileForm";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TeacherProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <ProfileForm user={user} />;
}
