import { NextResponse, type NextRequest } from "next/server";

const COOKIE_NAME = "baam_selected_location_id";

/**
 * Sets the selected-location cookie. Called by the LocationSwitcher when
 * the user picks from the dropdown. Value can be a UUID or "all" for
 * aggregate.
 *
 * Keeping this as a tiny route instead of a server action so the switcher
 * can post + reload without form-submission machinery.
 */
export async function POST(request: NextRequest) {
  const { value } = (await request.json().catch(() => ({ value: null }))) as {
    value: string | null;
  };

  const response = NextResponse.json({ ok: true });

  if (value === null) {
    response.cookies.delete(COOKIE_NAME);
  } else {
    response.cookies.set(COOKIE_NAME, value, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });
  }

  return response;
}
