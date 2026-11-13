# Patela stack evaluation

Date: 12 November 2026. This is a research and smoke-test result, not a deployed system.

## Recommendation

Use **Node.js/TypeScript** for Patela's application code and contract integration. Start with **Next.js**, **Supabase Auth + PostgreSQL**, and **Hardhat 3 + viem**. Keep contract reads/event projection in a separate worker once orders are on chain. This gives the frontend, backend, and contract tests one ABI and TypeScript type path. FastAPI is a good API framework, but for this project it would add a Python service and a separate web3.py integration beside the JavaScript contract toolchain.

The first usable vertical slice should be: Google or email-OTP sign-in → profile creation → buyer dashboard reading the signed-in user's orders from PostgreSQL → wallet link by signed challenge → testnet order funding → confirmed chain event projected back to the dashboard. A dashboard projection must never be treated as the authority for payment or verification.

## Repositories inspected

| Repository | Fit and decision |
| --- | --- |
| [Vercel's Next.js + Supabase example](https://github.com/vercel/next.js/tree/canary/examples/with-supabase) | Good reference for cookie-based Supabase sessions and protected routes. Borrow the pattern, not the template unchanged; see tests below. |
| [Supabase](https://github.com/supabase/supabase) | Auth supports Google OAuth, email OTP, invitations, PostgreSQL, and row-level security. Chosen managed auth/data foundation. |
| [Better Auth](https://github.com/better-auth/better-auth) | Credible self-hosted alternative with Google and email-OTP plugins, but requires Patela to operate more of the auth, email, and database stack. Keep as fallback if managed Supabase is unsuitable. |
| [Hardhat](https://github.com/NomicFoundation/hardhat) | Chosen Solidity development loop. Its viem template tests contracts in both Solidity and TypeScript. |
| [vis.gl React Google Maps](https://github.com/visgl/react-google-maps) | Chosen React wrapper for Maps JavaScript API. Use it for actual map data, distinct from the order-milestone truck scene. |
| [React Three Fiber](https://github.com/pmndrs/react-three-fiber) | Chosen 3D scene candidate for the truck milestone animation. Keep text tracking usable without WebGL. |
| [Resend examples](https://github.com/resend/resend-examples) | Useful transactional-email examples. Supabase's OTP/invite mail needs a configured custom SMTP provider; Resend is one supported option. |
| [Google Cloud Node](https://github.com/googleapis/google-cloud-node) | Use current Speech-to-Text and Text-to-Speech packages from this monorepo. The older standalone Node speech repositories identify themselves as deprecated. |

## Local checks performed

Scratch work lives outside the Patela Git repository at `C:\Users\User\Desktop\W3Node\.research`.

| Check | Result |
| --- | --- |
| Official Hardhat 3 `node-test-runner-viem` template, `npx hardhat test` | **Passed:** 3 Solidity tests (one fuzz test with 256 runs) and 2 TypeScript tests. Solidity compiler 0.8.34 downloaded and compiled. |
| Official Next.js/Supabase example, dependency install | **Passed:** 412 packages installed. Production dependency audit found 0 vulnerabilities at the time of testing. |
| Starter source lint and TypeScript | **Passed after scratch fixes:** replaced a CommonJS Tailwind plugin import and used a local font fallback. Source-only lint and TypeScript passed. The starter's default `eslint .` script also scans generated `.next` files after a build, so Patela should explicitly ignore build output. |
| Starter production build | **Passed with webpack** after the scratch fixes and elevated filesystem access. The unmodified starter initially failed lint and could not fetch its Google font in this environment; Turbopack also hit a local process error. Pin compatible versions and self-host fonts in Patela. |
| `@vis.gl/react-google-maps` + `@react-three/fiber` + `three` in the starter | **Passed:** a scratch page composing a Google map, marker, and 3D canvas passed `tsc --noEmit` and source lint. This proves package/type compatibility, not live Maps behavior. |
| Hardhat dependency audit | **12 high findings**, all traced to the [Zod oversized-collection advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) in the development toolchain at the versions installed. Review and update before relying on this template in CI; do not blindly run an audit fix that downgrades Hardhat major versions. |
| Live Supabase, OAuth, email, Maps, speech, and chain integration | **Not run:** no provider credentials are configured, and the Docker engine did not start for local Supabase. These require a later integration environment. |
| FastAPI/web3.py local prototype | **Not run:** Python is not installed in this workspace. The recommendation is based on this environment and the shared TypeScript contract path, not a measured FastAPI benchmark. |

## Data and trust boundaries

Use Supabase `auth.users` for identity, with application tables linked by user ID:

- `profiles`: public display name and onboarding state; never store OTP secrets here.
- `organizations` and `memberships`: buyer, seller, carrier, verifier, and admin permissions. Role grants require a trusted server action and an audit trail.
- `wallet_links`: chain ID, normalized wallet address, user ID, and verification time. Link only after a fresh, domain-bound signed challenge (ERC-4361/SIWE); a pasted address is not proof of control.
- `orders` and `order_participants`: off-chain order details and the users who may read each order. Enforce row-level policies by participant/role.
- `verification_evidence`: minimal metadata and a private object reference for documents or photos; do not put personal documents on chain.
- `chain_events` and `order_chain_projection`: idempotent records keyed by chain ID, transaction hash, and log index, with block hash/number and confirmation state. Reconcile after reorgs. Only confirmed contract events advance funded/verified states.
- `notification_outbox`: templates, recipient, idempotency key, send status, and retries for onboarding and order emails.

Use SQL migrations and explicit RLS policies. Browser clients receive only a publishable key. Secret/service keys, speech credentials, notification sending, and verifier actions stay server-side. The contract and its events are the authority for payments and on-chain checks; PostgreSQL provides searchable dashboard views.

## Integration sequence

1. Create a Next.js app with pinned versions and Supabase SSR sessions. Configure Google OAuth, email OTP template, custom SMTP, allowed redirect URLs, and abuse/rate limits. Add profile creation and RLS tests.
2. Build buyer and verifier dashboards against real PostgreSQL rows with seeded test users. Define account roles and order visibility before adding payments.
3. Link wallets with a signed challenge. Keep Google/email identity separate from wallet ownership.
4. Implement contracts and ABI tests with Hardhat. Project confirmed events to the dashboard through an idempotent worker and reconciliation job.
5. Add Google Maps with a restricted browser key and a separately restricted server key if server-side routing is needed. Show milestone progression unless authenticated telemetry exists; a map route is not proof of truck location.
6. Add the optional truck scene driven by confirmed order milestones, with a text timeline and reduced-motion fallback.
7. Add Google Cloud Speech-to-Text and Text-to-Speech behind server endpoints after defining the voice use case, consent, language support, and audio retention. Speech output is input assistance, not verification evidence without an approved check process.
8. Test OAuth redirects, OTP delivery and expiry, RLS across users/roles, email retry/idempotency, Maps key restrictions, voice errors, and chain reorg/replay behavior in an environment with credentials.

## Decisions needed before implementation

- Target chain/testnet, payment asset, and contract custody/refund model.
- Whether Patela is a marketplace with separate seller/carrier organizations or a single operator.
- Which users may submit and approve each verification check, and what evidence is required.
- Whether tracking means actual GPS telemetry or only verified shipment milestones.
- Which speech actions are needed first (for example, dictate an address, read status aloud, or transcribe verifier notes), and which languages.
- Provider accounts, domain, and credentials for Supabase, Google OAuth/Maps/Cloud Speech, and SMTP. Do not commit secrets.

## Primary references

- [Supabase Auth](https://supabase.com/docs/guides/auth), [Google sign-in](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless), [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Hardhat 3 getting started](https://hardhat.org/docs/getting-started), [testing](https://hardhat.org/docs/guides/testing), [OpenZeppelin upgrades](https://docs.openzeppelin.com/upgrades-plugins)
- [ERC-4361 wallet signature requirements](https://eips.ethereum.org/EIPS/eip-4361), [viem typed contract interface](https://viem.sh/docs/contract/getContract)
- [Google Maps key restrictions](https://developers.google.com/maps/api-security-best-practices), [Speech-to-Text](https://docs.cloud.google.com/speech-to-text/docs/overview), [Text-to-Speech](https://docs.cloud.google.com/text-to-speech/docs/basics)
