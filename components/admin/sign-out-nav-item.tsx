import { LogOut } from "lucide-react";

/**
 * Sign-out item styled to look like a NavItem but rendered as a
 * form/button (so it can POST to /api/auth/signout). Sits inside the
 * Account section in the sidebar so it's always reachable.
 */
export function SignOutNavItem() {
  return (
    <form action="/api/auth/signout" method="post">
      <button
        type="submit"
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-[13.5px] text-cream/80 hover:bg-cream/[0.06] hover:text-cream transition-colors"
      >
        <LogOut className="h-4 w-4" />
        <span className="flex-1 text-left">Sign out</span>
      </button>
    </form>
  );
}
