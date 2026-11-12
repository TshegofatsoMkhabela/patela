# 10 — AI Deliverable Review System Architecture

**Document Version:** 1.0  
**Last Updated:** 2026-11-09  
**Current Implementation Status:** `PROTOTYPE_ONLY` (Simulated by `demoReview` in `src/lib/patela-store.ts`; real worker scheduled for [Milestone 05](./milestones/MILESTONE_05_AI_REVIEW.md)).

---

## 1. Core Objectives & Safety Boundaries

Patela's AI Review System evaluates freelancer milestone submissions against the **explicit deliverables and acceptance criteria agreed upon before work began**.

### Mandatory Non-Negotiable Principles
1. **Strictly Advisory Authority:** The AI Review System is an evidence analysis tool, **not a payment authority**. Neither a `PASSED` nor a `FAILED` nor an `INCONCLUSIVE` AI review can ever automatically release or refund escrow funds.
2. **Honesty About Inspection Boundaries:** The AI must **never** claim to have verified an artifact, URL, or runtime behavior that it could not actually read or inspect. Any uninspectable requirement must be marked `INCONCLUSIVE` with an explicit explanation under `limitations`.
3. **Versioned & Auditable:** Every `AiReview` record permanently logs the `submissionId` (and `versionNumber`), `criteriaVersion`, `modelProvider`, `modelName`, `promptVersion`, raw token usage, and timestamp.

---

## 2. Supported Submission Types (Testnet MVP Scope)

To ensure reliable, deterministic evidence extraction, the Testnet MVP limits deep inspection to four artifact categories:

| Artifact Category | Supported Formats | Evidence Extraction Method |
|---|---|---|
| **1. Documents & Specifications** | `.md`, `.txt`, `.json`, `.csv`, `.pdf` | UTF-8 text extraction, PDF page/section text parsing, JSON schema/key inspection. |
| **2. Design & Visual Assets** | `.svg`, `.png`, `.jpg`, `.webp` | SVG DOM/attribute inspection, image dimension/metadata extraction, and multimodal vision inspection against UI deliverable criteria. |
| **3. Source Code & Archives** | `.ts`, `.tsx`, `.js`, `.sol`, `.py`, `.css`, `.html`, `.zip` (bounded $\le 25\text{ MB}$) | Safe zip listing (with zip-bomb protection), directory tree extraction, static file presence checks, and targeted source file reading. |
| **4. Accessible Public URLs** | `https://...` (GitHub repos, public docs/previews) | Safe SSRF-protected HTTP `GET` fetch with timeout ($10\text{s}$) to inspect HTTP status, page title/DOM metadata, or public repository README/tree. Private/gated URLs or CAPTCHA-protected pages are immediately marked `INCONCLUSIVE` (never bypassed). |

---

## 3. Structured AI Review Output Schema

All LLM responses are validated through a strict **Zod schema** before persistence:

```typescript
export interface AiCriterionEvaluation {
  deliverableId: string;
  requirementTitle: string;
  status: "PASS" | "FAIL" | "INCONCLUSIVE";
  evidenceInspected: string[];        // Exact filenames, line ranges, or URLs inspected
  explanation: string;                // Objective reasoning mapping evidence to criterion
  missingInformation: string | null;  // What was missing or could not be verified
  suggestedRevision: string | null;   // Actionable step for the freelancer if FAIL/INCONCLUSIVE
  confidence: number;                 // Integer 0 - 100
}

export interface AiReviewStructuredOutput {
  overallStatus: "PASSED" | "FAILED" | "INCONCLUSIVE";
  overallConfidence: number;          // Integer 0 - 100
  summaryExplanation: string;
  criteriaEvaluations: AiCriterionEvaluation[];
  limitations: string[];              // Explicit list of anything that could not be inspected
  recommendedNextStep: "CLIENT_APPROVAL_READY" | " targeted_REVISION" | "HUMAN_REVIEW_RECOMMENDED";
}
```

### Status Aggregation Rules
- `PASSED`: All mandatory deliverables evaluated as `PASS` with confidence $\ge 70$.
- `FAILED`: One or more mandatory deliverables evaluated as `FAIL`.
- `INCONCLUSIVE`: Zero mandatory deliverables failed, but one or more mandatory deliverables evaluated as `INCONCLUSIVE` (e.g., private Figma link or binary format that requires direct client inspection).

---

## 4. Retry Behaviour, Cost Management & Abuse Prevention

- **Queue & Retries:** Executed asynchronously via BullMQ (`ai-review` queue) with exponential backoff (`maxAttempts: 3`, initial delay `5000ms`). If all 3 attempts fail (e.g., upstream LLM outage), the review record is marked `ERROR`, the milestone still transitions to `AWAITING_CLIENT_APPROVAL` with a banner stating *"Automated AI check unavailable — manual client review required"*, and client approval is never blocked.
- **Token & Size Budgets:** Context extraction caps total text per submission at `64,000` characters and max 6 vision images per review to bound latency and API cost.
- **Rate Limiting:** Freelancers are rate-limited to a maximum of 5 submission versions per milestone per 24 hours to prevent AI token exhaustion abuse.
- **Prompt Injection Defense:** Extracted file contents and freelancer delivery notes are wrapped in delimited XML/JSON data blocks with system instructions explicitly forbidding the model from following instructions found inside user-submitted files.

