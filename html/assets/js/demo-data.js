/* ==========================================================================
   PATELA — CENTRALISED DEMO DATA & STATE STORE (demo-data.js)
   Persisted in localStorage ('patela_proto_state_v2') for cross-page consistency
   ========================================================================== */

(function () {
  const STORAGE_KEY = 'patela_proto_state_v3';

  const DEFAULT_STATE = {
    role: 'client', // 'client' | 'worker'
    walletConnected: true,
    network: 'Base Mainnet (Demo)',
    profiles: {
      client: {
        name: 'Alex Morgan',
        handle: '@alex_morgan',
        title: 'Product & Engineering Lead · FinTech Studio',
        email: 'alex.morgan@patela-demo.io',
        initials: 'AM',
        wallet: '0x71C4…9A2E',
        walletFull: '0x71C4b8209F31d8E44019cA2B5580e91124009A2E',
        preferredAsset: 'USDC',
        preferredNetwork: 'Base Mainnet',
        availableBalances: {
          USDC: 6450,
          USDT: 1200
        },
        notificationPrefs: {
          escrowEvents: true,
          aiReports: true,
          milestoneApprovals: true,
          deadlineReminders: true
        },
        metrics: {
          activeProjects: 4,
          totalInEscrow: 2450,
          awaitingReview: 2,
          totalPaid: 8320,
          totalDeposited: 10970,
          lockedActiveWork: 2050,
          awaitingApprovalAmount: 400,
          refundedTotal: 200,
          platformFeesPaid: 124.80
        }
      },
      worker: {
        name: 'Jordan Blake',
        handle: '@jordan_blake',
        title: 'Senior Product Designer & Frontend Engineer',
        email: 'jordan.blake@patela-demo.io',
        initials: 'JB',
        wallet: '0x94B8…3E1F',
        walletFull: '0x94B8e1204C78a9D11038fB4C2291a80053103E1F',
        preferredAsset: 'USDC',
        preferredNetwork: 'Base Mainnet',
        availableBalances: {
          USDC: 3180,
          USDT: 450
        },
        notificationPrefs: {
          escrowEvents: true,
          aiReports: true,
          milestoneApprovals: true,
          deadlineReminders: true
        },
        metrics: {
          activeProjects: 3,
          fundsSecured: 1850,
          pendingPayouts: 620,
          totalEarned: 5420,
          earnedThisMonth: 1200,
          availableToWithdraw: 3180,
          totalFeesPaid: 81.30,
          completedProjects: 9,
          milestonesApproved: 26,
          milestonesRevision: 1,
          avgAiScore: 96.4,
          onTimeRate: 96.2
        }
      }
    },

    projects: [
      {
        id: 'PRJ-201',
        title: 'E-commerce Website Redesign',
        category: 'UI/UX & Frontend',
        clientName: 'Alex Morgan',
        clientHandle: '@alex_morgan',
        workerName: 'Jordan Blake',
        workerHandle: '@jordan_blake',
        roles: ['client', 'worker'],
        budget: 1200,
        funded: 1200,
        released: 250,
        escrowBalance: 950,
        asset: 'USDC',
        network: 'Base Mainnet',
        status: 'Awaiting client approval',
        statusTone: 'gold',
        currentMilestone: 'M2: UI Design ($400)',
        deadline: '14 Nov 2026',
        lastActivity: '18 mins ago',
        txRef: '0x8a41e92c…3f10b8',
        summary: 'Complete end-to-end redesign of the luxury storefront checkout, product discovery grid, and responsive design system tokens.',
        milestones: [
          {
            id: 'M1',
            name: 'Milestone 1: Wireframes',
            description: 'Low- and mid-fidelity user flows covering home, collection filtering, product detail, and 2-step checkout.',
            amount: 250,
            dueDate: '28 Oct 2026',
            deliverables: ['Figma wireframe deck (14 screens)', 'Interactive checkout flow prototype'],
            status: 'Released',
            statusTone: 'success',
            submissions: [
              {
                version: 'v1.0',
                date: '27 Oct 2026, 16:20 UTC',
                author: 'Jordan Blake',
                files: ['ecommerce-wireframes-v1.fig (4.8 MB)', 'user-flow-architecture.pdf (1.2 MB)'],
                links: ['https://figma.com/file/demo-patela-wireframes'],
                note: 'Completed all 14 core wireframe views plus mobile breakpoint flows. Verified navigation hierarchy.',
                aiResult: 'Passed all 4 deliverable checks'
              }
            ]
          },
          {
            id: 'M2',
            name: 'Milestone 2: UI Design',
            description: 'High-fidelity desktop and mobile UI screens with dark/light design tokens, component library, andWCAG AA contrast verification.',
            amount: 400,
            dueDate: '10 Nov 2026',
            deliverables: [
              'High-fidelity desktop & mobile screens (24 frames)',
              'Exported design token JSON & style guide',
              'Interactive Figma prototype link'
            ],
            status: 'Awaiting client approval',
            statusTone: 'gold',
            submissions: [
              {
                version: 'v1.2',
                date: 'Today, 09:42 UTC',
                author: 'Jordan Blake',
                files: ['patela-storefront-ui-v1.2.fig (18.4 MB)', 'design-tokens-v1.2.json (42 KB)'],
                links: ['https://figma.com/proto/patela-ecommerce-ui-v1-2'],
                note: 'Delivered all 24 high-fidelity desktop and mobile frames, reusable component tokens, and interactive checkout states.',
                aiResult: 'Verified · 4 of 4 checks passed'
              }
            ]
          },
          {
            id: 'M3',
            name: 'Milestone 3: Frontend Implementation',
            description: 'Production-ready responsive HTML/CSS/React storefront views matching the approved Figma system.',
            amount: 400,
            dueDate: '18 Nov 2026',
            deliverables: ['Responsive component codebase', 'Lighthouse performance & accessibility report (>= 95)'],
            status: 'Funded',
            statusTone: 'blue',
            submissions: []
          },
          {
            id: 'M4',
            name: 'Milestone 4: Final Handover',
            description: 'Documentation, storybook deployment, and final QA sign-off.',
            amount: 150,
            dueDate: '24 Nov 2026',
            deliverables: ['Component documentation guide', 'Final build bundle & release notes'],
            status: 'Funded',
            statusTone: 'neutral',
            submissions: []
          }
        ],
        aiReport: {
          milestoneId: 'M2',
          status: 'Completed · Ready for Client Decision',
          overallResult: 'All agreed deliverables verified against Milestone 2 specification',
          checkedCount: 4,
          passed: [
            '24 high-fidelity desktop & mobile artboards present in Figma bundle',
            'Design token JSON validates cleanly against W3C design-tokens schema',
            'Typography and colour contrast ratios meet WCAG 2.2 AA thresholds (min 4.8:1)',
            'Interactive prototype link resolves and includes cart + checkout states'
          ],
          failed: [],
          explanation: 'The submitted UI package fulfills all structural and visual requirements defined in Milestone 2. All 24 responsive frames and token exports were verified deterministically. Final aesthetic approval rests with the client.',
          suggestedChanges: 'Optional: confirm whether the secondary mobile sticky cart bar should remain visible on the order confirmation screen before starting Milestone 3.'
        },
        timeline: [
          { title: 'AI review completed for Milestone 2', time: 'Today, 09:44 UTC', type: 'ai' },
          { title: 'Jordan Blake submitted Milestone 2: UI Design (v1.2)', time: 'Today, 09:42 UTC', type: 'submit' },
          { title: 'Milestone 1 payment ($250 USDC) released to Jordan Blake', time: '28 Oct 2026', type: 'payout' },
          { title: 'Escrow contract funded ($1,200 USDC on Base)', time: '20 Oct 2026', type: 'escrow' },
          { title: 'Project agreement signed by Alex Morgan & Jordan Blake', time: '20 Oct 2026', type: 'agree' }
        ]
      },
      {
        id: 'PRJ-202',
        title: 'Smart Contract Integration',
        category: 'Web3 & Solidity',
        clientName: 'Alex Morgan',
        clientHandle: '@alex_morgan',
        workerName: 'Sam Carter',
        workerHandle: '@sam_carter',
        roles: ['client'],
        budget: 1400,
        funded: 1000,
        released: 500,
        escrowBalance: 500,
        asset: 'USDC',
        network: 'Base Mainnet',
        status: 'In progress',
        statusTone: 'blue',
        currentMilestone: 'M2: Settlement Hooks ($500)',
        deadline: '16 Nov 2026',
        lastActivity: '2 hours ago',
        txRef: '0x3c90b14e…9a21d4',
        summary: 'Integrate multi-milestone ERC-20 escrow contract bindings, event listeners, and pre-transaction simulation hooks.',
        milestones: [
          {
            id: 'M1',
            name: 'Milestone 1: Escrow Vault Interface',
            description: 'TypeScript ABI bindings and read/write contract hooks.',
            amount: 500,
            dueDate: '30 Oct 2026',
            deliverables: ['Typed SDK package', 'Unit test suite (100% pass)'],
            status: 'Released',
            statusTone: 'success',
            submissions: []
          },
          {
            id: 'M2',
            name: 'Milestone 2: Multi-Token Settlement Hooks',
            description: 'Support USDC and USDT permit signatures with deterministic gas estimation.',
            amount: 500,
            dueDate: '12 Nov 2026',
            deliverables: ['EIP-2612 Permit integration', 'Foundry integration tests'],
            status: 'In progress',
            statusTone: 'blue',
            submissions: []
          },
          {
            id: 'M3',
            name: 'Milestone 3: Mainnet Deployment & Audit Handover',
            description: 'Deployment scripts and security runbook.',
            amount: 400,
            dueDate: '16 Nov 2026',
            deliverables: ['Verified contract deployment scripts', 'Operational security checklist'],
            status: 'Not funded',
            statusTone: 'warning',
            submissions: []
          }
        ],
        aiReport: {
          milestoneId: 'M1',
          status: 'Approved & Released',
          overallResult: 'All unit and fuzz tests passed in sandbox verification',
          checkedCount: 3,
          passed: [
            'Foundry test suite passed 42/42 assertions',
            'Zero high/medium static analysis findings in Slither scan',
            'TypeScript ABI types match compiled Solidity artifacts'
          ],
          failed: [],
          explanation: 'Milestone 1 passed all automated verification checks and was approved by the client.',
          suggestedChanges: 'Fund Milestone 3 ($400 USDC) prior to final deployment.'
        },
        timeline: [
          { title: 'Milestone 3 funding reminder triggered ($400 USDC)', time: '2 hours ago', type: 'escrow' },
          { title: 'Milestone 1 payment ($500 USDC) released to Sam Carter', time: '31 Oct 2026', type: 'payout' },
          { title: 'Initial escrow funded ($1,000 USDC)', time: '22 Oct 2026', type: 'escrow' }
        ]
      },
      {
        id: 'PRJ-203',
        title: 'Mobile Banking UI',
        category: 'Product Design',
        clientName: 'Alex Morgan',
        clientHandle: '@alex_morgan',
        workerName: 'Jordan Blake',
        workerHandle: '@jordan_blake',
        roles: ['client', 'worker'],
        budget: 1100,
        funded: 1100,
        released: 500,
        escrowBalance: 600,
        asset: 'USDC',
        network: 'Arbitrum One',
        status: 'Revision requested',
        statusTone: 'warning',
        currentMilestone: 'M2: Biometric Transfer Flow ($600)',
        deadline: '12 Nov 2026',
        lastActivity: '5 hours ago',
        txRef: '0x5f12c08a…7e44c1',
        summary: 'iOS and Android mobile banking interface covering instant stablecoin transfers, biometric confirmation modals, and card freeze controls.',
        milestones: [
          {
            id: 'M1',
            name: 'Milestone 1: Core Account & Card Flows',
            description: 'Home balance view, virtual card controls, and transaction feed.',
            amount: 500,
            dueDate: '29 Oct 2026',
            deliverables: ['iOS & Android Figma screens (16 views)'],
            status: 'Released',
            statusTone: 'success',
            submissions: []
          },
          {
            id: 'M2',
            name: 'Milestone 2: Biometric Transfer & Dark Theme',
            description: 'Passkey biometric confirmation states, error recovery screens, and exported SVG icon set.',
            amount: 600,
            dueDate: '12 Nov 2026',
            deliverables: ['Biometric confirmation modal specs', 'Exported custom SVG icon pack (32 icons)'],
            status: 'Revision requested',
            statusTone: 'warning',
            submissions: [
              {
                version: 'v1.0',
                date: 'Yesterday, 17:15 UTC',
                author: 'Jordan Blake',
                files: ['mobile-banking-m2-v1.fig (11.2 MB)'],
                links: ['https://figma.com/file/mobile-banking-m2'],
                note: 'Initial submission of biometric transfer flows and dark theme tokens.',
                aiResult: '3 of 4 checks passed · Missing SVG icon archive'
              }
            ]
          }
        ],
        aiReport: {
          milestoneId: 'M2',
          status: 'Revision Requested',
          overallResult: '3 of 4 deliverables verified; standalone SVG icon archive missing',
          checkedCount: 4,
          passed: [
            'Biometric FaceID / Passkey confirmation screens included',
            'Insufficient-balance and network-timeout recovery states present',
            'Dark theme colour tokens match specification'
          ],
          failed: [
            'Standalone exported SVG icon archive (32 icons) was not attached to the submission zip'
          ],
          explanation: 'While all Figma screens are complete and properly structured, the deliverable checklist requires a standalone folder of 32 optimized SVG icons for engineering handoff.',
          suggestedChanges: 'Attach the exported SVG icon archive (icons-v1.zip) and resubmit Milestone 2 for instant re-verification.'
        },
        timeline: [
          { title: 'Revision decision requested on Milestone 2 (missing SVG export zip)', time: '5 hours ago', type: 'revision' },
          { title: 'AI review flagged missing SVG icon archive on M2 v1.0', time: 'Yesterday', type: 'ai' },
          { title: 'Milestone 1 ($500 USDC) released to Jordan Blake', time: '29 Oct 2026', type: 'payout' }
        ]
      },
      {
        id: 'PRJ-204',
        title: 'React Dashboard Development',
        category: 'Frontend Engineering',
        clientName: 'Alex Morgan',
        clientHandle: '@alex_morgan',
        workerName: 'Chris Wilson',
        workerHandle: '@chris_wilson',
        roles: ['client'],
        budget: 900,
        funded: 900,
        released: 500,
        escrowBalance: 400,
        asset: 'USDC',
        network: 'Base Mainnet',
        status: 'Under AI review',
        statusTone: 'blue',
        currentMilestone: 'M2: Escrow State Feed ($400)',
        deadline: '15 Nov 2026',
        lastActivity: '42 mins ago',
        txRef: '0x9d77a20f…11c3e8',
        summary: 'Modular React analytics tables, keyboard navigation, and accessible filter components.',
        milestones: [
          {
            id: 'M1',
            name: 'Milestone 1: Component Architecture & Tables',
            description: 'Sortable data tables and filter primitives.',
            amount: 500,
            dueDate: '01 Nov 2026',
            deliverables: ['Table component package', 'Vitest unit tests'],
            status: 'Released',
            statusTone: 'success',
            submissions: []
          },
          {
            id: 'M2',
            name: 'Milestone 2: Real-time Escrow State Feed',
            description: 'Live status badges, transaction receipt modal, and responsive mobile cards.',
            amount: 400,
            dueDate: '15 Nov 2026',
            deliverables: ['Escrow feed module', 'Playwright responsive tests'],
            status: 'Under AI review',
            statusTone: 'blue',
            submissions: [
              {
                version: 'v1.0',
                date: '42 mins ago',
                author: 'Chris Wilson',
                files: ['react-dashboard-m2.tar.gz (3.1 MB)'],
                links: ['https://github.com/patela-demo/react-dashboard/pull/18'],
                note: 'Submitted Milestone 2 PR with Playwright viewport assertions.',
                aiResult: 'AI verification in progress (4/4 checks queued)'
              }
            ]
          }
        ],
        aiReport: {
          milestoneId: 'M2',
          status: 'Under AI Review',
          overallResult: 'Automated test suite passed · Finalizing accessibility check',
          checkedCount: 4,
          passed: [
            'TypeScript strict build succeeded with 0 errors',
            'Vitest unit test suite passed (28/28 tests)',
            'Responsive layout verified at 1440px, 768px, and 390px'
          ],
          failed: [],
          explanation: 'Automated build and test verification passed. Report ready for client inspection.',
          suggestedChanges: 'No blockers detected.'
        },
        timeline: [
          { title: 'Chris Wilson submitted Milestone 2 for AI verification', time: '42 mins ago', type: 'submit' },
          { title: 'Milestone 1 ($500 USDC) released to Chris Wilson', time: '02 Nov 2026', type: 'payout' }
        ]
      },
      {
        id: 'PRJ-198',
        title: 'Brand Identity Design',
        category: 'Brand & Visual Systems',
        clientName: 'Alex Morgan',
        clientHandle: '@alex_morgan',
        workerName: 'Sam Carter',
        workerHandle: '@sam_carter',
        roles: ['client'],
        budget: 1620,
        funded: 1620,
        released: 1620,
        escrowBalance: 0,
        asset: 'USDC',
        network: 'Base Mainnet',
        status: 'Completed',
        statusTone: 'success',
        currentMilestone: 'All 3 milestones completed',
        deadline: '18 Oct 2026',
        lastActivity: '18 Oct 2026',
        txRef: '0x1e44f89b…6d02a9',
        summary: 'Complete brand identity guidelines, geometric logomark vectors, typography system, and social templates.',
        milestones: [
          {
            id: 'M1',
            name: 'Milestone 1: Logomark & Monogram Vectors',
            description: 'Primary and monochrome SVG/EPS master files.',
            amount: 520,
            dueDate: '05 Oct 2026',
            deliverables: ['Master vector package'],
            status: 'Released',
            statusTone: 'success',
            submissions: []
          },
          {
            id: 'M2',
            name: 'Milestone 2: Colour & Typography Book',
            description: 'Champagne-gold and deep navy brand system guidelines.',
            amount: 600,
            dueDate: '12 Oct 2026',
            deliverables: ['Brand book PDF (44 pages)'],
            status: 'Released',
            statusTone: 'success',
            submissions: []
          },
          {
            id: 'M3',
            name: 'Milestone 3: Pitch & Social Asset Kit',
            description: 'Figma templates for announcements and product launches.',
            amount: 500,
            dueDate: '18 Oct 2026',
            deliverables: ['Figma template library'],
            status: 'Released',
            statusTone: 'success',
            submissions: []
          }
        ],
        aiReport: {
          milestoneId: 'M3',
          status: 'Completed & Settled',
          overallResult: 'All 3 milestones verified and released on-chain',
          checkedCount: 3,
          passed: ['Vector master files verified', 'Brand guidelines PDF print-ready check passed', 'Social templates verified'],
          failed: [],
          explanation: 'All contract deliverables were verified and settled.',
          suggestedChanges: 'Project complete.'
        },
        timeline: [
          { title: 'Final milestone ($500 USDC) released — Project completed', time: '18 Oct 2026', type: 'payout' }
        ]
      },
      {
        id: 'PRJ-205',
        title: 'DeFi Treasury Analytics Portal',
        category: 'UI/UX & Frontend',
        clientName: 'Taylor Reed',
        clientHandle: '@taylor_reed',
        workerName: 'Jordan Blake',
        workerHandle: '@jordan_blake',
        roles: ['worker'],
        budget: 1220,
        funded: 1220,
        released: 300,
        escrowBalance: 300, // M2 ($620) is Approved Pending Payout; M3 ($300) is in escrow
        pendingPayout: 620,
        asset: 'USDC',
        network: 'Base Mainnet',
        status: 'In progress',
        statusTone: 'blue',
        currentMilestone: 'M3: Export & Audit Views ($300)',
        deadline: '19 Nov 2026',
        lastActivity: '1 hour ago',
        txRef: '0x6b29d41c…8f03e2',
        summary: 'Multi-chain treasury balance analytics, stablecoin yield breakdown, and CSV/PDF accounting export views.',
        milestones: [
          {
            id: 'M1',
            name: 'Milestone 1: Information Architecture',
            description: 'Wireframes and data schema mapping for multi-sig treasuries.',
            amount: 300,
            dueDate: '25 Oct 2026',
            deliverables: ['IA specification & wireframes'],
            status: 'Released',
            statusTone: 'success',
            submissions: []
          },
          {
            id: 'M2',
            name: 'Milestone 2: Token Flow & Yield Views',
            description: 'High-fidelity dashboard views and interactive chart specs.',
            amount: 620,
            dueDate: '06 Nov 2026',
            deliverables: ['Figma UI kit & interactive prototype'],
            status: 'Approved',
            statusTone: 'gold',
            submissions: [
              {
                version: 'v1.0',
                date: '06 Nov 2026',
                author: 'Jordan Blake',
                files: ['treasury-portal-m2.fig (14.1 MB)'],
                links: ['https://figma.com/file/treasury-portal-m2'],
                note: 'All treasury allocation views and table states completed.',
                aiResult: 'Verified · Client approved ($620 USDC payout queued)'
              }
            ]
          },
          {
            id: 'M3',
            name: 'Milestone 3: Export & Audit Views',
            description: 'Tax/audit report builder UI and final design handoff.',
            amount: 300,
            dueDate: '19 Nov 2026',
            deliverables: ['Audit export screens', 'Developer handoff spec'],
            status: 'In progress',
            statusTone: 'blue',
            submissions: []
          }
        ],
        aiReport: {
          milestoneId: 'M2',
          status: 'Client Approved · Payout Queued ($620 USDC)',
          overallResult: 'All Milestone 2 requirements passed verification',
          checkedCount: 3,
          passed: ['All 12 analytics screens verified', 'Tabular numeral alignment confirmed', 'Component tokens exported'],
          failed: [],
          explanation: 'Milestone 2 was approved by Taylor Reed. $620 USDC is queued for settlement release.',
          suggestedChanges: 'Proceed with Milestone 3 ($300 USDC secured in escrow).'
        },
        timeline: [
          { title: 'Taylor Reed approved Milestone 2 ($620 USDC pending payout)', time: '1 hour ago', type: 'payout' },
          { title: 'Milestone 1 ($300 USDC) released to Jordan Blake', time: '26 Oct 2026', type: 'payout' }
        ]
      }
    ],

    marketplaceJobs: [
      {
        id: 'JOB-401',
        title: 'Web3 Wallet Onboarding & Passkey Recovery Flow',
        category: 'Product Design',
        budget: 1600,
        asset: 'USDC',
        network: 'Base Mainnet',
        duration: '2 weeks',
        experience: 'Senior',
        clientName: 'Taylor Reed',
        clientHandle: '@taylor_reed',
        clientVerified: true,
        clientTotalPaid: '$14,800 USDC',
        escrowStatus: 'Escrow pre-funded ($1,600 USDC)',
        proposals: 4,
        postedAt: '3 hours ago',
        deadline: '26 Nov 2026',
        skills: ['Figma', 'Design Systems', 'Web3 UX', 'Mobile UI'],
        description: 'Design a frictionless non-custodial wallet onboarding flow using device Passkeys, social recovery guardians, and clear transaction simulation previews.',
        deliverables: [
          'End-to-end onboarding & recovery user flow map',
          '18 high-fidelity desktop & mobile screens in Figma',
          'Interactive prototype ready for usability testing'
        ],
        milestones: [
          { name: 'M1: Flow Architecture & Wireframes', amount: 450 },
          { name: 'M2: High-Fidelity UI & Dark Theme Tokens', amount: 750 },
          { name: 'M3: Interactive Prototype & Handoff Spec', amount: 400 }
        ],
        applied: false
      },
      {
        id: 'JOB-402',
        title: 'Next.js Institutional Staking Dashboard Frontend',
        category: 'Frontend Engineering',
        budget: 2400,
        asset: 'USDC',
        network: 'Arbitrum One',
        duration: '3 weeks',
        experience: 'Senior',
        clientName: 'Alex Morgan',
        clientHandle: '@alex_morgan',
        clientVerified: true,
        clientTotalPaid: '$8,320 USDC',
        escrowStatus: 'Escrow ready ($2,400 USDC)',
        proposals: 6,
        postedAt: '6 hours ago',
        deadline: '02 Dec 2026',
        skills: ['React', 'TypeScript', 'Next.js', 'Tailwind / CSS'],
        description: 'Build a responsive institutional staking and validator telemetry interface with real-time reward tables, withdrawal queue tracking, and WCAG AA accessibility.',
        deliverables: [
          'Typed Next.js App Router views for validator overview & withdrawal queue',
          'Reusable data table with CSV export and multi-column sorting',
          'Playwright end-to-end test suite covering desktop & mobile viewports'
        ],
        milestones: [
          { name: 'M1: Core Layout & Validator Telemetry Table', amount: 900 },
          { name: 'M2: Staking / Unstaking Modals & Wallet Hooks', amount: 900 },
          { name: 'M3: E2E Tests, Accessibility Audit & Handover', amount: 600 }
        ],
        applied: false
      },
      {
        id: 'JOB-403',
        title: 'Solidity Milestone Escrow V3 Gas Optimization & Audit Prep',
        category: 'Web3 & Solidity',
        budget: 3200,
        asset: 'USDT',
        network: 'Ethereum Mainnet',
        duration: '3 weeks',
        experience: 'Expert',
        clientName: 'Meridian Protocol',
        clientHandle: '@meridian_core',
        clientVerified: true,
        clientTotalPaid: '$31,500 USDT',
        escrowStatus: 'Escrow pre-funded ($3,200 USDT)',
        proposals: 3,
        postedAt: '1 day ago',
        deadline: '05 Dec 2026',
        skills: ['Solidity', 'Foundry', 'ERC-20', 'Security Audit'],
        description: 'Optimize storage packing on our multi-milestone escrow contract, implement EIP-2612 permit deposits, and write comprehensive Foundry invariant tests.',
        deliverables: [
          'Refactored Solidity contracts reducing deployment & settlement gas by >= 18%',
          'Foundry fuzz & invariant test suite (>= 98% line coverage)',
          'Pre-audit threat model & NatSpec documentation'
        ],
        milestones: [
          { name: 'M1: Storage Refactor & Permit Integration', amount: 1200 },
          { name: 'M2: Invariant Test Suite & Slither Clean Report', amount: 1200 },
          { name: 'M3: Audit Handover & Mainnet Deployment Scripts', amount: 800 }
        ],
        applied: false
      },
      {
        id: 'JOB-404',
        title: 'Fintech Design System Token Architecture & Documentation',
        category: 'UI/UX & Frontend',
        budget: 950,
        asset: 'USDC',
        network: 'Base Mainnet',
        duration: '10 days',
        experience: 'Intermediate',
        clientName: 'Taylor Reed',
        clientHandle: '@taylor_reed',
        clientVerified: true,
        clientTotalPaid: '$14,800 USDC',
        escrowStatus: 'Escrow pre-funded ($950 USDC)',
        proposals: 5,
        postedAt: '1 day ago',
        deadline: '22 Nov 2026',
        skills: ['Design Systems', 'CSS Variables', 'Figma', 'Documentation'],
        description: 'Unify our Figma colour, typography, and elevation tokens with our production CSS custom properties and write usage guidelines.',
        deliverables: [
          'Synced Figma variable collection & W3C JSON export',
          'CSS token stylesheet (`design-system.css`)',
          'Component states documentation page'
        ],
        milestones: [
          { name: 'M1: Token Audit & JSON Schema', amount: 450 },
          { name: 'M2: CSS Implementation & Documentation', amount: 500 }
        ],
        applied: false
      },
      {
        id: 'JOB-405',
        title: 'Subgraph & Webhook Indexer for On-Chain Escrow Events',
        category: 'Backend & Data',
        budget: 1850,
        asset: 'USDC',
        network: 'Base Mainnet',
        duration: '2 weeks',
        experience: 'Senior',
        clientName: 'Veridian Labs',
        clientHandle: '@veridian_labs',
        clientVerified: true,
        clientTotalPaid: '$19,200 USDC',
        escrowStatus: 'Escrow pre-funded ($1,850 USDC)',
        proposals: 2,
        postedAt: '2 days ago',
        deadline: '29 Nov 2026',
        skills: ['TypeScript', 'GraphQL', 'PostgreSQL', 'EVM Indexing'],
        description: 'Build a deterministic event indexer tracking escrow deposits, AI verification attestations, and milestone payouts with sub-3-second latency.',
        deliverables: [
          'Subgraph schema & mapping handlers',
          'Idempotent webhook dispatcher with retry backoff',
          'Docker Compose test harness & benchmark report'
        ],
        milestones: [
          { name: 'M1: Schema & Event Mappings', amount: 850 },
          { name: 'M2: Webhook Worker & Latency Benchmark', amount: 1000 }
        ],
        applied: false
      }
    ],

    transactions: [
      {
        id: 'TX-9040',
        type: 'Payout Queued',
        roleScope: ['worker'],
        projectId: 'PRJ-205',
        project: 'DeFi Treasury Analytics Portal (M2: Token Flow)',
        counterpartyClient: 'Taylor Reed',
        counterpartyWorker: 'Jordan Blake',
        amount: 620,
        fee: 9.30,
        asset: 'USDC',
        network: 'Base Mainnet',
        date: '2026-11-08',
        timeUtc: '08 Nov 2026, 10:15 UTC',
        displayDate: 'Today, 10:15',
        status: 'Pending',
        statusTone: 'gold',
        txHash: '0x6b29d41c8901e4a2b3c9012f44e81239a08f03e2',
        blockNumber: 'Pending settlement batch'
      },
      {
        id: 'TX-9039',
        type: 'Milestone Release',
        roleScope: ['worker'],
        projectId: 'PRJ-205',
        project: 'Design System Audit & Tokens (Final Milestone)',
        counterpartyClient: 'Veridian Labs',
        counterpartyWorker: 'Jordan Blake',
        amount: 1200,
        fee: 18.00,
        asset: 'USDC',
        network: 'Base Mainnet',
        date: '2026-11-05',
        timeUtc: '05 Nov 2026, 14:22 UTC',
        displayDate: '05 Nov 2026',
        status: 'Completed',
        statusTone: 'success',
        txHash: '0x71e4a90b12c38f01d490a22e81b44c9012e30a19',
        blockNumber: '18,482,110'
      },
      {
        id: 'TX-9029',
        type: 'Milestone Release',
        roleScope: ['client'],
        projectId: 'PRJ-204',
        project: 'React Dashboard Development (M1: Tables)',
        counterpartyClient: 'Alex Morgan',
        counterpartyWorker: 'Chris Wilson',
        amount: 500,
        fee: 7.50,
        asset: 'USDC',
        network: 'Base Mainnet',
        date: '2026-11-02',
        timeUtc: '02 Nov 2026, 18:04 UTC',
        displayDate: '02 Nov 2026',
        status: 'Completed',
        statusTone: 'success',
        txHash: '0x9d77a20f44b812e901c23a89f0012d45a111c3e8',
        blockNumber: '18,471,008'
      },
      {
        id: 'TX-9035',
        type: 'Milestone Release',
        roleScope: ['client'],
        projectId: 'PRJ-202',
        project: 'Smart Contract Integration (M1: Vault Interface)',
        counterpartyClient: 'Alex Morgan',
        counterpartyWorker: 'Sam Carter',
        amount: 500,
        fee: 7.50,
        asset: 'USDC',
        network: 'Base Mainnet',
        date: '2026-10-31',
        timeUtc: '31 Oct 2026, 15:40 UTC',
        displayDate: '31 Oct 2026',
        status: 'Completed',
        statusTone: 'success',
        txHash: '0x3c90b14e82a109f4c1209e88a34b11c0909a21d4',
        blockNumber: '18,450,332'
      },
      {
        id: 'TX-9032',
        type: 'Milestone Release',
        roleScope: ['client', 'worker'],
        projectId: 'PRJ-203',
        project: 'Mobile Banking UI (M1: Core Account Flows)',
        counterpartyClient: 'Alex Morgan',
        counterpartyWorker: 'Jordan Blake',
        amount: 500,
        fee: 7.50,
        asset: 'USDC',
        network: 'Arbitrum One',
        date: '2026-10-29',
        timeUtc: '29 Oct 2026, 11:30 UTC',
        displayDate: '29 Oct 2026',
        status: 'Completed',
        statusTone: 'success',
        txHash: '0x5f12c08a99e012d4b7712c90a11f40e8237e44c1',
        blockNumber: '264,918,004'
      },
      {
        id: 'TX-9041',
        type: 'Milestone Release',
        roleScope: ['client', 'worker'],
        projectId: 'PRJ-201',
        project: 'E-commerce Website Redesign (M1: Wireframes)',
        counterpartyClient: 'Alex Morgan',
        counterpartyWorker: 'Jordan Blake',
        amount: 250,
        fee: 3.75,
        asset: 'USDC',
        network: 'Base Mainnet',
        date: '2026-10-28',
        timeUtc: '28 Oct 2026, 16:45 UTC',
        displayDate: '28 Oct 2026',
        status: 'Completed',
        statusTone: 'success',
        txHash: '0x8a41e92c71d04f81a20e9b3c44d12a77903f10b8',
        blockNumber: '18,412,904'
      },
      {
        id: 'TX-9030',
        type: 'Milestone Release',
        roleScope: ['worker'],
        projectId: 'PRJ-205',
        project: 'DeFi Treasury Analytics Portal (M1: IA Spec)',
        counterpartyClient: 'Taylor Reed',
        counterpartyWorker: 'Jordan Blake',
        amount: 200,
        fee: 3.00,
        asset: 'USDC',
        network: 'Base Mainnet',
        date: '2026-10-26',
        timeUtc: '26 Oct 2026, 13:10 UTC',
        displayDate: '26 Oct 2026',
        status: 'Completed',
        statusTone: 'success',
        txHash: '0x2c81f40e91a304b7d1208e44c910a33f8812d04e',
        blockNumber: '18,390,115'
      },
      {
        id: 'TX-9038',
        type: 'Escrow Deposit',
        roleScope: ['client', 'worker'],
        projectId: 'PRJ-201',
        project: 'E-commerce Website Redesign (Full Escrow Lock)',
        counterpartyClient: 'Alex Morgan',
        counterpartyWorker: 'Jordan Blake',
        amount: 1200,
        fee: 0,
        asset: 'USDC',
        network: 'Base Mainnet',
        date: '2026-10-20',
        timeUtc: '20 Oct 2026, 09:12 UTC',
        displayDate: '20 Oct 2026',
        status: 'Completed',
        statusTone: 'blue',
        txHash: '0x4d18b09a23f190c8e12a4409b71c33e89012a4f1',
        blockNumber: '18,204,119'
      },
      {
        id: 'TX-9021',
        type: 'Milestone Release',
        roleScope: ['client'],
        projectId: 'PRJ-198',
        project: 'Brand Identity Design (Final Settlement)',
        counterpartyClient: 'Alex Morgan',
        counterpartyWorker: 'Sam Carter',
        amount: 1620,
        fee: 24.30,
        asset: 'USDC',
        network: 'Base Mainnet',
        date: '2026-10-18',
        timeUtc: '18 Oct 2026, 17:50 UTC',
        displayDate: '18 Oct 2026',
        status: 'Completed',
        statusTone: 'success',
        txHash: '0x1e44f89b02c491a77e12d309a88c41b2906d02a9',
        blockNumber: '18,180,512'
      },
      {
        id: 'TX-9015',
        type: 'Refund Processed',
        roleScope: ['client'],
        projectId: 'PRJ-198',
        project: 'Marketing Scope Adjustment (Unused Escrow Refund)',
        counterpartyClient: 'Alex Morgan',
        counterpartyWorker: 'Patela Escrow Vault',
        amount: 200,
        fee: 0,
        asset: 'USDC',
        network: 'Base Mainnet',
        date: '2026-09-24',
        timeUtc: '24 Sep 2026, 12:05 UTC',
        displayDate: '24 Sep 2026',
        status: 'Refunded',
        statusTone: 'neutral',
        txHash: '0x6a09c12e44f819b301d22a78c401e99b1204f3a8',
        blockNumber: '17,904,221'
      },
      {
        id: 'TX-9012',
        type: 'Milestone Release',
        roleScope: ['worker'],
        projectId: 'PRJ-201',
        project: 'Protocol Governance UI (Milestone 2 Payout)',
        counterpartyClient: 'Meridian Protocol',
        counterpartyWorker: 'Jordan Blake',
        amount: 720,
        fee: 10.80,
        asset: 'USDT',
        network: 'Ethereum Mainnet',
        date: '2026-09-14',
        timeUtc: '14 Sep 2026, 19:20 UTC',
        displayDate: '14 Sep 2026',
        status: 'Completed',
        statusTone: 'success',
        txHash: '0x90b1d44e77a203c912f48e01a33b812c4091e88a',
        blockNumber: '20,741,892'
      },
      {
        id: 'TX-9008',
        type: 'Payout Retry',
        roleScope: ['worker'],
        projectId: 'PRJ-203',
        project: 'L2 Bridge Widget (Initial RPC Timeout — Re-settled)',
        counterpartyClient: 'Veridian Labs',
        counterpartyWorker: 'Jordan Blake',
        amount: 150,
        fee: 0,
        asset: 'USDT',
        network: 'Arbitrum One',
        date: '2026-08-19',
        timeUtc: '19 Aug 2026, 08:44 UTC',
        displayDate: '19 Aug 2026',
        status: 'Failed',
        statusTone: 'error',
        txHash: '0x11c9e04f82a104d7b3309e12a40f812c9001b4e2',
        blockNumber: 'Reverted (Gas spike — re-settled in TX-9009)'
      }
    ],

    analytics: {
      client: {
        spendingSeries: {
          '7d': {
            total: '500.00 USDC',
            monthlyAvg: '2,150.00 USDC',
            comparison: '+11.1% vs prior 7 days',
            points: [
              { label: '02 Nov', amount: 500, payments: 1, prevDiff: '+25% vs prior week', note: 'PRJ-204 M1 released ($500 USDC)' },
              { label: '03 Nov', amount: 0, payments: 0, prevDiff: 'No releases', note: 'Active milestone work in progress' },
              { label: '04 Nov', amount: 0, payments: 0, prevDiff: 'No releases', note: 'Active milestone work in progress' },
              { label: '05 Nov', amount: 0, payments: 0, prevDiff: 'No releases', note: 'AI checks running on submissions' },
              { label: '06 Nov', amount: 0, payments: 0, prevDiff: 'No releases', note: 'Milestone 2 work ongoing' },
              { label: '07 Nov', amount: 0, payments: 0, prevDiff: 'No releases', note: 'PRJ-203 M2 submitted for review' },
              { label: '08 Nov', amount: 0, payments: 0, prevDiff: '$400 awaiting approval', note: 'PRJ-201 M2 ($400 USDC) ready to approve' }
            ]
          },
          '30d': {
            total: '3,370.00 USDC',
            monthlyAvg: '2,150.00 USDC',
            comparison: '+18.2% vs previous 30d',
            points: [
              { label: 'Wk 1 (Oct 12)', amount: 1620, payments: 3, prevDiff: '+14% vs prior wk', note: 'Brand Identity Design (PRJ-198) settled' },
              { label: 'Wk 2 (Oct 19)', amount: 0, payments: 0, prevDiff: 'Escrow funded ($2,200)', note: 'PRJ-201 & PRJ-202 escrows funded' },
              { label: 'Wk 3 (Oct 26)', amount: 1250, payments: 3, prevDiff: '+22% vs prior wk', note: 'PRJ-201 M1 ($250), PRJ-203 M1 ($500), PRJ-202 M1 ($500)' },
              { label: 'Wk 4 (Nov 02)', amount: 500, payments: 1, prevDiff: '$400 queued for review', note: 'PRJ-204 M1 ($500 USDC) released' }
            ]
          },
          '3m': {
            total: '5,220.00 USDC',
            monthlyAvg: '1,740.00 USDC',
            comparison: '+24.0% vs prior 3m',
            points: [
              { label: 'Sep 2026', amount: 1850, payments: 3, prevDiff: '+15.6% vs Aug', note: 'Marketing & Web3 SDK milestones' },
              { label: 'Oct 2026', amount: 2870, payments: 6, prevDiff: '+55.1% vs Sep', note: 'PRJ-198, PRJ-201 M1, PRJ-202 M1, PRJ-203 M1' },
              { label: 'Nov 2026 (MTD)', amount: 500, payments: 1, prevDiff: '+$400 awaiting approval', note: 'PRJ-204 M1 released; 2 milestones in review' }
            ]
          },
          '6m': {
            total: '8,320.00 USDC',
            monthlyAvg: '1,386.67 USDC',
            comparison: '+31.4% vs prior 6m',
            points: [
              { label: 'Jun 2026', amount: 650, payments: 2, prevDiff: 'Baseline month', note: 'Technical specification & copywriting' },
              { label: 'Jul 2026', amount: 850, payments: 2, prevDiff: '+30.8% vs Jun', note: 'Frontend prototype milestones' },
              { label: 'Aug 2026', amount: 1600, payments: 3, prevDiff: '+88.2% vs Jul', note: 'Core smart contract audit & UI' },
              { label: 'Sep 2026', amount: 1850, payments: 3, prevDiff: '+15.6% vs Aug', note: 'Design system & marketing assets' },
              { label: 'Oct 2026', amount: 2870, payments: 6, prevDiff: '+55.1% vs Sep', note: '4 active projects + PRJ-198 completion' },
              { label: 'Nov 2026', amount: 500, payments: 1, prevDiff: '$2,450 in active escrow', note: 'PRJ-204 M1 released ($500 USDC)' }
            ]
          },
          '12m': {
            total: '8,320.00 USDC',
            monthlyAvg: '1,386.67 USDC',
            comparison: '+38.0% YoY',
            points: [
              { label: 'Q1 2026', amount: 0, payments: 0, prevDiff: 'Workspace onboarded Q2', note: 'Account created May 2026' },
              { label: 'Q2 2026', amount: 650, payments: 2, prevDiff: 'Initial engagements', note: 'Documentation & wireframes' },
              { label: 'Q3 2026', amount: 4300, payments: 8, prevDiff: '+561% vs Q2', note: 'Full product design & Solidity integration' },
              { label: 'Q4 2026 (QTD)', amount: 3370, payments: 7, prevDiff: '+24% pace vs Q3', note: '$3,370 released + $2,450 locked in escrow' }
            ]
          },
          'all': {
            total: '8,320.00 USDC',
            monthlyAvg: '1,386.67 USDC',
            comparison: '100% escrow-protected',
            points: [
              { label: 'Jun 2026', amount: 650, payments: 2, prevDiff: 'Initial launch', note: '2 milestones settled' },
              { label: 'Jul 2026', amount: 850, payments: 2, prevDiff: '+30.8% vs Jun', note: '2 milestones settled' },
              { label: 'Aug 2026', amount: 1600, payments: 3, prevDiff: '+88.2% vs Jul', note: '3 milestones settled' },
              { label: 'Sep 2026', amount: 1850, payments: 3, prevDiff: '+15.6% vs Aug', note: '3 milestones settled' },
              { label: 'Oct 2026', amount: 2870, payments: 6, prevDiff: '+55.1% vs Sep', note: '6 milestones settled' },
              { label: 'Nov 2026', amount: 500, payments: 1, prevDiff: '$2,450 in escrow', note: '1 milestone settled · 4 active projects' }
            ]
          }
        },
        categories: [
          {
            id: 'design',
            name: 'Design',
            amount: 3920,
            percent: 36.4,
            color: '#D9BD8B',
            projects: ['E-commerce Website Redesign ($1,200 USDC)', 'Mobile Banking UI ($1,100 USDC)', 'Brand Identity Design ($1,620 USDC)']
          },
          {
            id: 'web-dev',
            name: 'Web development',
            amount: 3500,
            percent: 32.5,
            color: '#8CC7F5',
            projects: ['React Dashboard Development ($900 USDC)', 'Storefront Performance & SSR ($2,600 USDC — Completed)']
          },
          {
            id: 'web3',
            name: 'Smart contracts & Web3',
            amount: 1900,
            percent: 17.6,
            color: '#55C995',
            projects: ['Smart Contract Integration ($1,000 USDC funded)', 'ERC-20 Escrow Audit Prep ($900 USDC — Completed)']
          },
          {
            id: 'marketing',
            name: 'Marketing',
            amount: 800,
            percent: 7.4,
            color: '#E8B96F',
            projects: ['Product Launch Asset Kit & Copy ($800 USDC — Completed)']
          },
          {
            id: 'writing',
            name: 'Writing & other services',
            amount: 650,
            percent: 6.1,
            color: '#647084',
            projects: ['Developer SDK Documentation & Guides ($650 USDC — Completed)']
          }
        ]
      },
      worker: {
        earningsSeries: {
          '7d': {
            total: '1,200.00 USDC',
            comparison: '+26.3% vs prior 7d',
            daily: [
              { label: '02 Nov', amount: 0, txCount: 0, note: 'Working on PRJ-201 M2 UI frames' },
              { label: '03 Nov', amount: 0, txCount: 0, note: 'Working on PRJ-205 M2 Token Flow' },
              { label: '04 Nov', amount: 0, txCount: 0, note: 'Submitted Design System Audit final handoff' },
              { label: '05 Nov', amount: 1200, txCount: 1, note: 'TX-9039: Design System Audit ($1,200.00 USDC released)' },
              { label: '06 Nov', amount: 0, txCount: 1, note: 'PRJ-205 M2 approved ($620.00 USDC queued for payout)' },
              { label: '07 Nov', amount: 0, txCount: 0, note: 'Uploaded PRJ-203 M2 v1.0' },
              { label: '08 Nov', amount: 0, txCount: 0, note: 'PRJ-201 M2 ($400.00 USDC) verified by AI' }
            ],
            weekly: [
              { label: 'Oct 19 – Oct 25', amount: 0, txCount: 0, note: 'Milestone execution week' },
              { label: 'Oct 26 – Nov 01', amount: 950, txCount: 3, note: 'PRJ-205 M1 ($200), PRJ-201 M1 ($250), PRJ-203 M1 ($500)' },
              { label: 'Nov 02 – Nov 08', amount: 1200, txCount: 1, note: 'TX-9039 ($1,200 USDC) + $620 USDC pending payout' }
            ],
            monthly: [
              { label: 'Aug 2026', amount: 450, txCount: 2, note: '2 milestones settled ($450.00 USDC)' },
              { label: 'Sep 2026', amount: 720, txCount: 2, note: '2 milestones settled ($720.00 USDT/USDC)' },
              { label: 'Oct 2026', amount: 950, txCount: 3, note: '3 milestones settled ($950.00 USDC)' },
              { label: 'Nov 2026', amount: 1200, txCount: 1, note: '$1,200.00 USDC settled + $620.00 USDC queued' }
            ]
          },
          '30d': {
            total: '2,150.00 USDC',
            comparison: '+31.8% vs prior 30d',
            daily: [
              { label: '20 Oct', amount: 0, txCount: 0, note: 'PRJ-201 Escrow funded ($1,200 USDC)' },
              { label: '26 Oct', amount: 200, txCount: 1, note: 'TX-9030: DeFi Treasury Portal M1 ($200.00 USDC)' },
              { label: '28 Oct', amount: 250, txCount: 1, note: 'TX-9041: E-commerce Redesign M1 ($250.00 USDC)' },
              { label: '29 Oct', amount: 500, txCount: 1, note: 'TX-9032: Mobile Banking UI M1 ($500.00 USDC)' },
              { label: '02 Nov', amount: 0, txCount: 0, note: 'M2 design sprint' },
              { label: '05 Nov', amount: 1200, txCount: 1, note: 'TX-9039: Design System Audit ($1,200.00 USDC)' },
              { label: '08 Nov', amount: 0, txCount: 1, note: 'TX-9040: $620.00 USDC approved & queued' }
            ],
            weekly: [
              { label: 'Wk 1 (Oct 12)', amount: 0, txCount: 0, note: 'Discovery & wireframing' },
              { label: 'Wk 2 (Oct 19)', amount: 0, txCount: 0, note: 'Escrow locks confirmed' },
              { label: 'Wk 3 (Oct 26)', amount: 950, txCount: 3, note: '3 milestone releases ($950.00 USDC)' },
              { label: 'Wk 4 (Nov 02)', amount: 1200, txCount: 1, note: '$1,200.00 USDC settled + $620.00 queued' }
            ],
            monthly: [
              { label: 'Aug 2026', amount: 450, txCount: 2, note: 'August earnings ($450.00 USDC)' },
              { label: 'Sep 2026', amount: 720, txCount: 2, note: 'September earnings ($720.00 USDC)' },
              { label: 'Oct 2026', amount: 950, txCount: 3, note: 'October earnings ($950.00 USDC)' },
              { label: 'Nov 2026', amount: 1200, txCount: 1, note: 'November earnings ($1,200.00 USDC)' }
            ]
          },
          '3m': {
            total: '2,870.00 USDC',
            comparison: '+26.3% MoM in Nov',
            daily: [
              { label: '14 Sep', amount: 720, txCount: 1, note: 'TX-9012: Protocol Governance UI ($720.00)' },
              { label: '26 Oct', amount: 200, txCount: 1, note: 'TX-9030: DeFi Treasury M1 ($200.00 USDC)' },
              { label: '28 Oct', amount: 250, txCount: 1, note: 'TX-9041: E-commerce Redesign M1 ($250.00 USDC)' },
              { label: '29 Oct', amount: 500, txCount: 1, note: 'TX-9032: Mobile Banking UI M1 ($500.00 USDC)' },
              { label: '05 Nov', amount: 1200, txCount: 1, note: 'TX-9039: Design System Audit ($1,200.00 USDC)' }
            ],
            weekly: [
              { label: 'Sep Wk 2', amount: 720, txCount: 2, note: 'Governance UI settlement ($720.00)' },
              { label: 'Oct Wk 2', amount: 0, txCount: 0, note: 'New project onboarding' },
              { label: 'Oct Wk 4', amount: 950, txCount: 3, note: '3 milestone payouts ($950.00 USDC)' },
              { label: 'Nov Wk 1', amount: 1200, txCount: 1, note: 'Design System settlement ($1,200.00 USDC)' }
            ],
            monthly: [
              { label: 'Sep 2026', amount: 720, txCount: 2, note: '+60.0% vs August ($450)' },
              { label: 'Oct 2026', amount: 950, txCount: 3, note: '+31.9% vs September ($720)' },
              { label: 'Nov 2026', amount: 1200, txCount: 1, note: '+26.3% vs October ($950)' }
            ]
          },
          '6m': {
            total: '5,420.00 USDC',
            comparison: '+34.5% avg monthly growth',
            daily: [
              { label: 'Jun', amount: 980, txCount: 2, note: 'Jun settlements ($980.00 USDC)' },
              { label: 'Jul', amount: 1120, txCount: 3, note: 'Jul settlements ($1,120.00 USDC)' },
              { label: 'Aug', amount: 450, txCount: 2, note: 'Aug settlements ($450.00 USDC)' },
              { label: 'Sep', amount: 720, txCount: 2, note: 'Sep settlements ($720.00 USDC)' },
              { label: 'Oct', amount: 950, txCount: 3, note: 'Oct settlements ($950.00 USDC)' },
              { label: 'Nov', amount: 1200, txCount: 1, note: 'Nov settlements ($1,200.00 USDC)' }
            ],
            weekly: [
              { label: 'Jun–Jul', amount: 2100, txCount: 5, note: 'Early summer engagements ($2,100.00 USDC)' },
              { label: 'Aug', amount: 450, txCount: 2, note: 'August payouts ($450.00 USDC)' },
              { label: 'Sep', amount: 720, txCount: 2, note: 'September payouts ($720.00 USDC)' },
              { label: 'Oct', amount: 950, txCount: 3, note: 'October payouts ($950.00 USDC)' },
              { label: 'Nov', amount: 1200, txCount: 1, note: 'November payouts ($1,200.00 USDC)' }
            ],
            monthly: [
              { label: 'Jun 2026', amount: 980, txCount: 2, note: '2 milestones settled ($980.00 USDC)' },
              { label: 'Jul 2026', amount: 1120, txCount: 3, note: '+14.3% vs Jun ($1,120.00 USDC)' },
              { label: 'Aug 2026', amount: 450, txCount: 2, note: '2 milestones settled ($450.00 USDC)' },
              { label: 'Sep 2026', amount: 720, txCount: 2, note: '+60.0% vs Aug ($720.00 USDC)' },
              { label: 'Oct 2026', amount: 950, txCount: 3, note: '+31.9% vs Sep ($950.00 USDC)' },
              { label: 'Nov 2026', amount: 1200, txCount: 1, note: '+26.3% vs Oct ($1,200.00 USDC)' }
            ]
          },
          '12m': {
            total: '5,420.00 USDC',
            comparison: '+42.0% Q4 vs Q3 pace',
            daily: [
              { label: 'Jun 2026', amount: 980, txCount: 2, note: '$980.00 USDC earned' },
              { label: 'Jul 2026', amount: 1120, txCount: 3, note: '$1,120.00 USDC earned' },
              { label: 'Aug 2026', amount: 450, txCount: 2, note: '$450.00 USDC earned' },
              { label: 'Sep 2026', amount: 720, txCount: 2, note: '$720.00 USDC earned' },
              { label: 'Oct 2026', amount: 950, txCount: 3, note: '$950.00 USDC earned' },
              { label: 'Nov 2026', amount: 1200, txCount: 1, note: '$1,200.00 USDC earned' }
            ],
            weekly: [
              { label: 'Q2 2026', amount: 980, txCount: 2, note: 'Q2 total ($980.00 USDC)' },
              { label: 'Q3 2026', amount: 2290, txCount: 7, note: 'Q3 total ($2,290.00 USDC)' },
              { label: 'Q4 2026 (QTD)', amount: 2150, txCount: 4, note: 'Q4 to date ($2,150.00 USDC + $620.00 pending)' }
            ],
            monthly: [
              { label: 'Jun 2026', amount: 980, txCount: 2, note: '$980.00 USDC' },
              { label: 'Jul 2026', amount: 1120, txCount: 3, note: '$1,120.00 USDC' },
              { label: 'Aug 2026', amount: 450, txCount: 2, note: '$450.00 USDC' },
              { label: 'Sep 2026', amount: 720, txCount: 2, note: '$720.00 USDC' },
              { label: 'Oct 2026', amount: 950, txCount: 3, note: '$950.00 USDC' },
              { label: 'Nov 2026', amount: 1200, txCount: 1, note: '$1,200.00 USDC' }
            ]
          },
          'all': {
            total: '5,420.00 USDC',
            comparison: '26 milestones approved across 12 projects',
            daily: [
              { label: 'Jun 2026', amount: 980, txCount: 2, note: '$980.00 USDC' },
              { label: 'Jul 2026', amount: 1120, txCount: 3, note: '$1,120.00 USDC' },
              { label: 'Aug 2026', amount: 450, txCount: 2, note: '$450.00 USDC' },
              { label: 'Sep 2026', amount: 720, txCount: 2, note: '$720.00 USDC' },
              { label: 'Oct 2026', amount: 950, txCount: 3, note: '$950.00 USDC' },
              { label: 'Nov 2026', amount: 1200, txCount: 1, note: '$1,200.00 USDC' }
            ],
            weekly: [
              { label: 'Jun–Jul', amount: 2100, txCount: 5, note: '$2,100.00 USDC' },
              { label: 'Aug', amount: 450, txCount: 2, note: '$450.00 USDC' },
              { label: 'Sep', amount: 720, txCount: 2, note: '$720.00 USDC' },
              { label: 'Oct', amount: 950, txCount: 3, note: '$950.00 USDC' },
              { label: 'Nov', amount: 1200, txCount: 1, note: '$1,200.00 USDC' }
            ],
            monthly: [
              { label: 'Jun 2026', amount: 980, txCount: 2, note: '$980.00 USDC' },
              { label: 'Jul 2026', amount: 1120, txCount: 3, note: '$1,120.00 USDC' },
              { label: 'Aug 2026', amount: 450, txCount: 2, note: '$450.00 USDC' },
              { label: 'Sep 2026', amount: 720, txCount: 2, note: '$720.00 USDC' },
              { label: 'Oct 2026', amount: 950, txCount: 3, note: '$950.00 USDC' },
              { label: 'Nov 2026', amount: 1200, txCount: 1, note: '$1,200.00 USDC' }
            ]
          }
        },
        monthlyTable: [
          { month: 'August 2026', earnings: 450, asset: 'USDC', milestones: 2, change: '—' },
          { month: 'September 2026', earnings: 720, asset: 'USDC', milestones: 2, change: '+60.0%' },
          { month: 'October 2026', earnings: 950, asset: 'USDC', milestones: 3, change: '+31.9%' },
          { month: 'November 2026', earnings: 1200, asset: 'USDC', milestones: 2, change: '+26.3%' }
        ]
      }
    },

    notifications: [
      {
        id: 'N-1',
        role: 'client',
        title: 'AI review passed for E-commerce Redesign (M2)',
        desc: 'Jordan Blake submitted Milestone 2 ($400 USDC). 4/4 deliverables verified.',
        time: '18m ago',
        unread: true,
        href: 'project-detail.html?id=PRJ-201'
      },
      {
        id: 'N-2',
        role: 'client',
        title: 'Milestone 3 funding required',
        desc: 'Smart Contract Integration (M3: $400 USDC) awaits escrow funding.',
        time: '2h ago',
        unread: true,
        href: 'project-detail.html?id=PRJ-202'
      },
      {
        id: 'N-3',
        role: 'client',
        title: 'New submission under AI review',
        desc: 'Chris Wilson uploaded M2 for React Dashboard Development.',
        time: '42m ago',
        unread: false,
        href: 'project-detail.html?id=PRJ-204'
      },
      {
        id: 'N-4',
        role: 'worker',
        title: 'Milestone 2 approved ($620 USDC queued)',
        desc: 'Taylor Reed approved M2 on DeFi Treasury Analytics Portal.',
        time: '1h ago',
        unread: true,
        href: 'project-detail.html?id=PRJ-205'
      },
      {
        id: 'N-5',
        role: 'worker',
        title: 'Revision requested on Mobile Banking UI (M2)',
        desc: 'Please attach the standalone 32-icon SVG zip package.',
        time: '5h ago',
        unread: true,
        href: 'project-detail.html?id=PRJ-203'
      },
      {
        id: 'N-6',
        role: 'worker',
        title: 'AI verification completed on E-commerce UI (M2)',
        desc: 'Your v1.2 submission passed 4/4 automated checks.',
        time: '18m ago',
        unread: false,
        href: 'project-detail.html?id=PRJ-201'
      }
    ],

    messages: [
      {
        id: 'MSG-1',
        projectId: 'PRJ-201',
        projectTitle: 'E-commerce Website Redesign',
        counterpartyClient: 'Alex Morgan',
        counterpartyWorker: 'Jordan Blake',
        unread: true,
        updatedAt: '09:45 UTC',
        entries: [
          { sender: 'Alex Morgan', role: 'client', time: 'Yesterday, 14:10', text: 'Hi Jordan, looking forward to seeing the high-fidelity mobile checkout screens for Milestone 2.' },
          { sender: 'Jordan Blake', role: 'worker', time: 'Today, 09:42', text: 'Just submitted Milestone 2 (v1.2) with all 24 frames and the W3C token JSON file. Patela AI verification passed 4/4 checks!' },
          { sender: 'Alex Morgan', role: 'client', time: 'Today, 09:45', text: 'Awesome — reviewing the Figma prototype and AI verification report now.' }
        ]
      },
      {
        id: 'MSG-2',
        projectId: 'PRJ-203',
        projectTitle: 'Mobile Banking UI',
        counterpartyClient: 'Alex Morgan',
        counterpartyWorker: 'Jordan Blake',
        unread: false,
        updatedAt: 'Yesterday',
        entries: [
          { sender: 'Alex Morgan', role: 'client', time: 'Yesterday, 18:20', text: 'The biometric passkey modals look super clean. Could you attach the standalone exported SVG icon archive so our iOS engineer can pull them directly?' },
          { sender: 'Jordan Blake', role: 'worker', time: 'Yesterday, 18:40', text: 'On it! Exporting the 32 SVGs into icons-v1.zip now and will upload v1.1 shortly.' }
        ]
      }
    ],

    postJobDraft: {
      step: 1,
      title: 'Cross-Chain Payment Checkout Widget UI & SDK',
      category: 'UI/UX & Frontend',
      description: 'Design and build an embeddable USDC/USDT payment checkout component with real-time escrow status indicators and instant receipt generation.',
      skills: 'Figma, TypeScript, React, Web3 UX',
      deadline: '2026-12-10',
      asset: 'USDC',
      network: 'Base Mainnet',
      budget: 1500,
      deliverables: [
        { title: 'Interactive Figma Component Kit', criteria: 'Includes desktop/mobile states, dark mode tokens, and error recovery modals.' },
        { title: 'Production React Checkout Widget', criteria: 'Zero runtime dependencies, WCAG 2.2 AA compliant, and passes unit tests.' },
        { title: 'Integration Documentation & Demo', criteria: 'Step-by-step README with live sandbox preview.' }
      ],
      milestones: [
        { name: 'Milestone 1: Figma UI & Token Spec', amount: 500, due: '2026-11-22' },
        { name: 'Milestone 2: React Widget Implementation', amount: 700, due: '2026-12-02' },
        { name: 'Milestone 3: QA, Docs & Final Handover', amount: 300, due: '2026-12-10' }
      ],
      submissionReq: 'Provide a Figma prototype link, GitHub PR or archive bundle, and automated test output.',
      reviewExpectation: 'AI verifier checks schema, build status, and deliverable completeness; client approves final UX within 48 hours.'
    }
  };

  function syncFromNextStore(st) {
    try {
      const rawNext = localStorage.getItem('patela-demo-v1');
      if (!rawNext) return st;
      const nextData = JSON.parse(rawNext);
      if (!nextData || !Array.isArray(nextData.jobs)) return st;

      const defaultSeedIds = ['landing-page-redesign', 'smart-contract-audit', 'explainer-video'];
      let updated = false;

      nextData.jobs.forEach(function (nj) {
        if (!nj || !nj.id) return;
        const isCustom = defaultSeedIds.indexOf(nj.id) === -1;
        const existsMp = st.marketplaceJobs.some(function (m) {
          return m.id.toLowerCase() === nj.id.toLowerCase() || m.title.toLowerCase() === nj.title.toLowerCase();
        });
        if (!existsMp && isCustom) {
          updated = true;
          st.marketplaceJobs.unshift({
            id: nj.id.toUpperCase(),
            title: nj.title,
            category: 'UI/UX & Frontend',
            budget: Number(nj.budget) || 1000,
            asset: (nj.coins && nj.coins[0]) || 'USDC',
            network: 'Base Sepolia',
            duration: '2 weeks',
            experience: 'Senior',
            clientName: 'Alex Morgan',
            clientHandle: '@alex_morgan',
            clientVerified: true,
            clientTotalPaid: '$8,320 USDC',
            escrowStatus: nj.funded
              ? 'Escrow pre-funded ($' + Number(nj.budget).toLocaleString() + ' ' + ((nj.coins && nj.coins[0]) || 'USDC') + ')'
              : 'Escrow ready ($' + Number(nj.budget).toLocaleString() + ' ' + ((nj.coins && nj.coins[0]) || 'USDC') + ')',
            proposals: 1,
            postedAt: 'Just now',
            deadline: '10 Dec 2026',
            skills: ['React', 'TypeScript', 'Smart Escrow'],
            description: nj.scope,
            deliverables: Array.isArray(nj.deliverables) ? nj.deliverables : [],
            milestones: Array.isArray(nj.milestones)
              ? nj.milestones.map(function (m, idx) {
                  return { name: 'M' + (idx + 1) + ': ' + m.title, amount: Number(m.amount) || 0 };
                })
              : [],
            applied: false
          });
        }
      });

      if (updated) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(st));
      }
    } catch (e) {
      // Ignore sync errors
    }
    return st;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const initial = syncFromNextStore(JSON.parse(JSON.stringify(DEFAULT_STATE)));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
        return initial;
      }
      const parsed = JSON.parse(raw);
      return syncFromNextStore(Object.assign({}, DEFAULT_STATE, parsed));
    } catch (err) {
      return JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
  }

  function saveState(nextState) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    } catch (err) {
      // Ignore storage quota issues in private browsing
    }
  }

  function resetState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_STATE));
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }

  window.PatelaStore = {
    getState: loadState,
    saveState: saveState,
    resetState: resetState,
    getRole: function () {
      const bodyRole = document.body ? document.body.getAttribute('data-force-role') : null;
      if (bodyRole === 'client' || bodyRole === 'worker') {
        const s = loadState();
        if (s.role !== bodyRole) {
          s.role = bodyRole;
          saveState(s);
        }
        return bodyRole;
      }
      return loadState().role || 'client';
    },
    setRole: function (role) {
      const s = loadState();
      s.role = role === 'worker' ? 'worker' : 'client';
      saveState(s);
      return s.role;
    },
    getProjectById: function (id) {
      const s = loadState();
      return s.projects.find(function (p) { return p.id === id; }) || s.projects[0];
    }
  };
})();

