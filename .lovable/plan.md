

## Plan: Add English Language Toggle (i18n)

### Approach
Create a lightweight i18n system using React Context + translation dictionary. A language toggle button (KO/EN) will appear in the navigation bar on all pages except `/admin`.

### Architecture

```text
src/
├── contexts/LanguageContext.tsx    ← Context + provider + useLanguage hook
├── lib/translations/
│   ├── ko.ts                      ← Korean strings (current text extracted)
│   └── en.ts                      ← English translations
└── lib/translations/index.ts      ← Type definitions + t() helper
```

### Implementation Steps

1. **Create `LanguageContext`**
   - Store language preference (`ko` | `en`) in `localStorage`
   - Provide `t(key)` function and `toggleLanguage()` via context
   - Wrap app in `<LanguageProvider>` inside `App.tsx`

2. **Build translation dictionaries** (`ko.ts`, `en.ts`)
   - Extract all user-facing Korean text from: Landing, Auth, ProfileSetup, ProfileEdit, StyleGenerator, Cart, Community, UserGallery, MyPage, Pricing, Install, SharedLook, Privacy, Terms, NotFound, Pitch, Cafe24Fitting
   - Organize by page/component namespace (e.g., `nav.styleGallery`, `landing.heroTitle`, `pricing.freePlan`)
   - Admin page strings are excluded

3. **Add language toggle to `MainNavigation.tsx`**
   - Small `KO | EN` toggle button in the nav bar (desktop: next to other buttons; mobile: inside hamburger menu)
   - Uses `useLanguage()` hook to switch

4. **Replace hardcoded Korean strings across all pages**
   - Each page imports `useLanguage()` and calls `t('key')` instead of inline Korean text
   - Admin.tsx and admin components remain untouched
   - Components like `CommunityFilters`, `GalleryLookCard`, `LookDetailModal`, `ShareButtons`, `ProfileSelector`, etc. also get translated

### Scope
- **~18 page files** + **~15 component files** will be updated
- **~300-400 translation keys** estimated
- Admin page and all `src/components/admin/*` components are excluded

### UI Design
- Toggle: Compact pill button showing "KO" or "EN", placed in navbar
- Desktop: Between nav links and action buttons
- Mobile: At the top of the hamburger menu sheet

