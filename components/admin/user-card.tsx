import { LogOut } from "lucide-react";

interface UserCardProps {
  fullName: string | null;
  email: string;
}

export function UserCard({ fullName, email }: UserCardProps) {
  const initial = (fullName || email).charAt(0).toUpperCase();
  const displayName = fullName || email;

  return (
    <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-cream/10 bg-cream/[0.04] px-2.5 py-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gold text-ink font-semibold text-[13px] flex-shrink-0">
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-cream">
          {displayName}
        </p>
        <p className="truncate text-[11.5px] text-cream/55">{email}</p>
      </div>
      <form action="/api/auth/signout" method="post">
        <button
          type="submit"
          aria-label="Sign out"
          className="flex h-7 w-7 items-center justify-center rounded-md text-cream/55 hover:bg-cream/[0.08] hover:text-cream transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}
