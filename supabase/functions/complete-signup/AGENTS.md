## Email sign-up (`supabase/functions/complete-signup`)

- Email accounts are created only on the server by `complete-signup` (admin createUser with email confirmed) after a one-time, recent `email_verifications` row is consumed; the browser never calls `auth.signUp`. Rationale: "Confirm email" stays on to block sign-ups that skip the code, while verified users still get a session.
- Account lookups by email use the service-role-only SQL function `get_auth_user_id_by_email`, never `auth.admin.listUsers()`. Rationale: listUsers is paginated and silently misses users beyond the first page.
