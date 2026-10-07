REVOKE ALL ON TABLE public.look_feedback, public.recommendation_insights, public.feedback_reports FROM authenticated;
GRANT SELECT ON TABLE public.look_feedback, public.recommendation_insights, public.feedback_reports TO authenticated;
GRANT UPDATE (moderation_status, decided_by, decided_at) ON TABLE public.look_feedback TO authenticated;
GRANT UPDATE (status, decided_by, decided_at) ON TABLE public.recommendation_insights TO authenticated;