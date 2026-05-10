import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/admin/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/app");
  }

  const fullName =
    (user.user_metadata?.full_name as string | undefined) || null;

  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr] bg-cream">
      <Sidebar fullName={fullName} email={user.email!} />
      <div className="flex min-h-screen flex-col">{children}</div>
    </div>
  );
}
