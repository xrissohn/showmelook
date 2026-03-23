

## Problem: Face Composite Silently Failing

### Root Cause

The frontend sends the avatar as a **relative storage path** (e.g., `6cbac6cd.../avatar-xxx.JPG`) to the `generate-style` edge function. But the edge function only handles two formats:
1. Full Supabase storage URLs containing `supabase.co/storage`
2. Base64 data URLs starting with `data:`

Since the relative path matches neither condition, `avatarFetchSuccess` stays `false`, and the function **silently falls back to generating without your face** — producing a generic model instead.

This explains why recent generations look different from your face.

### Fix

**File: `supabase/functions/generate-style/index.ts`** (line ~674-733)

Add a third condition to handle relative avatar paths. When the `userAvatarUrl` is a relative path (not a full URL, not base64), construct a signed URL from it using the Supabase storage client, then fetch and convert to base64:

```text
if (userAvatarUrl.includes('supabase.co/storage'))  →  existing logic (signed URL from full URL)
else if (userAvatarUrl.startsWith('data:'))          →  existing logic (already base64)
else (NEW)                                           →  treat as relative path, create signed URL directly
```

The new branch will:
1. Use `supabase.storage.from('avatars').createSignedUrl(userAvatarUrl, 300)` directly with the relative path
2. Fetch the signed URL and convert to base64
3. Set `avatarFetchSuccess = true`

This is a small, targeted fix (adding ~15 lines) with no risk to other logic.

### Technical Details

- Only the edge function file is modified
- No frontend changes needed — the relative path format is correct for Supabase storage operations
- The existing signed-URL-from-full-URL path (line 677) will continue to work for any other callers
- Logging will confirm the path taken: `[generate-style] Avatar path is relative, creating signed URL directly`

