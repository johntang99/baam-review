"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Save,
  Trash2,
  BookOpen,
  Palette,
  Globe,
  FileText,
  Mail,
  LinkIcon,
} from "lucide-react";
import type { Database } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section, Field } from "@/components/ui/section";
import { LogoUploader } from "@/components/locations/logo-uploader";
import { BrandColorPicker } from "@/components/locations/brand-color-picker";
import { LanguageFields } from "@/components/locations/language-fields";
import { LocalizedField } from "@/components/locations/localized-textarea";
import { SenderFields } from "@/components/locations/sender-fields";
import { parsePromptQuestions } from "@/lib/business-prompts";
import {
  CATEGORY_LABELS,
  REVIEW_CATEGORIES,
  type ReviewCategory,
} from "@/lib/review/industry-presets";
import { updateLocation, deleteLocation } from "./actions";

type Location = Database["public"]["Tables"]["locations"]["Row"];

interface SettingsFormProps {
  location: Location;
  accountId: string;
  defaultFromAddress: string;
}

const WELCOME_PLACEHOLDERS = {
  en: "Thanks for visiting! How was your experience?",
  zh: "感谢您的光临！您的体验如何？",
  es: "¡Gracias por su visita! ¿Cómo fue su experiencia?",
};

const CUSTOM_URL_LABEL_PLACEHOLDERS = {
  en: "Leave a review on our site",
  zh: "在我们网站上留言",
  es: "Dejar una reseña en nuestro sitio",
};

type TabId = "branding" | "languages" | "review" | "email" | "links";

const TABS: Array<{
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "branding", label: "Branding", icon: Palette },
  { id: "languages", label: "Languages", icon: Globe },
  { id: "review", label: "Review form", icon: FileText },
  { id: "email", label: "Email", icon: Mail },
  { id: "links", label: "Links", icon: LinkIcon },
];

const VALID_TAB_IDS = new Set<TabId>(TABS.map((t) => t.id));

function isValidTab(s: string | null): s is TabId {
  return s !== null && VALID_TAB_IDS.has(s as TabId);
}

export function SettingsForm({
  location,
  accountId,
  defaultFromAddress,
}: SettingsFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [deletePending, setDeletePending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Active tab is driven by the URL (?tab=email) so it's bookmarkable,
  // survives refreshes, and a saved-deep-link from another team member
  // lands on the right tab.
  const tabFromUrl = searchParams.get("tab");
  const activeTab: TabId = isValidTab(tabFromUrl) ? tabFromUrl : "branding";

  function setTab(next: TabId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    // replace (not push) so clicking through tabs doesn't pollute browser history.
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const welcomeInitial = (location.welcome_message ?? {}) as Record<string, string>;
  const customLabelInitial = (location.custom_url_label ?? {}) as Record<string, string>;
  const socialInitial = (location.social_handles ?? {}) as Record<string, string>;

  const promptOverride = parsePromptQuestions(location.prompt_questions);
  const serviceChipsInitial = chipMapToTextMap(promptOverride?.service_chips);
  const descriptorChipsInitial = chipMapToTextMap(promptOverride?.descriptor_chips);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateLocation(location.id, fd);
        setSavedAt(Date.now());
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  async function onDelete() {
    if (!confirm(`Delete "${location.display_name}"? This cannot be undone.`)) return;
    setDeletePending(true);
    setError(null);
    try {
      await deleteLocation(location.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setDeletePending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-0">
      {/* TAB NAVIGATION
          Sticky so it stays visible while saving / scrolling within a tab. */}
      <div className="sticky top-0 z-10 -mx-10 mb-8 border-b border-border-base bg-cream/95 px-10 pt-1 backdrop-blur">
        <nav className="flex gap-1 overflow-x-auto" role="tablist">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`relative inline-flex items-center gap-1.5 whitespace-nowrap px-4 py-3 text-[13.5px] font-medium transition-colors ${
                  active
                    ? "text-ink"
                    : "text-text-soft hover:text-ink"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
                {active && (
                  <span className="absolute inset-x-3 -bottom-px h-[2px] bg-forest" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* All sections stay mounted (just hidden when their tab is inactive)
          so the form submit picks up every field in one go. Switching tabs
          is purely a CSS toggle — no remount, no lost typed-in values. */}

      <div className={activeTab === "branding" ? "" : "hidden"}>
      <Section
        title="Branding"
        description="What customers see when they land on the public review page."
      >
        <Field label="Logo">
          <LogoUploader
            accountId={accountId}
            initialUrl={location.logo_url}
            brandColor={location.brand_color ?? "#1F4D3F"}
            fallbackInitial={location.display_name.charAt(0).toUpperCase()}
            fieldName="logo_url"
          />
        </Field>

        <Field label="Display name" htmlFor="display_name">
          <Input
            id="display_name"
            name="display_name"
            defaultValue={location.display_name}
            required
          />
        </Field>

        <Field label="Brand color">
          <BrandColorPicker
            name="brand_color"
            initial={location.brand_color ?? "#1F4D3F"}
          />
        </Field>

        <Field label="Business type" htmlFor="business_type" hint="Raw Google Business Profile category (auto-filled). Read-only label — change the review category below to affect the public review page.">
          <Input
            id="business_type"
            name="business_type"
            defaultValue={location.business_type ?? ""}
          />
        </Field>

        <Field
          label="Review category"
          htmlFor="review_category"
          hint="Drives the service + quality chips on the public review page (/r/...). Auto-classified from Google; override here if it picked wrong."
        >
          <ReviewCategorySelect
            name="review_category"
            value={location.review_category ?? "other"}
          />
        </Field>

        <Field label="Address" htmlFor="address">
          <Input
            id="address"
            name="address"
            defaultValue={location.address ?? ""}
          />
        </Field>
      </Section>
      </div>

      <div className={activeTab === "languages" ? "" : "hidden"}>
      <Section
        title="Languages"
        description="Pick which languages your customers can review in. Each gets its own welcome message below."
      >
        <LanguageFields
          initialDefault={location.default_language}
          initialSupported={location.supported_languages}
        >
          {(supported) => (
            <Field
              label="Welcome message"
              hint="Shown above the review form. One per supported language."
            >
              <LocalizedField
                name="welcome"
                languages={supported}
                initialValues={welcomeInitial}
                placeholder={WELCOME_PLACEHOLDERS}
                rows={3}
              />
            </Field>
          )}
        </LanguageFields>
      </Section>
      </div>

      <div className={activeTab === "links" ? "" : "hidden"}>
      <Section
        title="External links"
        description="Optional alternatives shown alongside Google on the public review page."
      >
        <Field
          label="Website URL"
          htmlFor="website_url"
          hint="Your business homepage. Used when a referred friend clicks the business name on the recommendation card — they land here instead of the review form."
        >
          <Input
            id="website_url"
            name="website_url"
            type="url"
            placeholder="https://drhuang.com"
            defaultValue={location.website_url ?? ""}
          />
        </Field>

        <Field label="Yelp URL" htmlFor="yelp_url">
          <Input
            id="yelp_url"
            name="yelp_url"
            type="url"
            placeholder="https://www.yelp.com/biz/..."
            defaultValue={location.yelp_url ?? ""}
          />
        </Field>

        <Field
          label="Custom URL"
          htmlFor="custom_url"
          hint="Anything: your own testimonial form, Xiaohongshu, etc."
        >
          <Input
            id="custom_url"
            name="custom_url"
            type="url"
            defaultValue={location.custom_url ?? ""}
          />
        </Field>

        <CustomLabelField initialLabels={customLabelInitial} location={location} />
      </Section>
      </div>

      <div className={activeTab === "review" ? "" : "hidden"}>
      <Section
        title="Post-review actions"
        description="Drives the “While you're here” card on the thank-you page after a customer is sent to Google. Leave blank to hide the matching CTA."
      >
        <Field
          label="Booking URL"
          htmlFor="booking_url"
          hint="Where the “Book your next visit” button opens. Vagaro, Calendly, Square, your own scheduler — anything."
        >
          <Input
            id="booking_url"
            name="booking_url"
            type="url"
            placeholder="https://book.example.com/..."
            defaultValue={location.booking_url ?? ""}
          />
        </Field>
      </Section>
      </div>

      <div className={activeTab === "links" ? "" : "hidden"}>
      <Section
        title="Social handles"
        description="Used on the post-review “Follow us” strip. Leave blank to hide the row."
      >
        <Field label="Facebook" htmlFor="social_fb" hint="Just the page slug, e.g. drhuangacupuncture">
          <Input
            id="social_fb"
            name="social_fb"
            placeholder="drhuangacupuncture"
            defaultValue={socialInitial.fb ?? ""}
          />
        </Field>
        <Field label="Instagram" htmlFor="social_ig" hint="Username without the @">
          <Input
            id="social_ig"
            name="social_ig"
            placeholder="drhuangacu"
            defaultValue={socialInitial.ig ?? ""}
          />
        </Field>
        <Field label="Xiaohongshu (小红书)" htmlFor="social_xhs" hint="User ID from the share-profile URL">
          <Input
            id="social_xhs"
            name="social_xhs"
            placeholder="drhuangtcm"
            defaultValue={socialInitial.xhs ?? ""}
          />
        </Field>
        <Field label="WeChat Official Account" htmlFor="social_wechat_mp" hint="WeChat ID for the official account">
          <Input
            id="social_wechat_mp"
            name="social_wechat_mp"
            placeholder="drhuangtcm"
            defaultValue={socialInitial.wechat_mp ?? ""}
          />
        </Field>
        <Field label="TikTok" htmlFor="social_tiktok" hint="Username without the @">
          <Input
            id="social_tiktok"
            name="social_tiktok"
            placeholder="drhuang"
            defaultValue={socialInitial.tiktok ?? ""}
          />
        </Field>
      </Section>
      </div>

      <div className={activeTab === "email" ? "" : "hidden"}>
      <Section
        title="Email sender"
        description="Configure how review-request emails for this location appear in the recipient's inbox. Sending from your own domain is the single biggest lever for landing in Primary instead of Promotions."
      >
        <div className="flex items-start gap-2.5 rounded-xl border border-forest/20 bg-forest/[0.05] px-3.5 py-3 text-[12.5px] text-text">
          <BookOpen className="h-4 w-4 mt-0.5 flex-shrink-0 text-forest" />
          <p className="leading-relaxed">
            <span className="font-medium text-ink">Setup guide:</span>{" "}
            <Link
              href="/app/docs/custom-sender-setup"
              target="_blank"
              className="text-forest underline hover:no-underline"
            >
              How to set up a custom sender domain (DNS, SPF, DKIM, MX) →
            </Link>{" "}
            Step-by-step SOP covering subdomain vs root, DNS records, Resend
            verification, and troubleshooting.
          </p>
        </div>

        <SenderFields
          initialEmail={location.sender_email}
          initialName={location.sender_name}
          verified={!!location.sender_verified_at}
          defaultFromAddress={defaultFromAddress}
        />
      </Section>
      </div>

      <div className={activeTab === "review" ? "" : "hidden"}>
      <Section
        title="Review prompts"
        description="Customize the chip options shown on your public review page. One option per line. Leave blank to use the defaults for your business type."
      >
        <Field
          label="Service options"
          hint='Shown under "Service you received". e.g., Acupuncture, Massage, Cupping.'
        >
          <LocalizedField
            name="service_chips"
            languages={location.supported_languages}
            initialValues={serviceChipsInitial}
            placeholder={{
              en: "Acupuncture\nMassage\nCupping",
              zh: "针灸\n按摩\n拔罐",
              es: "Acupuntura\nMasaje\nVentosas",
            }}
            rows={5}
          />
        </Field>

        <Field
          label="One-word descriptors"
          hint='Shown under "In one word". e.g., Professional, Warm, Knowledgeable.'
        >
          <LocalizedField
            name="descriptor_chips"
            languages={location.supported_languages}
            initialValues={descriptorChipsInitial}
            placeholder={{
              en: "Professional\nWarm\nKnowledgeable",
              zh: "专业\n热情\n有经验",
              es: "Profesional\nCálido\nExperto",
            }}
            rows={5}
          />
        </Field>
      </Section>
      </div>

      <div className="flex items-center justify-between border-t border-border-base pt-6 mt-2">
        <button
          type="button"
          onClick={onDelete}
          disabled={deletePending}
          className="inline-flex items-center gap-1.5 text-[13px] text-text-soft hover:text-alert disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {deletePending ? "Deleting…" : "Delete location"}
        </button>

        <div className="flex items-center gap-3">
          {error && (
            <p className="text-[13px] text-alert" role="alert">
              {error}
            </p>
          )}
          {savedAt && !error && !pending && (
            <p className="text-[12.5px] text-success">Saved.</p>
          )}
          <Button type="submit" disabled={pending}>
            <Save className="h-4 w-4" />
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function chipMapToTextMap(
  chips:
    | Partial<Record<"en" | "zh" | "es", string[]>>
    | undefined
    | null,
): Record<string, string> {
  if (!chips) return {};
  const out: Record<string, string> = {};
  for (const lang of ["en", "zh", "es"] as const) {
    const arr = chips[lang];
    if (arr && arr.length > 0) out[lang] = arr.join("\n");
  }
  return out;
}

function CustomLabelField({
  initialLabels,
  location,
}: {
  initialLabels: Record<string, string>;
  location: Location;
}) {
  return (
    <Field
      label="Custom URL button label"
      hint="Localized button text shown next to the Google CTA on the review page."
    >
      <LocalizedField
        name="custom_url_label"
        languages={location.supported_languages}
        initialValues={initialLabels}
        placeholder={CUSTOM_URL_LABEL_PLACEHOLDERS}
        variant="input"
      />
    </Field>
  );
}

/**
 * Dropdown of the 46 review_category values, grouped by audit parent
 * (Food & Beverage, Medical & Health, …). The category drives the
 * trilingual service + quality chip presets on /r/[slug].
 */
function ReviewCategorySelect({
  name,
  value,
}: {
  name: string;
  value: string;
}) {
  // Bucket the 46 categories by their `parent` for <optgroup>.
  const byParent = new Map<string, ReviewCategory[]>();
  for (const key of REVIEW_CATEGORIES) {
    const parent = CATEGORY_LABELS[key].parent;
    const bucket = byParent.get(parent) ?? [];
    bucket.push(key);
    byParent.set(parent, bucket);
  }
  return (
    <select
      id={name}
      name={name}
      defaultValue={value}
      className="flex h-10 w-full rounded-lg border border-border-base bg-paper px-3 py-2 text-sm text-text focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/15"
    >
      {[...byParent.entries()].map(([parent, keys]) => (
        <optgroup key={parent} label={parent}>
          {keys.map((k) => (
            <option key={k} value={k}>
              {CATEGORY_LABELS[k].en}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
