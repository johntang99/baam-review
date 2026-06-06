"use client";

import { MessageCircleQuestion } from "lucide-react";

/**
 * Sidebar entry that triggers the AskQuestionModal. The modal listens for
 * clicks on any element with `data-ask-question` anywhere in the
 * document, so this button just carries the attribute — no extra wiring.
 * Styled to match NavItem so it sits cleanly inside the Help section.
 */
export function AskQuestionsNavItem() {
  return (
    <button
      type="button"
      data-ask-question
      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-[13.5px] text-cream/80 hover:bg-cream/[0.06] hover:text-cream transition-colors"
    >
      <MessageCircleQuestion className="h-4 w-4" />
      <span className="flex-1 text-left">Ask Questions</span>
    </button>
  );
}
