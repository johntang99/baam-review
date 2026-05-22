// Hand-maintained for Session 2.
// In a later session we'll replace this with `supabase gen types typescript --linked`.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type SubscriptionTier = "trial" | "free" | "starter" | "growth" | "agency";
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete";
export type UserRole = "owner" | "admin" | "staff";
export type Language = "en" | "zh" | "es";
export type Channel = "sms" | "email";
export type CompletedPlatform = "google" | "yelp" | "custom" | "private_feedback";
export type LandingEventType =
  | "page_view"
  | "language_selected"
  | "question_answered"
  | "draft_generated"
  | "draft_regenerated"
  | "draft_edited"
  | "platform_clicked"
  | "private_feedback_submitted";

export type PostReviewActionType =
  | "view"
  | "book_click"
  | "refer_click"
  | "share_click"
  | "follow_click"
  | "done_click";

export type ShareDestination =
  | "wechat"
  | "sms"
  | "copy"
  | "more"
  | "whatsapp"
  | "email"
  | "fb";

export interface SocialHandles {
  xhs?: string;
  ig?: string;
  wechat_mp?: string;
  tiktok?: string;
  fb?: string;
  [key: string]: string | undefined;
}

export type WidgetLayout = "cards" | "compact" | "carousel" | "single";

export type OfferImageAspect = "16:9" | "4:3" | "1:1" | "21:9" | "3:4";

export interface ReferralConfig {
  enabled?: boolean;
  offer_title?: string | null;
  offer_subtitle?: string | null;
  /**
   * Long-form fine print rendered below the image and code. Markdown-lite:
   * **bold**, *italic*, and bullet lines starting with "- " or "* ".
   */
  offer_description?: string | null;
  offer_code?: string | null;
  offer_image_url?: string | null;
  offer_image_aspect?: OfferImageAspect | null;
  /** Override accent color for the share landing card. Null falls back to locations.brand_color. */
  accent_color?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  expires_at?: string | null; // ISO timestamp
}

/**
 * Reviewer's reward card — separate from ReferralConfig (which is the
 * friend's offer on the /s/<token> share landing). This is the personal
 * thank-you shown to the reviewer on /r/<slug>/thank-you after they post.
 */
export interface RewardConfig {
  enabled?: boolean;
  /** Headline of the reward. e.g. "You earned $20 off your next visit". */
  title?: string | null;
  /** How to redeem. e.g. "Show this page at your next visit". */
  subtitle?: string | null;
  /** Coupon / discount code. Independent from referral offer_code. */
  code?: string | null;
  /** Optional hero image at the top of the reward card. */
  image_url?: string | null;
  image_aspect?: OfferImageAspect | null;
  /** Long-form description, plain text with newlines (markdown-lite). */
  description?: string | null;
  /**
   * When false the reward card omits the "Book now & apply this code" CTA —
   * appropriate for retail, walk-in services, product sales etc. When true
   * we use booking_url (or fall back to locations.booking_url).
   */
  booking_enabled?: boolean;
  booking_url?: string | null;
  /**
   * Custom label for the booking CTA button. When null/empty we fall back to
   * the localized default ("Book now & apply this code"). Lets businesses
   * whose booking site doesn't have a coupon field write something like
   * "Book now — show your coupon at your visit".
   */
  booking_cta_label?: string | null;
  /** Override accent color for the reward card. Defaults to gold. */
  accent_color?: string | null;
  expires_at?: string | null; // ISO timestamp
}

export type WidgetCommentLangPref = "auto" | "translated" | "original";

export interface WidgetConfig {
  layout?: WidgetLayout;
  min_rating?: 4 | 5;
  max_count?: number;
  accent_color?: string | null;
  show_aggregate?: boolean;
  show_leave_own?: boolean;
  show_reply?: boolean;
  max_width?: number | null;
  comment_lang_pref?: WidgetCommentLangPref;
  title?: string | null;
  subtitle?: string | null;
}

export type WidgetEventType =
  | "view"
  | "review_click"
  | "leave_own_click"
  | "cta_click";

export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string;
          name: string;
          primary_email: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_tier: SubscriptionTier;
          subscription_status: SubscriptionStatus;
          review_plan: "self_service" | "full_service" | null;
          billing_interval: "month" | "year" | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          included_locations: number;
          trial_ends_at: string | null;
          suspended_at: string | null;
          suspension_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          primary_email: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_tier?: SubscriptionTier;
          subscription_status?: SubscriptionStatus;
          review_plan?: "self_service" | "full_service" | null;
          billing_interval?: "month" | "year" | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          included_locations?: number;
          trial_ends_at?: string | null;
          suspended_at?: string | null;
          suspension_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["accounts"]["Insert"]>;
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          account_id: string;
          full_name: string | null;
          role: UserRole;
          created_at: string;
        };
        Insert: {
          id: string;
          account_id: string;
          full_name?: string | null;
          role?: UserRole;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
        Relationships: [];
      };
      locations: {
        Row: {
          id: string;
          account_id: string;
          slug: string;
          google_place_id: string | null;
          google_review_url: string | null;
          display_name: string;
          address: string | null;
          business_type: string | null;
          review_category: string;
          brand_color: string | null;
          logo_url: string | null;
          default_language: Language;
          supported_languages: Language[];
          welcome_message: Json;
          prompt_questions: Json | null;
          yelp_url: string | null;
          custom_url: string | null;
          custom_url_label: Json;
          website_url: string | null;
          sender_email: string | null;
          sender_name: string | null;
          sender_verified_at: string | null;
          google_resource_name: string | null;
          reviews_synced_at: string | null;
          avg_customer_value_cents: number | null;
          ltv_per_customer_cents: number | null;
          referral_close_rate: number;
          review_attribution_share: number;
          booking_url: string | null;
          social_handles: SocialHandles;
          consent_display_enabled: boolean;
          widget_config: WidgetConfig;
          default_share_theme: string | null;
          referral_config: ReferralConfig;
          reward_config: RewardConfig;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          slug: string;
          google_place_id?: string | null;
          google_review_url?: string | null;
          display_name: string;
          address?: string | null;
          business_type?: string | null;
          review_category?: string;
          brand_color?: string | null;
          logo_url?: string | null;
          default_language?: Language;
          supported_languages?: Language[];
          welcome_message?: Json;
          prompt_questions?: Json | null;
          yelp_url?: string | null;
          custom_url?: string | null;
          custom_url_label?: Json;
          website_url?: string | null;
          sender_email?: string | null;
          sender_name?: string | null;
          sender_verified_at?: string | null;
          google_resource_name?: string | null;
          reviews_synced_at?: string | null;
          avg_customer_value_cents?: number | null;
          ltv_per_customer_cents?: number | null;
          referral_close_rate?: number;
          review_attribution_share?: number;
          booking_url?: string | null;
          social_handles?: SocialHandles;
          consent_display_enabled?: boolean;
          widget_config?: WidgetConfig;
          default_share_theme?: string | null;
          referral_config?: ReferralConfig;
          reward_config?: RewardConfig;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["locations"]["Insert"]>;
        Relationships: [];
      };
      review_requests: {
        Row: {
          id: string;
          location_id: string;
          recipient_name: string;
          recipient_phone: string | null;
          recipient_email: string | null;
          language: Language;
          channel: Channel;
          tracking_token: string;
          message_sent: string | null;
          scheduled_for: string | null;
          sent_at: string | null;
          delivered_at: string | null;
          opened_at: string | null;
          clicked_at: string | null;
          draft_generated_at: string | null;
          completed_platform: CompletedPlatform | null;
          completed_at: string | null;
          flagged_at: string | null;
          flag_reason: string | null;
          consent_display: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          location_id: string;
          recipient_name: string;
          recipient_phone?: string | null;
          recipient_email?: string | null;
          language?: Language;
          channel: Channel;
          tracking_token: string;
          message_sent?: string | null;
          scheduled_for?: string | null;
          sent_at?: string | null;
          delivered_at?: string | null;
          opened_at?: string | null;
          clicked_at?: string | null;
          draft_generated_at?: string | null;
          completed_platform?: CompletedPlatform | null;
          completed_at?: string | null;
          flagged_at?: string | null;
          flag_reason?: string | null;
          consent_display?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["review_requests"]["Insert"]>;
        Relationships: [];
      };
      landing_events: {
        Row: {
          id: string;
          request_id: string | null;
          location_id: string;
          event_type: LandingEventType;
          metadata: Json;
          language: string | null;
          user_agent: string | null;
          occurred_at: string;
        };
        Insert: {
          id?: string;
          request_id?: string | null;
          location_id: string;
          event_type: LandingEventType;
          metadata?: Json;
          language?: string | null;
          user_agent?: string | null;
          occurred_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["landing_events"]["Insert"]>;
        Relationships: [];
      };
      private_feedback: {
        Row: {
          id: string;
          location_id: string;
          request_id: string | null;
          rating: number | null;
          message: string;
          contact_email: string | null;
          contact_phone: string | null;
          language: Language;
          read_at: string | null;
          responded_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          location_id: string;
          request_id?: string | null;
          rating?: number | null;
          message: string;
          contact_email?: string | null;
          contact_phone?: string | null;
          language?: Language;
          read_at?: string | null;
          responded_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["private_feedback"]["Insert"]>;
        Relationships: [];
      };
      embed_loads: {
        Row: {
          id: string;
          location_id: string;
          origin_url: string | null;
          occurred_at: string;
        };
        Insert: {
          id?: string;
          location_id: string;
          origin_url?: string | null;
          occurred_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["embed_loads"]["Insert"]>;
        Relationships: [];
      };
      subscription_events: {
        Row: {
          id: string;
          account_id: string;
          event_type: string;
          stripe_event_id: string | null;
          payload: Json;
          occurred_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          event_type: string;
          stripe_event_id?: string | null;
          payload?: Json;
          occurred_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["subscription_events"]["Insert"]>;
        Relationships: [];
      };
      google_reviews: {
        Row: {
          id: string;
          location_id: string;
          google_review_id: string;
          reviewer_display_name: string | null;
          reviewer_profile_photo_url: string | null;
          rating: number;
          comment: string | null;
          review_create_time: string;
          review_update_time: string;
          reply_comment: string | null;
          reply_update_time: string | null;
          alerted_at: string | null;
          fetched_at: string;
        };
        Insert: {
          id?: string;
          location_id: string;
          google_review_id: string;
          reviewer_display_name?: string | null;
          reviewer_profile_photo_url?: string | null;
          rating: number;
          comment?: string | null;
          review_create_time: string;
          review_update_time: string;
          reply_comment?: string | null;
          reply_update_time?: string | null;
          alerted_at?: string | null;
          fetched_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["google_reviews"]["Insert"]>;
        Relationships: [];
      };
      opt_outs: {
        Row: {
          id: string;
          location_id: string;
          contact: string;
          channel: "email" | "sms";
          opted_out_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          location_id: string;
          contact: string;
          channel: "email" | "sms";
          opted_out_at?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["opt_outs"]["Insert"]>;
        Relationships: [];
      };
      booking_requests: {
        Row: {
          id: string;
          name: string;
          email: string;
          business: string | null;
          phone: string | null;
          website: string | null;
          address: string | null;
          preferred_time: string | null;
          notes: string | null;
          source: string | null;
          language: string;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          business?: string | null;
          phone?: string | null;
          website?: string | null;
          address?: string | null;
          preferred_time?: string | null;
          notes?: string | null;
          source?: string | null;
          language?: string;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["booking_requests"]["Insert"]
        >;
        Relationships: [];
      };
      review_videos: {
        Row: {
          id: string;
          location_id: string;
          review_id: string | null;
          template: string;
          reviewer_name: string | null;
          rating: number | null;
          review_text: string | null;
          brand: Record<string, string> | null;
          has_music: boolean;
          has_voiceover: boolean;
          vertical_path: string | null;
          landscape_path: string | null;
          vertical_bytes: number | null;
          landscape_bytes: number | null;
          duration_seconds: number | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          location_id: string;
          review_id?: string | null;
          template?: string;
          reviewer_name?: string | null;
          rating?: number | null;
          review_text?: string | null;
          brand?: Record<string, string> | null;
          has_music?: boolean;
          has_voiceover?: boolean;
          vertical_path?: string | null;
          landscape_path?: string | null;
          vertical_bytes?: number | null;
          landscape_bytes?: number | null;
          duration_seconds?: number | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["review_videos"]["Insert"]
        >;
        Relationships: [];
      };
      location_subscriptions: {
        Row: {
          id: string;
          location_id: string;
          account_id: string;
          plan: "self_service" | "full_service";
          collection_method: "card" | "invoice";
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          billing_interval: "month" | "year" | null;
          subscription_status: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          location_id: string;
          account_id: string;
          plan: "self_service" | "full_service";
          collection_method?: "card" | "invoice";
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          billing_interval?: "month" | "year" | null;
          subscription_status?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["location_subscriptions"]["Insert"]
        >;
        Relationships: [];
      };
      lists: {
        Row: {
          id: string;
          location_id: string;
          name: string;
          default_language: "en" | "zh" | "es";
          status: "draft" | "sending" | "active" | "completed" | "archived";
          customer_count: number;
          sent_at: string | null;
          completed_at: string | null;
          max_touches: number;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          location_id: string;
          name: string;
          default_language?: "en" | "zh" | "es";
          status?: "draft" | "sending" | "active" | "completed" | "archived";
          customer_count?: number;
          sent_at?: string | null;
          completed_at?: string | null;
          max_touches?: number;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["lists"]["Insert"]>;
        Relationships: [];
      };
      list_customers: {
        Row: {
          id: string;
          list_id: string;
          location_id: string;
          name: string;
          email: string | null;
          phone: string | null;
          language: "en" | "zh" | "es";
          channel: "email" | "sms";
          visit_date: string | null;
          notes: string | null;
          status:
            | "pending"
            | "sent"
            | "delivered"
            | "opened"
            | "clicked"
            | "reviewed"
            | "bounced"
            | "optout"
            | "excluded";
          touches: number;
          selected: boolean;
          excluded_reason:
            | "duplicate_60d"
            | "opted_out"
            | "no_contact"
            | "manual"
            | "bounced"
            | null;
          send_request_id: string | null;
          review_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          list_id: string;
          location_id: string;
          name: string;
          email?: string | null;
          phone?: string | null;
          language?: "en" | "zh" | "es";
          channel?: "email" | "sms";
          visit_date?: string | null;
          notes?: string | null;
          status?:
            | "pending"
            | "sent"
            | "delivered"
            | "opened"
            | "clicked"
            | "reviewed"
            | "bounced"
            | "optout"
            | "excluded";
          touches?: number;
          selected?: boolean;
          excluded_reason?:
            | "duplicate_60d"
            | "opted_out"
            | "no_contact"
            | "manual"
            | "bounced"
            | null;
          send_request_id?: string | null;
          review_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["list_customers"]["Insert"]
        >;
        Relationships: [];
      };
      list_events: {
        Row: {
          id: string;
          list_customer_id: string;
          list_id: string;
          location_id: string;
          event_type:
            | "sent"
            | "delivered"
            | "opened"
            | "clicked"
            | "reviewed"
            | "bounced"
            | "optout"
            | "resent";
          metadata: Json;
          occurred_at: string;
        };
        Insert: {
          id?: string;
          list_customer_id: string;
          list_id: string;
          location_id: string;
          event_type:
            | "sent"
            | "delivered"
            | "opened"
            | "clicked"
            | "reviewed"
            | "bounced"
            | "optout"
            | "resent";
          metadata?: Json;
          occurred_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["list_events"]["Insert"]
        >;
        Relationships: [];
      };
      referrals: {
        Row: {
          id: string;
          location_id: string;
          advocate_request_id: string | null;
          event_type:
            | "share_view"
            | "booking_click"
            | "open_in_maps_click"
            | "leave_own_click"
            | "review_started"
            | "review_submitted"
            | "offer_view"
            | "offer_book_click"
            | "code_copied";
          conversion_request_id: string | null;
          referrer_host: string | null;
          user_agent: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          location_id: string;
          advocate_request_id?: string | null;
          event_type:
            | "share_view"
            | "booking_click"
            | "open_in_maps_click"
            | "leave_own_click"
            | "review_started"
            | "review_submitted"
            | "offer_view"
            | "offer_book_click"
            | "code_copied";
          conversion_request_id?: string | null;
          referrer_host?: string | null;
          user_agent?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["referrals"]["Insert"]>;
        Relationships: [];
      };
      social_graphics: {
        Row: {
          id: string;
          location_id: string;
          google_review_id: string | null;
          size: "og" | "square" | "story";
          theme: string;
          action: "view" | "copy_url" | "download" | "open";
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          location_id: string;
          google_review_id?: string | null;
          size: "og" | "square" | "story";
          theme: string;
          action: "view" | "copy_url" | "download" | "open";
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["social_graphics"]["Insert"]>;
        Relationships: [];
      };
      widget_events: {
        Row: {
          id: string;
          location_id: string;
          event_type: WidgetEventType;
          google_review_id: string | null;
          origin: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          location_id: string;
          event_type: WidgetEventType;
          google_review_id?: string | null;
          origin?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["widget_events"]["Insert"]>;
        Relationships: [];
      };
      post_review_actions: {
        Row: {
          id: string;
          location_id: string;
          request_id: string | null;
          action_type: PostReviewActionType;
          share_destination: ShareDestination | null;
          share_token: string | null;
          language: Language | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          location_id: string;
          request_id?: string | null;
          action_type: PostReviewActionType;
          share_destination?: ShareDestination | null;
          share_token?: string | null;
          language?: Language | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["post_review_actions"]["Insert"]>;
        Relationships: [];
      };
      google_oauth_tokens: {
        Row: {
          account_id: string;
          access_token: string;
          refresh_token: string;
          expiry: string;
          scope: string;
          google_email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          access_token: string;
          refresh_token: string;
          expiry: string;
          scope: string;
          google_email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["google_oauth_tokens"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_account_id: {
        Args: Record<string, never>;
        Returns: string | null;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
