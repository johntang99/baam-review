"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2 } from "lucide-react";
import type { Database } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section, Field } from "@/components/ui/section";
import { LogoUploader } from "@/components/locations/logo-uploader";
import { BrandColorPicker } from "@/components/locations/brand-color-picker";
import { LanguageFields } from "@/components/locations/language-fields";
import { LocalizedField } from "@/components/locations/localized-textarea";
import { parsePromptQuestions } from "@/lib/business-prompts";
import { updateLocation, deleteLocation } from "./actions";

type Location = Database["public"]["Tables"]["locations"]["Row"];

interface SettingsFormProps {
  location: Location;
  accountId: string;
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

export function SettingsForm({ location, accountId }: SettingsFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deletePending, setDeletePending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const welcomeInitial = (location.welcome_message ?? {}) as Record<string, string>;
  const customLabelInitial = (location.custom_url_label ?? {}) as Record<string, string>;

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

        <Field label="Business type" htmlFor="business_type" hint="Drives the default review-prompt chips. e.g., clinic, restaurant, law_office.">
          <Input
            id="business_type"
            name="business_type"
            defaultValue={location.business_type ?? ""}
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

      <Section
        title="External links"
        description="Optional alternatives shown alongside Google on the public review page."
      >
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
