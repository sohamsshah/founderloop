# FOUNDER LOOP v3 — VERTICAL-SLICE SHIPPING CHECKLIST

**Hard deadline:** Saturday 7 Nov 2026, 19:00 IST; target submitted by 18:45 IST.  
**Primary release rule:** a single **complete Product-only** workflow is better than three partially implemented agents. Preserve a working demo and automated smoke test after **every** gate.  
**Authority:** This file + `CODEX_HANDOFF.md` v3 override earlier task numbering, plans, and flow diagrams where inconsistent.  
**Progress values:** `[ ] TODO`, `[x] PASS`, `BLOCKED`, `SKIPPED`. Codex updates `docs/STATUS.md` with proof and blockers, not just claimed completion.

## Required end-to-end behavior at every gate

Regular, unmentioned message in an authorized Discord (or supported customer Slack) channel -> Switch receives silently -> Founder Loop classifies -> displays **verbatim source message + exact message permalink** and category context -> founder-only Slack card -> authorized founder `ACCEPT` / `REJECT` / `COMMENT` -> **one** verdict with the same original message citation to category-specific internal Slack channel -> record `CLOSED` after successful post. NO reply to customers, scheduler, owner assignments, work tracing, post-decision monitoring, or dashboard.

## Gate 0 — Environment and smallest possible integration spike (foundation, NOT a release)

- [x] **T00 — Repo/spec preflight [P0].** Inspect repo; read handoff v3 and this checklist; write `docs/IMPLEMENTATION_PLAN.md`, `docs/STATUS.md`, `.env.example`. Set scopes/credentials safely. **AC:** known setup and exact manual inputs; no secrets committed.
- [ ] **T01 — Passive real Switch event + outbound Slack [P0 / blocking].** Map one Discord source and `#founder-loop` / `#product` through Switch; receive an **unmentioned** Discord message with no bot reply/reaction; demonstrate sending a test message to Slack. Capture sanitized real event payload and explain Switch permissions. **AC:** live round trip or explicitly `BLOCKED` + transparently labeled fixture fallback; do not fake live integration.
- [ ] **T02 — Exact-message citation spike [P0 / blocking].** Inspect real Switch message metadata. Preserve original text, native message ID, native channel ID and Discord guild ID / Slack source `ts`. Resolve Discord individual-message link from trusted original IDs; use official Slack `chat.getPermalink` for Slack source, if enabled. Manually click a founder-accessible link to the **specific** message. **AC:** cited live message verified; missing IDs yield `EVIDENCE_BLOCKED`, not a made-up link or channel URL. Document findings in `docs/SWITCH_INTEGRATION.md`. **Never postpone this until polish.**
- [x] **T03 — Shared minimal foundation [P0].** Implement one event handler, input guard, bot-self exclusion, durable SQLite inbox, event ID idempotency, Google Doc adapter boundary, Slack outgoing transport and founder identity authorization; fixture replay for offline demonstration. **AC:** single injected event reproducible; no Discord source writes; restarted process does not duplicate outbound sends; fixture output visibly labeled.

**Gate 0 go/no-go:** If live source link is inaccessible or platform IDs absent, document exactly why, use explicit fixture mode and continue. Do not mark any fabricated citation as PASS.

## Gate A — PRODUCT INTELLIGENCE: first SHIPPABLE vertical slice

Execute the detailed live setup, test, and evidence steps in [`docs/PRODUCT_E2E_CHECKLIST.md`](docs/PRODUCT_E2E_CHECKLIST.md) in order. Its checked starting-state items do not change the live gate status below.

- [x] **T04 — Product relevance detection [P0].** Product-only candidate filtering and structured model output (request, bug, limitation, not relevant), with evidence pointing to original source event. **AC:** test feature message classified, ordinary chatter ignored; no model-written 'original' quote.
- [ ] **T05 — Single Google Doc product context [P0].** Read one authorized Google Doc, extract title/section/exact supporting excerpt, compare supported/planned/not_planned/unknown; handle source-unavailable honestly. **AC:** response cites real Doc/link and original customer message separately; no engineering Slack crawling. A labeled snapshot is allowed when Google API unavailable.
- [ ] **T06 — Product founder card with citation [P0].** Create stable `FL-xxx` card in founder-only Slack, showing original quote **verbatim**, source platform/channel/author/time, clickable **exact source message** permalink, separate AI assessment, linked Google Doc context and commands. **AC:** inspect Slack rendering, link opens actual source message, no bot activity in Discord, repeated same event creates no extra card. Missing deep link -> `EVIDENCE_BLOCKED` and **no** standard card.
- [ ] **T07 — Product founder decision and internal close [P0].** Validate configured founder ID and channel; accept `FL-xxx ACCEPT`, `FL-xxx REJECT`, `FL-xxx COMMENT <text>`; persist one immutable verdict; send **exactly one** #product message containing verdict, short verbatim original quote, exact original permalink and comment if supplied; mark CLOSED on successful delivery; handle outbox retry safely. **AC:** all three verdicts testable, unauthorized attempts rejected, duplicate commands don't duplicate post, full end-to-end Product works even with Revenue/Commitment disabled.
- [ ] **CHECKPOINT A — SHIPPABLE PRODUCT ONLY.** Run `product` integration and replay tests; demonstrate **customer message -> Google Doc -> citation-backed founder card -> founder verdict -> #product -> CLOSED**. Record screenshots/test command/live-vs-fixture truth in `docs/STATUS.md`. Commit known-good snapshot (if allowed). **AC:** standalone Product demo can be submitted right now. **STOP/SHIP HERE if time constrained.**

## Gate B — REVENUE INTELLIGENCE: second SHIPPABLE vertical slice

- [ ] **T08 — Revenue classifier + Google Sheet lookup [P1].** Add buying-intent recognition to existing pipeline. Read one `Leads` sheet and distinguish `new/existing/possibly_existing` using stable platform user ID, verified email/company key or lead ID. Display exact original-message deep link and quote in Revenue card; show Sheet match evidence without leaking other rows. **AC:** repeated messages from same known prospect do not create duplicate lead cards; same display name alone never auto-merges; missing Sheet clearly marked unavailable.
- [ ] **T09 — Revenue decision handoff [P1].** Reuse founder ACCEPT/REJECT/COMMENT validation and outbox; deliver one sourced verdict to `#sales`; optionally safe Google Sheet append/upsert on ACCEPT only if credentials permit (failure remains visible and must not silently retry into duplicate rows). **AC:** entire Revenue flow works independently, Product regression passes, exact source deep link retained to #sales.
- [ ] **CHECKPOINT B — SHIPPABLE PRODUCT + REVENUE.** Demo two separate end-to-end category flows and run Product regression tests. Record proof and checkpoint. **AC:** can submit even if Commitment is absent.

## Gate C — COMMITMENT INTELLIGENCE: third SHIPPABLE vertical slice

- [ ] **T10 — Support issue / promise detection [P1].** Identify a customer support issue or an explicit employee promise; quote exactly what was said, cite the **individual** source message, distinguish observation from AI inference. **AC:** no fabricated promises; no owner, due date, timer or work tracking.
- [ ] **T11 — Commitment decision handoff [P1].** Reuse authenticated founder card/decision/outbox to send verdict with exact source message link to `#support-alerts` (configurable engineering route), then CLOSED. **AC:** full Commitment journey; Product + Revenue regressions green; zero customer replies.
- [ ] **CHECKPOINT C — SHIPPABLE THREE-CATEGORY PRODUCT.** Demonstrate Product, Revenue and Commitment individually and consecutively; document proof/known limitations. **AC:** each founder decision routes to only its configured internal channel.

## Gate D — Final hardening and submission (no scope expansion)

- [ ] **T12 — Essential negative tests [P0].** Replayed messages, missing/invalid message IDs, wrong-source link, Slack thread reply permalink, quotes with formatting and line breaks, duplicate lead, repeated founder command, wrong actor/room, bot echoes, Google unavailable, outbound failure/retry, prompt-injection in customer text, source private-channel access. **AC:** tests prove no invented citations, no messages to source channel and no duplicate verdicts.
- [ ] **T13 — Submission/demo package [P0].** README, env/setup guide, `docs/STATUS.md`, `docs/SWITCH_INTEGRATION.md`, Google Doc/Sheet setup, 3–5 minute demo script beginning with Product-only flow, sanitized screenshot/video, final blurb, fixture vs live labels. **AC:** repeatable demonstration without relying on unfinished gates.
- [ ] **RELEASE SIGNOFF.** List gates as PASS/BLOCKED/SKIPPED. Confirm clickable source message link (manually checked), literal original message text, separate AI assessment, authenticated founder verdict, one correct internally routed post, CLOSED state. Submit passing scope only by 18:45 IST.

## Not in scope (do NOT create tasks)

No scheduled digest, reminder, deadlines, ongoing commitment progress, team member assignment/approval, customer replies, Discord bot responses, standalone dashboard, whole Slack workspace search, multi-document RAG, sophisticated CRM, fully independent agent deployments, or tracking after the founder's decision has reached internal Slack.

## Developer autonomy and stop rules

Codex may choose implementation details, but **must not** weaken exact source citation, real/fixture honesty, founder authorization or end-to-end correctness. If a Google API or live Switch permission blocks development, mark that integration BLOCKED and continue with clearly labeled fixtures against the same interface. **At 17:00 IST, freeze new feature development** and work only on tests, demonstration, and submission. If already later, ship the earliest passing gate rather than starting another unfinished agent.

## Current execution ledger — 7 Nov 2026, 12:00 IST

- T00 PASS: this folder is now an independent Git repository; `.env`, `.switch/`, `secrets/`, SQLite, and dependencies are ignored.
- T01 PARTIAL: standalone Switch health, agent ops authentication, WebSocket `connection_state` with `filter=all`, and ping/pong passed. Four private Slack channels and one Discord source channel were created, and the identified founder was invited to all four Slack channels. Switch Console's separate local server is running at `127.0.0.1:55571` and displays its existing Slack and Discord connections; it is now the chosen Product test server. The external custom agent is not yet registered there. No passive inbound or outbound Slack event was observed.
- T02 BLOCKED live: published generic message event does not guarantee native Discord IDs. Missing IDs produce `EVIDENCE_BLOCKED`; no live exact-message link was clicked.
- T03 PASS offline: SQLite inbox, evidence, decision, outbox, replay, founder authorization, and WebSocket client implemented.
- T04 PASS offline: cheap candidate filtering, optional structured model classification with literal source-excerpt validation, and heuristic fallback. The model path is mock-tested; no key or live model result is claimed.
- T05 PARTIAL live: user-supplied Google Doc was filled with clearly labeled demo reference content and saved. Public text export HTTP 200; app read 16 nonempty lines and matched a verbatim excerpt. OAuth Docs API access remains unverified.
- T06 PASS fixture, BLOCKED live: source quote and citation render correctly in simulated founder cards; no live clickable source link or Slack card observed.
- T07 PASS fixture, BLOCKED live: all three founder verdicts, authorization, one Product notification, and CLOSED tested; no live Product handoff observed.
- CHECKPOINT A: Product-only fixture demo and automated tests PASS; live shippable gate BLOCKED.
- T08 PASS offline, BLOCKED live: Revenue classifier, one-Sheet adapter, safe existing/possible/new match, stable prospect grouping, exact citation; no actual Sheet read.
- T09 PASS offline, BLOCKED live: Sales verdict and accepted Sheet upsert with failed-write retry tested; no actual Sheet write or Sales notification.
- CHECKPOINT B: all-category fixture can demonstrate Revenue, but live gate is BLOCKED pending Gate A and Sheet/room evidence.
- T10 PASS offline, BLOCKED live: customer issue versus explicit company promise distinguished; no owner/deadline tracking.
- T11 PASS offline, BLOCKED live: Support verdict and CLOSED tested; no live Support notification.
- CHECKPOINT C: all-category fixture can demonstrate Commitment, but live gate is BLOCKED pending previous live gates.
- T12 PARTIAL: 30/30 automated tests pass, including Product-only live configuration, replay, missing IDs, Slack threaded permalink input, founder identity, Sheet write retry and interrupted-write uncertainty, and ambiguous transport. Live source access/silence and exact-link click remain untested.
- T13 PARTIAL: README, demo, status, and integration docs are being refreshed. No live screenshot/video proof exists.
- RELEASE SIGNOFF: **not yet**. The last honest demo checkpoint is explicitly simulated Product, Revenue, and Commitment; no live gate may be claimed PASS.

