# Features Modified Ledger

> **Classification:** Development History Ledger  
> **Last Updated:** 2026-11-09  

---

## Purpose

This file records all modifications, refactors, workflow changes, and UI/UX updates made to existing Patela features.

---

## Chronological Feature Modifications

### [2026-11-09] — Unified Dashboard & Landing Page Navigation, State Bridge & iOS Fluid Motion (`FEAT-INF-01`, `FEAT-INF-03`, `FEAT-MKT-01`, `FEAT-MKT-02`, `FEAT-MKT-04`)
- **Summary:** Connected the 12-screen `html/` dashboard directly into the Next.js app (`src/app/html/[[...slug]]/route.ts` + `/dashboard` redirects), unified the visual atmosphere (shared CloudFront ambient background video, deep navy frost veil, champagne-gold/ice-blue borders, `Sora` typography), synchronized `localStorage` demo jobs bidirectionally between `src/lib/patela-store.ts` and `html/assets/js/demo-data.js`, and added iOS spring animations (`cubic-bezier(0.22, 1, 0.36, 1)`), tactile `:active` compression, and smooth page transition choreography.
- **Files Modified:** `next.config.mjs`, `src/app/html/[[...slug]]/route.ts`, `src/lib/patela-store.ts`, `src/components/HeroBar.tsx`, `src/components/SolutionsMenu.tsx`, `src/components/SiteNav.tsx`, `src/components/SiteFooter.tsx`, `src/components/PatelaSections.tsx`, `src/components/InfoPage.tsx`, `src/app/marketplace/marketplace-view.tsx`, `src/app/post-job/post-job-view.tsx`, `src/app/jobs/[jobId]/job-view.tsx`, `src/styles/patela-app.css`, `html/index.html`, `html/assets/css/design-system.css`, `html/assets/css/dashboard.css`, `html/assets/css/components.css`, `html/assets/js/navigation.js`, `html/assets/js/demo-data.js`.

