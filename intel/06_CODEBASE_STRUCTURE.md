# 06 — Codebase Structure (Current vs. Target)

**Document Version:** 1.0  
**Last Updated:** 2026-11-09  

---

## 1. Actual Current Repository Structure (Audited `2026-11-09`)

```text
deliverable-trust-market (1)/
├── AGENTS.md                        # Root project rules (demo store & labeling mandate)
├── package.json                     # Next.js 15.2, React 19.2, Tailwind 4.2, Vitest 3.0
├── next.config.mjs                  # Next.js configuration
├── tsconfig.json                    # TypeScript configuration (@/* -> ./src/*)
├── vitest.config.ts                 # Vitest unit test configuration
├── eslint.config.js                 # ESLint 9 flat config
├── postcss.config.mjs               # PostCSS + Tailwind 4 config
├── components.json                  # shadcn/ui configuration metadata
├── roadmap.md                       # Early landing-page checklist
├── README.md                        # Basic Next.js getting-started guide
│
├── public/                          # Static public assets (favicon.ico, favicon.svg, icon.svg, robots.txt)
│
├── src/                             # CURRENT NEXT.JS 15 APPLICATION (Marketing + Demo Store)
│   ├── styles.css                   # Global Tailwind + CSS reset
│   ├── styles/
│   │   ├── patela.css               # Hero landing page styles, glassmorphic CTA, responsive nav
│   │   ├── patela-sections.css      # Marketing sections, cards, stats, FAQ accordions, footer
│   │   └── patela-app.css           # Demo marketplace, post-job form, job detail & Solutions dropdown
│   ├── app/
│   │   ├── layout.tsx               # Root layout (Sora font, metadata, Providers)
│   │   ├── page.tsx                 # Main landing page (HeroBar + PatelaSections + SiteFooter)
│   │   ├── error.tsx                # Error boundary page
│   │   ├── not-found.tsx            # 404 page
│   │   ├── marketplace/             # Demo job listing route (/marketplace)
│   │   │   ├── page.tsx
│   │   │   └── marketplace-view.tsx
│   │   ├── post-job/                # Demo job creation route (/post-job)
│   │   │   ├── page.tsx
│   │   │   └── post-job-view.tsx
│   │   ├── jobs/[jobId]/            # Demo job detail, funding & submission route (/jobs/[jobId])
│   │   │   ├── page.tsx
│   │   │   └── job-view.tsx
│   │   ├── html/[[...slug]]/        # Unified route handler serving html/* dashboard inside Next.js
│   │   │   └── route.ts
│   │   └── (informational routes)/  # /how-it-works, /for-clients, /for-workers, /security,
│   │                                # /faq, /about, /careers, /contact, /terms, /privacy
│   ├── components/
│   │   ├── HeroBar.tsx              # Top brand bar, navigation links, mobile burger menu
│   │   ├── SiteNav.tsx              # App navigation header + WalletButton (demo Sepolia)
│   │   ├── SolutionsMenu.tsx        # Hover/touch Solutions dropdown menu
│   │   ├── PatelaSections.tsx       # Landing page interactive demo vault & feature sections
│   │   ├── InfoPage.tsx             # Reusable layout for informational pages
│   │   ├── ContactForm.tsx          # Client-side contact form
│   │   ├── SiteFooter.tsx           # Site footer
│   │   ├── Reveal.tsx               # IntersectionObserver scroll-reveal wrapper
│   │   ├── providers.tsx            # React context/toast providers (Sonner)
│   │   └── ui/                      # 48 generated shadcn/ui primitives (currently unused by src/app)
│   ├── hooks/
│   │   └── use-mobile.tsx           # Mobile viewport detection hook
│   ├── lib/
│   │   ├── patela-store.ts          # Client-side localStorage demo store, validateJob, demoReview, connectWallet
│   │   ├── patela-data.ts           # Static marketing copy (steps, features, FAQs)
│   │   └── utils.ts                 # clsx + tailwind-merge helper (cn)
│   └── test/
│       ├── setup.ts                 # Vitest setup
│       └── patela-rules.test.ts     # 6 unit tests for validateJob and demoReview
│
├── html/                            # ISOLATED INTERACTIVE HTML DASHBOARD PROTOTYPE (12 Screens)
│   ├── index.html                   # Role entry selector (Client vs Worker)
│   ├── client-dashboard.html        # Client overview dashboard
│   ├── worker-dashboard.html        # Worker overview dashboard
│   ├── post-job.html                # 5-step job creation wizard
│   ├── marketplace.html             # Worker job discovery & filtering
│   ├── projects.html                # Role-aware projects table
│   ├── project-detail.html          # Project workspace & 7-stage lifecycle
│   ├── submissions.html             # Deliverable submissions & AI verification list
│   ├── analytics.html               # Client & Worker interactive SVG financial analytics
│   ├── payments.html                # Escrow custody, 7-stage flow diagram & transaction ledger
│   ├── messages.html                # Project thread messaging
│   ├── settings.html                # Profile, wallet & notification settings
│   └── assets/
│       ├── css/
│       │   ├── design-system.css    # Core color, typography, spacing & animation tokens
│       │   ├── dashboard.css        # Collapsible sidebar (236px/72px), topbar, mobile bottom nav, grids
│       │   ├── components.css       # Buttons, tables, charts, modals, full-screen detail workspaces
│       │   └── responsive.css       # Desktop, laptop, tablet & mobile breakpoints
│       └── js/
│           ├── demo-data.js         # Reconciled client/worker demo state (patela_proto_state_v3)
│           ├── interactions.js      # Full-screen detail workspace engine (PatelaDetail) & toasts
│           ├── navigation.js        # Role-aware sidebar, collapsible rail (Ctrl+B), mobile drawer/nav
│           ├── client.js            # Client overview & 5-step post-job wizard controller
│           ├── worker.js            # Worker overview & marketplace controller
│           ├── app.js               # Shared controllers (projects, project-detail, payments, submissions, messages)
│           └── analytics.js         # Interactive SVG line, bar & donut chart engine
│
└── intel/                           # CENTRAL TECHNICAL INTELLIGENCE & DOCUMENTATION SYSTEM
```

---

## 2. Target Monorepo Structure (Milestones `01`–`08`)

As backend, worker, database, and smart-contract modules are introduced across Milestones `01`–`08`, the repository will organize cleanly into the following boundaries:

```text
patela/
├── apps/
│   ├── web/                         # Next.js 15 Frontend (Marketing + Integrated Client/Worker Dashboards)
│   │   └── src/
│   │       ├── app/                 # App Router pages (public marketing + authenticated (dashboard) routes)
│   │       ├── components/          # Shared UI primitives, layout shell, full-screen detail workspaces
│   │       ├── features/            # Domain feature modules (auth, jobs, projects, escrow, ai-review, disputes)
│   │       ├── hooks/               # Custom React & wagmi hooks
│   │       ├── lib/                 # API client, wagmi/viem config, formatting utilities
│   │       ├── styles/              # Patela design system CSS
│   │       └── types/               # Frontend-specific view types
│   │
│   ├── api/                         # NestJS + Fastify Modular Monolith (/api/v1)
│   │   └── src/
│   │       ├── auth/                # Registration, login, session cookies, guards
│   │       ├── users/               # User & Profile management
│   │       ├── wallets/             # Nonce challenge & EIP-191/SIWE signature verification
│   │       ├── jobs/                # Job CRUD, publishing, search & filtering
│   │       ├── applications/        # Freelancer proposals & hiring workflow
│   │       ├── projects/            # Project agreements & workspace state
│   │       ├── milestones/          # Milestone state machine & transitions
│   │       ├── submissions/         # Private S3 pre-signed URLs & submission versions
│   │       ├── reviews/             # AI review retrieval & human escalation endpoints
│   │       ├── escrow/              # Escrow preparation, calldata helpers & reconciliation status
│   │       ├── transactions/        # Transaction tracking & ledger queries
│   │       ├── disputes/            # Dispute creation, evidence & arbitrator resolution
│   │       ├── messaging/           # Project thread messages
│   │       ├── notifications/       # User notifications & read states
│   │       ├── admin/               # Admin oversight, moderation & metrics
│   │       └── common/              # PrismaService, RedisService, RBAC decorators, error filters, idempotency
│   │
│   └── worker/                      # BullMQ Background Worker Service
│       └── src/
│           ├── ai-review/           # Evidence extraction, prompt runner, Zod output validator
│           ├── blockchain-indexer/  # Base Sepolia event poller, confirmation tracker, reorg handler
│           ├── notifications/       # Outbox processor & notification dispatcher
│           └── file-processing/     # Checksum & archive inspection worker
│
├── packages/
│   ├── contracts-client/            # Generated TypeScript ABIs, contract addresses (84532) & viem helpers
│   ├── shared-types/                # Domain enums, DTO interfaces, integer base-unit types
│   ├── validation/                  # Shared Zod schemas (job validation, submission validation, AI output schema)
│   └── config/                      # Shared ESLint, TypeScript, and environment validation configs
│
├── contracts/                       # Foundry Smart Contract Workspace
│   ├── foundry.toml
│   ├── src/
│   │   ├── PatelaEscrow.sol         # Core milestone escrow & dispute resolution contract
│   │   ├── PatelaTestUSD.sol        # Base Sepolia test ERC-20 token (pUSD, 6 decimals)
│   │   └── interfaces/
│   │       └── IPatelaEscrow.sol
│   ├── script/
│   │   └── DeployBaseSepolia.s.sol
│   └── test/
│       ├── unit/
│       ├── fuzz/
│       └── invariant/
│
├── database/
│   ├── prisma/
│   │   └── schema.prisma            # Authoritative PostgreSQL schema
│   ├── migrations/                  # Versioned SQL migrations
│   └── seeds/                       # Deterministic development & testnet seed scripts
│
├── infrastructure/
│   └── docker-compose.yml           # Local PostgreSQL 16, Redis 7, and MinIO (S3-compatible storage)
│
├── html/                            # Preserved standalone HTML/CSS/JS UI prototype
└── intel/                           # Central technical intelligence & development history
```

---

## 3. Module Placement & Dependency Rules

1. **What belongs in `apps/web`:** UI rendering, client form state, `wagmi` wallet signing prompts, and calls to `/api/v1`. **Never** place direct Prisma calls, AI provider API keys, or authoritative financial validation solely in `apps/web`.
2. **What belongs in `apps/api`:** Synchronous HTTP request handling, authentication/RBAC enforcement, database transactions, pre-signed S3 URL generation, and writing `OutboxEvent` records. **Never** run long-running LLM calls or block-polling loops inside HTTP request handlers.
3. **What belongs in `apps/worker`:** Asynchronous BullMQ consumers for AI evaluation, Base Sepolia log indexing, and outbox notification fan-out.
4. **What belongs in `packages/*`:** Pure TypeScript types, Zod schemas, and contract ABIs shared across `web`, `api`, and `worker`.
5. **What belongs in `html/`:** Only the isolated HTML/CSS/JS prototype files. Do not import `html/` scripts into Next.js production bundles.

