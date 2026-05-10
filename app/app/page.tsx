import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Dashboard — BAAM Review",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const fullName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "there";
  const firstName = fullName.split(" ")[0];

  return (
    <main className="px-10 py-10">
      <header className="max-w-2xl space-y-2">
        <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
          Welcome
        </p>
        <h1 className="font-display text-[34px] leading-tight text-ink">
          Hello, {firstName}.
        </h1>
        <p className="text-[15px] text-text-soft leading-relaxed">
          Your BAAM Review workspace is ready. The dashboard, locations,
          analytics and review-request flows will land in the next sessions.
        </p>
      </header>
    </main>
  );
}
