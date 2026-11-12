# 03 — Patela Design Language & UI Specification

**Document Version:** 1.0  
**Last Updated:** 2026-11-09  
**Source Files Inspected:** [`src/styles/patela.css`](../src/styles/patela.css), [`src/styles/patela-sections.css`](../src/styles/patela-sections.css), [`src/styles/patela-app.css`](../src/styles/patela-app.css), [`html/assets/css/design-system.css`](../html/assets/css/design-system.css), [`html/assets/css/dashboard.css`](../html/assets/css/dashboard.css), [`html/assets/css/components.css`](../html/assets/css/components.css), [`html/assets/css/responsive.css`](../html/assets/css/responsive.css).

---

## 1. Brand Identity & Visual Philosophy

Patela's visual identity is **Calm, Minimal, Spacious Fintech + Productivity Workspace**.
- **Core Inspiration:** The restraint and spatial clarity of Apple interfaces combined with the financial precision of Stripe dashboards.
- **Anti-Patterns to Avoid:** Never make Patela look like a cryptocurrency trading terminal, a neon Web3 casino, or a dense job board. Avoid competing gradients, overcrowded multi-widget cards, or uninvited decorative clutter.
- **Logo Mark:** Four ascending geometric parallelograms (`viewBox="0 0 23 17"`) paired with the uppercase `PATELA` wordmark set in `Sora` with wide tracking (`letter-spacing: 0.2em`–`0.22em`).

---

## 2. Colour Palette & Surface Tokens

### 2.1 Core Surfaces (Unified Deep Navy & iOS Vibrancy Glass)
| Token | Hex / Value | Usage |
|---|---|---|
| `--bg-main` / `.pt-page` | `#02060f` | Unified primary application canvas background across landing page, Next.js routes, and `html/` dashboard |
| `--bg-sidebar` | `rgba(6, 12, 24, 0.78)` (`backdrop-filter: blur(28px) saturate(160%)`) | Fixed left navigation sidebar & mobile bottom bar with iOS frosted glass vibrancy |
| `--surface-primary` | `rgba(11, 19, 34, 0.72)` (`backdrop-filter: blur(22px) saturate(145%)`) | Standard cards, tables, metric tiles, inputs |
| `--surface-elevated` | `rgba(17, 27, 46, 0.84)` | Elevated sub-cards, active tabs, dropdowns, tooltips |
| `--surface-hover` | `rgba(25, 38, 62, 0.88)` | Interactive row/button hover state |
| `--surface-subtle` | `rgba(255, 255, 255, 0.028)` | Subtle table headers and inset containers |
| `.patela-bgv` + `.patela-frost` | Ambient CloudFront MP4 + deep navy radial/linear frost veil (`blur(24px) saturate(135%)`) | Shared atmospheric background layer across `/`, `/marketplace`, `/post-job`, `/jobs/[jobId]`, and all 12 `/html/*.html` dashboard screens |

### 2.2 Typography Hierarchy Colours
| Token | Hex | Usage |
|---|---|---|
| `--text-primary` | `#F7F7F8` / `#FFFFFF` | Primary headings, body copy, financial figures |
| `--text-secondary` | `#9CA6B8` / `#A2A9B8` | Supporting descriptions, table labels, secondary metadata |
| `--text-muted` | `#647084` | Timestamps, tertiary IDs, disabled states |
| `--text-inverse` | `#050912` | Text inside solid champagne-gold primary buttons |

### 2.3 Brand & Semantic Accents
| Token | Hex / Value | Usage |
|---|---|---|
| `--gold` | `#D9BD8B` | Primary brand accent, active indicators, primary CTAs, locked escrow bars |
| `--gold-light` | `#F2D9A9` / `#FFE2B2` | Highlighted text, active navigation links, hover borders |
| `--gold-subtle` | `rgba(217, 189, 139, 0.09)` | Active nav pill fill, gold badge background |
| `--blue` | `#8CC7F5` / `#96C4F4` | Secondary accent, in-progress milestones, AI verification states |
| `--success` | `#55C995` / `#6EE7A8` | Released payments, verified checks, connected wallet dot |
| `--warning` | `#E8B96F` / `#FFD79A` | Revision requested, awaiting review, action needed |
| `--error` | `#E47E83` / `#FFB4B4` | Disputes, failed checks, form validation errors |

### 2.4 Borders & Shadows
- `--border-neutral`: `rgba(255, 255, 255, 0.07)`
- `--border-subtle`: `rgba(255, 255, 255, 0.045)`
- `--border-gold`: `rgba(217, 189, 139, 0.22)`
- `--border-gold-strong`: `rgba(242, 217, 169, 0.38)`
- `--shadow-sm`: `0 2px 10px rgba(0, 0, 0, 0.22)`
- `--shadow-md`: `0 10px 30px rgba(0, 0, 0, 0.38)`
- `--shadow-lg`: `0 24px 60px rgba(0, 0, 0, 0.58)`
- `--shadow-gold`: `0 4px 20px rgba(217, 189, 139, 0.12)`

---

## 3. Typography & Hierarchy

| Role | Font Family | Size & Weight | Rules |
|---|---|---|---|
| **Display / Headings (`--font-display`)** | `Sora`, sans-serif | Page Title: `clamp(1.5rem, 2vw, 1.85rem)` (`500`); Section Title: `0.9375rem` (`600`) | Tight tracking (`-0.025em` on titles); never all-caps except small eyebrows (`0.75rem`, `letter-spacing: 0.14em`). |
| **UI & Body (`--font-sans`)** | `Inter`, system-ui, sans-serif | Base: `0.875rem` (`14px`, line-height `1.6`); Subtitle: `0.8125rem` (`13px`); Meta: `0.75rem` (`12px`) | Clean 3-tier contrast (`--text-primary`, `--text-secondary`, `--text-muted`). |
| **Financial & Technical (`--font-mono`)** | `JetBrains Mono`, monospace | `0.75rem`–`0.8125rem` (`400`/`500`) | All financial figures use `font-variant-numeric: tabular-nums` (`.tabular`) and explicit currency units (`USDC`, `pUSD`). Wallet addresses and tx hashes use `.mono`. |

---

## 4. Layout, Spacing & Navigation Architecture

- **Dimensions:**
  - `--sidebar-width`: `236px` (Expanded desktop sidebar)
  - `--sidebar-collapsed-width`: `72px` (Collapsed desktop icon-rail mode, toggled via topbar button, sidebar button, or `Ctrl+B` / `Cmd+B`)
  - `--topbar-height`: `64px` (Sticky blurred header with breadcrumbs, role switcher, notifications popover, and account menu)
  - `--content-max-width`: `1320px` (`--content-pad-x: 40px`, `--content-pad-y: 36px`)
- **Border Radii:**
  - `--radius-xs`: `6px` | `--radius-sm`: `8px` | `--radius-md`: `12px` | `--radius-lg`: `16px` | `--radius-pill`: `999px`
- **Responsive Breakpoints:**
  - `> 1280px`: Full desktop multi-column layouts (`4-column` metric grids, `1.5fr 1fr` split workspaces).
  - `<= 1280px` (Laptop): Split workspaces stack cleanly; `3-col` grids become `2-col`.
  - `<= 992px` (Tablet): Fixed sidebar converts into an off-canvas slide-over drawer (`276px` wide) with backdrop scrim and `✕` close button.
  - `<= 768px` (Mobile/Large Phone): Fixed **Mobile Bottom Navigation Bar** (`62px` height, 5 core role tabs) activates; data tables transform into stacked card rows; filter tabs scroll horizontally; full-screen detail views stack into single-column layouts.
  - `<= 480px` (Small Phone `390px`/`360px`): Single-column metric cards, full-width primary action buttons.

---

## 5. Core Reusable UI Components

1. **Buttons (`.btn`, `.pt-btn`)**:
   - `.btn-primary`: Solid champagne gold (`linear-gradient(180deg, #F2D9A9 0%, #D9BD8B 100%)`) with `#050912` inverse text. One primary CTA per view/card.
   - `.btn-secondary`: Surface elevated (`#141D2B`) with subtle neutral border.
   - `.btn-ghost`: Transparent background for secondary row actions (`View →`, `Details →`).
   - `.btn-danger`: Subtle red fill/border for dispute or destructive confirmations.
2. **Selectable Cards & Full-Screen Detail Workspaces (`.selectable-card`, `.fullscreen-detail-overlay`)**:
   - Clicking any selectable card (job, project, milestone, submission, transaction, or KPI metric card) expands into a **`100vw × 100vh` full-screen detail workspace** (`PatelaDetail`) with a sticky `← Back to [Page]` bar, breadcrumb trail, and item-specific sections.
3. **Charts & Financial Visualisations (`analytics.js`)**:
   - Smooth SVG line/area charts and bar charts with `7d`, `30d`, `3m`, `6m`, `12m`, `all` time filters.
   - Interactive SVG donut chart with clickable category drilldowns.
   - Non-overlapping horizontal stacked custody bars (`Released`, `Locked in Escrow`, `Awaiting Review`, `Refunded`).
   - Interactive 7-stage Escrow Lifecycle & 3-node Custody Flow diagrams.
4. **States, Feedback & iOS-Like Fluid Motion**:
   - **Empty States (`.empty-state`)**: Calm centered container with concise title, explanation, and optional reset/CTA button.
   - **Toasts (`.toast-stack`)**: Bottom-right non-blocking notifications (`PatelaUI.toast`).
   - **iOS Spring Physics & Choreography**:
     - Primary damped spring curve: `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)`.
     - Interactive press/rebound curve: `--ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.12)`.
     - Full-screen sheet/modal curve: `--ease-ios-sheet: cubic-bezier(0.32, 0.72, 0, 1)`.
     - Tactile press compression (`:active`): Buttons compress to `scale(0.96)`–`scale(0.97)` and selectable cards compress to `scale(0.985)` before rebounding smoothly.
     - Staggered blur-to-crisp entrance (`patelaFadeUp`, `patelaCardIn`) and smooth page transition choreography (`body.ios-page-leaving`) across dashboard navigation.
     - Respects `@media (prefers-reduced-motion: reduce)`.

