"use client";

import { useState } from "react";
import { Code2, LayoutGrid } from "lucide-react";
import type { WidgetConfig } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { EmbedBuilder } from "./embed-builder";
import { WidgetBuilder } from "./widget-builder";

type Tab = "button" | "widget";

interface Props {
  locationId: string;
  slug: string;
  appUrl: string;
  brandColor: string;
  supportedLanguages: string[];
  defaultLanguage: string;
  widgetConfig: WidgetConfig;
}

export function EmbedTabs(props: Props) {
  const [tab, setTab] = useState<Tab>("widget");

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-full border border-border-base bg-paper p-1">
        <TabBtn
          active={tab === "widget"}
          onClick={() => setTab("widget")}
          icon={<LayoutGrid className="h-4 w-4" />}
        >
          Display widget
        </TabBtn>
        <TabBtn
          active={tab === "button"}
          onClick={() => setTab("button")}
          icon={<Code2 className="h-4 w-4" />}
        >
          Leave-a-review button
        </TabBtn>
      </div>

      {tab === "widget" ? (
        <WidgetBuilder
          locationId={props.locationId}
          slug={props.slug}
          appUrl={props.appUrl}
          brandColor={props.brandColor}
          initialConfig={props.widgetConfig}
        />
      ) : (
        <EmbedBuilder
          slug={props.slug}
          appUrl={props.appUrl}
          brandColor={props.brandColor}
          supportedLanguages={props.supportedLanguages}
          defaultLanguage={props.defaultLanguage}
        />
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13.5px] font-medium transition-all",
        active
          ? "bg-ink text-cream"
          : "bg-transparent text-text-soft hover:text-ink",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
