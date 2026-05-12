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
  | "email";

export interface SocialHandles {
  xhs?: string;
  ig?: string;
  wechat_mp?: string;
  tiktok?: string;
  fb?: string;
  [key: string]: string | undefined;
}

export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string;
          name: string;
          primary_email: string;
          stripe_customer_id: string | null;
          subscription_tier: SubscriptionTier;
          subscription_status: SubscriptionStatus;
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
          subscription_tier?: SubscriptionTier;
          subscription_status?: SubscriptionStatus;
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
          brand_color: string | null;
          logo_url: string | null;
          default_language: Language;
          supported_languages: Language[];
          welcome_message: Json;
          prompt_questions: Json | null;
          yelp_url: string | null;
          custom_url: string | null;
          custom_url_label: Json;
          sender_email: string | null;
          sender_name: string | null;
          sender_verified_at: string | null;
          google_resource_name: string | null;
          reviews_synced_at: string | null;
          avg_customer_value_cents: number | null;
          booking_url: string | null;
          social_handles: SocialHandles;
          consent_display_enabled: boolean;
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
          brand_color?: string | null;
          logo_url?: string | null;
          default_language?: Language;
          supported_languages?: Language[];
          welcome_message?: Json;
          prompt_questions?: Json | null;
          yelp_url?: string | null;
          custom_url?: string | null;
          custom_url_label?: Json;
          sender_email?: string | null;
          sender_name?: string | null;
          sender_verified_at?: string | null;
          google_resource_name?: string | null;
          reviews_synced_at?: string | null;
          avg_customer_value_cents?: number | null;
          booking_url?: string | null;
          social_handles?: SocialHandles;
          consent_display_enabled?: boolean;
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
