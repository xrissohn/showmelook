ALTER TABLE public.referral_rewards
DROP CONSTRAINT IF EXISTS referral_rewards_reward_type_check;

ALTER TABLE public.referral_rewards
ADD CONSTRAINT referral_rewards_reward_type_check
CHECK (reward_type IN ('bonus_credits', 'profile_slot', 'survey_shomi_ab', 'survey_shomi'));