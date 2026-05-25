interface UserCardProps {
  fullName: string | null;
  email: string;
}

/**
 * Profile display pinned at the bottom of the sidebar. The Sign out
 * action lives as a sibling sidebar item (SignOutNavItem) inside the
 * Account section so it scrolls into view naturally and doesn't compete
 * with this card for attention.
 */
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
    </div>
  );
}
