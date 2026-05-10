import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Dashboard — BAAM Review",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, account_id")
    .eq("id", user!.id)
    .maybeSingle();

  const { data: account } = profile?.account_id
    ? await supabase
        .from("accounts")
        .select("name, subscription_tier")
        .eq("id", profile.account_id)
        .maybeSingle()
    : { data: null };

  const fullName =
    profile?.full_name ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "there";
  const firstName = fullName.split(" ")[0];

  const accountName = account?.name ?? null;
  const tier = account?.subscription_tier ?? null;

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

      {accountName && (
        <section className="mt-10 max-w-2xl rounded-2xl border border-border-base bg-paper p-5 shadow-sm">
          <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
            Account
          </p>
          <p className="mt-1 font-display text-[18px] text-ink">
            {accountName}
          </p>
          {tier && (
            <p className="mt-1 text-[12.5px] text-text-soft capitalize">
              {tier} plan
            </p>
          )}
        </section>
      )}
    </main>
  );
}
