-- 0011_share_dest_fb.sql
-- Allow 'fb' as a share_destination on post_review_actions.
-- 0010 enumerated wechat/sms/copy/more/whatsapp/email; founding-50 customers in
-- markets where Facebook is the default share target (US East Coast clinics)
-- need fb in the same slot WeChat takes in the Chinese-American market.

ALTER TABLE public.post_review_actions
  DROP CONSTRAINT IF EXISTS post_review_actions_share_destination_check;

ALTER TABLE public.post_review_actions
  ADD CONSTRAINT post_review_actions_share_destination_check
  CHECK (
    share_destination IS NULL
    OR share_destination IN (
      'wechat', 'sms', 'copy', 'more', 'whatsapp', 'email', 'fb'
    )
  );
