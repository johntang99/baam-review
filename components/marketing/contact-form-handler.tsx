"use client";

import { useEffect } from "react";

/**
 * Client-side enhancement for the static contact form in
 * public/marketing-contact.html. readMarketingDoc strips <script> tags
 * from the prototype, so we re-add behaviour here as a mounted client
 * component. Looks up the form by data attribute, attaches a submit
 * handler that POSTs to /api/contact/ask (the same endpoint the
 * AskQuestionModal uses), and swaps in the success state on success.
 *
 * Why this pattern: keeps the form's markup + styling in the static
 * HTML where the rest of the marketing design lives, while letting the
 * codebase own the actual submission logic.
 */
export function ContactFormHandler() {
  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>(
      "[data-contact-form]",
    );
    if (!form) return;

    const submitBtn = form.querySelector<HTMLButtonElement>(
      "[data-contact-submit]",
    );
    const errorEl = form.querySelector<HTMLElement>("[data-contact-error]");
    const successEl = document.querySelector<HTMLElement>(
      "[data-contact-success]",
    );
    const successEmailEl = document.querySelector<HTMLElement>(
      "[data-contact-success-email]",
    );

    function setError(msg: string | null) {
      if (!errorEl) return;
      if (msg) {
        errorEl.textContent = msg;
        errorEl.classList.add("visible");
      } else {
        errorEl.textContent = "";
        errorEl.classList.remove("visible");
      }
    }

    async function onSubmit(e: Event) {
      e.preventDefault();
      if (!form || !submitBtn) return;
      setError(null);

      const formData = new FormData(form);
      const payload = {
        name: String(formData.get("name") ?? "").trim(),
        email: String(formData.get("email") ?? "").trim(),
        subject: String(formData.get("subject") ?? "").trim(),
        question: String(formData.get("question") ?? "").trim(),
      };

      if (!payload.name || !payload.email || !payload.question) {
        setError("Name, email, and message are all required.");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
        setError("Enter a valid email address.");
        return;
      }

      submitBtn.disabled = true;
      const originalLabel = submitBtn.textContent;
      submitBtn.textContent = "Sending…";

      try {
        const res = await fetch("/api/contact/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        if (!res.ok) {
          setError(body.error || "Couldn't send. Try again in a moment.");
          submitBtn.disabled = false;
          submitBtn.textContent = originalLabel;
          return;
        }
        // Success: hide the form, show the confirmation block.
        if (successEmailEl) successEmailEl.textContent = payload.email;
        form.style.display = "none";
        if (successEl) {
          successEl.classList.add("visible");
          successEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      } catch {
        setError("Couldn't reach the server. Check your connection.");
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
      }
    }

    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, []);

  return null;
}
