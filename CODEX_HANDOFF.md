# FOUNDER LOOP v3 — CODEX MASTER HANDOFF (EVIDENCE-FIRST, SHIPPABLE SLICES)

**Submission deadline:** Saturday, 7 November 2026, **19:00 IST** (hard stop). Target submission by **18:45 IST**.  
**Status:** Specification only. Do not write application code until Codex starts implementation.  
**Product:** Silent multi-channel signal intelligence → founder-only decision card → founder accepts/rejects/comments → internal Slack channel notified → **CLOSED**.

> OVERRIDING CHANGE LOG: This v3 handoff and TASKS.md supersede older requirements. FLOW_DIAGRAMS.md is unchanged and non-normative where it conflicts with v3. No reminders, no owner assignment, no work tracing, no commitment deadline monitoring, no team decision inbox, no external customer replies, no post-decision completion tracking, no general-purpose workspace crawling, and no dashboard needed.

## 0. Mandatory instructions to Codex

You are the autonomous lead engineer responsible for a credible, shippable hackathon demo today. First read **this file and TASKS.md** in full. FLOW_DIAGRAMS.md is optional reference only. Inspect the repository and read the current official Switch documentation before invoking endpoints. Create `docs/IMPLEMENTATION_PLAN.md` and `docs/STATUS.md`, and implement the independent, testable vertical slices in TASKS.md and preserve a working release checkpoint after each gate. Persist progress, blockers, and test evidence after each task. Do not spend the available time building features not named in the MVP.

**Core goal:** Every founder card must show **the original customer message text verbatim and an exact-message permalink** (not a summary or channel link). An ordinary customer message is received **without a bot mention**, silently classified, optionally enriched using a Google Doc or Sheet, turned into a founder decision card in Slack, and—only after an authenticated founder response—turned into one small notification in the appropriate **internal** Slack channel. Store the decision and close the record.

**No-code policy for this handoff:** These Markdown documents are specifications, not prewritten application implementation. Codex owns implementation later.

**Hard rules:**
- One Switch-facing integration agent/process, with three logical specialist analyzers (Product, Revenue, Commitment); no need for three independently deployed agents.
- **Silent listen:** never reply to or react in source Discord/Slack channels. Ingesting/processing inbound events must have no outward side effects.
- **Evidence is release-critical:** an actionable founder card MUST show verbatim original source text and a link to that individual Discord/Slack message, including the source channel, author and time. Distinguish AI assessment from the original quote. Carry a verbatim excerpt and original link into the final internal notification. If an exact link cannot be resolved, hold the candidate as `EVIDENCE_BLOCKED`; never fabricate a link or silently substitute a channel homepage.
- **Founder only:** decisions go to `#founder-loop` (or founder-only DM/channel, configured). No team-member review/assignment flow.
- Founder response exactly **ACCEPT / REJECT / COMMENT**. COMMENT is a final decision containing the founder's comment; it is *not* a request for another approval cycle.
- Accepted, rejected, or commented decisions produce **exactly one** internal channel notification per decision. Never message customers.
- Product context: **one named Google Doc** as authoritative product/roadmap reference. No need to crawl `#engineering` or `#product` for context.
- Revenue context: **one Google Sheet** as authoritative existing lead/sales reference. Read before forming a revenue decision; update only if founder ACCEPTS and the configured Google API write path works. That write is part of the accepted decision, not ongoing follow-up.
- Commitment context: customer issue or employee promise observed in connected messages. **No deadline, owner or progress tracking**. Founder selects decision; notify support (or configured engineering channel); close.
- No scheduling, reminders, analytics dashboards, CRM, notifications to customers, post-decision tracking, or full workspace history sync.
- Keep persisted idempotency, authorization, evidence attribution, and outbound retry. Technical delivery retries are permitted; they are not product reminders.
- Never invent docs, endpoints, integrations, sources, source URLs, identities, company names or deal values. Clearly distinguish live Switch events from fixtures.
- Never expose Google service-account secrets or Switch keys in screenshots, logs, commits or submission.

**Time guards:** Ship real Switch round-trip first. If blocked by credentials or platform setup for ~60 minutes, implement a clearly labeled fixture replay along the same ingestion interface and continue; do not spend hours stuck. Freeze feature work no later than 17:00 IST; use remainder for tests, demo, and submission. If current time has passed a checkpoint, prioritize the working vertical slice and honest docs.

## 1. Problem, persona and one complete user journey

**Persona:** founder of a small SaaS/developer-tools startup. Internally the company uses Slack; externally it has Discord or customer-facing Slack rooms. Product roadmap is in a Google Doc, and sales/lead tracking is in a Google Sheet.

**One-liner:** Founder Loop silently turns noisy community conversations into three kinds of evidence-backed founder decisions, then delivers the founder's verdict to the right internal Slack team channel.

**Start:** A customer or prospect posts a regular message in an authorized source channel. No `/founderloop`, no `@agent`, no bot response.

**Middle:** Switch bridge conveys source message into a mapped Switch Room. Custom agent receives passive event, applies cheap relevance filter, runs a classifier for relevant messages, queries the one Google context source appropriate to each category, deduplicates related items, then creates ONE founder decision card for an actionable insight.

**Decision:** Founder responds in Slack with `ACCEPT`, `REJECT`, or `COMMENT <text>` against a stable card ID. Interactive Slack buttons are optional, only if verified and very fast. Founder identity and source channel MUST be verified server-side; never trust free-text sender names.

**End:** Founder Loop posts one short internal message to the configured category destination:
- Product → `#product` or `#engineering` (configured route; for a fixed MVP prefer `#product`).
- Revenue → `#sales` (or `#marketing`, configured; prefer `#sales`).
- Commitment → `#support-alerts` (or configured `#engineering` if indicated; MVP default `#support-alerts`).

Then record audit trail and mark card CLOSED after successful outbound delivery. On failed delivery, mark `DELIVERY_FAILED` and retry technical delivery; **do not** start a customer workflow or deadline tracking. Any unrecognized or unauthorized founder command is rejected without posting a decision.

### Card UX contract — hard requirement

Each founder card must display: card ID and category; short title; **verbatim original customer/employee message** (preserving punctuation, with safe Slack formatting); original platform/channel; sender and timestamp; a clickable **exact-message URL**; a visually separate **AI assessment**; related Google Doc section and direct Doc link (Product), or matching Sheet row/status (Revenue); ACCEPT / REJECT / COMMENT instructions. For long originals, show a clearly labeled verbatim excerpt, with full exact original text accessible from the persisted event / source link. Never quote or paraphrase a model's text as if the customer said it. Do not replace original evidence with an AI-generated slogan.

**Example Product card (fictional sample; placeholders must never reach real cards):**

```text
FL-001 · PRODUCT · Scheduled exports
SOURCE: Discord #feature-requests · @member · 10:21 IST
ORIGINAL MESSAGE (verbatim):
"Can we schedule exports automatically? We need this for our daily workflow."
VIEW ORIGINAL: <validated deep link to this exact Discord message>

PRODUCT KNOWLEDGE: Roadmap → Exports [link to Google Doc]
DOCUMENT EXCERPT: "Scheduled export automation — under consideration."
AI ASSESSMENT (not a quote): This request aligns with a roadmap candidate.

DECIDE: FL-001 ACCEPT | FL-001 REJECT | FL-001 COMMENT <text>
```

**Example Revenue card:** exact original SSO evaluation text + exact Discord/Slack message link + Google Sheet match result + separate inferred buying intent.

**Example Commitment card:** exact complaint or explicit employee promise + individual message link + separate suggested disposition; no tracking beyond founder decision.

**Internal verdict message:** short verdict + card ID + founder comment if any + short **verbatim** source quote + clickable source-message deep link. No generic channel links.

## 2. Exact signal capture: silent, event-driven, bounded

A bridge *transports* messages; it does not automatically make the agent reply. The custom agent receives events via its WebSocket subscription. Event-driven means messages may be observed individually without ever posting to the originating channel. No reaction, typing indicator, thread reply, slash command, or mention should be required to detect an eligible message.

**Mandatory Switch spike:** Verify an **unaddressed** message (ordinary message, no mention) from Discord triggers an agent-visible event using appropriate authorized room `scope`/`filter` settings. Record the actual event payload field names and authorized rooms in `docs/SWITCH_INTEGRATION.md`. If that fails, do not assert passive capture is supported by the installed setup; use an honestly labeled simulator while documenting the missing permission/configuration.

**Processing tiers:**
1. Parse and persist inbound event, platform message IDs and exact original text (no outward post). Drop bot/self echoes, platform system events, disallowed rooms and malformed events. De-duplicate source event IDs.
2. Run lightweight cheap candidate filter (keyword/intent heuristics and message length/context) to avoid unnecessary LLM calls. *A conservative filter should avoid false negatives.*
3. For candidates, use one LLM structured response with 0..N category labels PRODUCT / REVENUE / COMMITMENT, confidence and exact evidence text.
4. Apply thresholds and aggregation to avoid founder spam: one card per distinct actionable insight/lead, not per message. For MVP deterministic exact IDs and normalized subject keys are enough; no complex vector store required. A user can create multiple different insights, and one message can have multiple categories.
5. Resolve and validate **exact original-message permalink** before posting. If blocked, store `EVIDENCE_BLOCKED` without posting an actionable card. Then enrich selected signals with Google context and post only source-cited founder cards. **No source channel output.**

**Noise policy:** Not every message gets a card; not every message gets an LLM call. One source message may inform an already-open card. If duplicate happens after founder has closed, do not reopen that exact message event. No daily digests or time-based batch jobs.

## 3. Three logical intelligence agents

### A. Product Intelligence — authoritative single Google Doc

**Locked MVP choice: Google Doc**, not real-time `#engineering` channel searching. One product knowledge document (`GOOGLE_PRODUCT_DOC_ID`) has sections: Product overview, Current features, Known limitations, Roadmap (Now / Next / Later), Engineering constraints, Optional FAQs. Include named sections and concise product facts; avoid huge unstructured document.

**When to consult it:** after signal classifier marks an item PRODUCT and before card creation. Read at startup and/or lazily, cache in memory, manually reload if desired. No polling or scheduling required. If Google Docs API is unavailable, local markdown/text snapshot may serve as clearly labeled fallback; do not present fixture as live Google Docs integration.

**Comparison:** extract feature/request → map to doc concepts using simple text/LLM prompt → classify `already_supported`, `planned`, `not_planned`, `unknown`; cite doc heading + excerpt, avoid hallucinated roadmap priority. Recommendation sent only to founder; founder verdict routes to `#product`.

**Docs API:** `documents.get` with read-only OAuth scope using service account shared onto this specific Doc. Confirm service account allowed in user's Workspace; some Workspace policies may require a different auth route. No full Drive search.

### B. Revenue Intelligence — authoritative single Google Sheet

**Locked MVP choice: Google Sheet** (`GOOGLE_REVENUE_SHEET_ID`). Tabs:
- `Leads`: `lead_id | company | contact_name | platform | platform_user_id | email_if_supplied | source_ref | buying_signal | stage | notes | updated_at`
- Optional `FounderDecisions` tab **only if useful**; primary decision audit remains SQLite.

**When to consult it:** after REVENUE classification and before founder card. Read existing rows via Sheets API, cache briefly in process; no automated scheduled sync. Detect whether lead is existing or new, suggest what founder should decide. Never assert a name or company not explicitly present. No pipeline tracking after founder decision.

**Deduplication has TWO meanings:**
- **Transport/idempotency:** a retried/replayed Discord event must never produce an extra card or destination notification.
- **Business deduplication:** three sales-related messages from the *same known stable Discord user ID* about the same buying topic should attach to one candidate lead/card, not create three separate lead rows. If the prospect's explicit email or verified company ID matches an existing Sheet row, refer to that row. Names alone (e.g. `Alex`) are not sufficient to merge. When identity is ambiguous, mark `possibly_existing` and keep separate rather than merging.

**On founder ACCEPT:** create/update one row of `Leads` if Google write auth is available, idempotently keyed by `lead_id`/stable source ID; then post Slack `#sales` decision and close after delivery. If Sheet write fails, show partial completion honestly (`SHEET_WRITE_FAILED`), retain decision in SQLite and retry the technical write. Do NOT pretend success or silently add a duplicate. On REJECT or COMMENT, only post founder decision to Slack; do not insert a new lead unless founder explicitly approves that as a later feature.

**Sheets API:** use Google Sheets Values GET and append/update operations as necessary. Service account must have Viewer (read) / Editor (write) access to specific Sheet; read and write privileges should be configured separately and minimally. If write setup is too slow, ship a read-only Sheet proof plus an explicit limitation—the card and routing demo remain valid.

### C. Commitment Intelligence — classification + founder verdict ONLY

Detect an explicit employee/company promise to a customer (`we will investigate`, `we will send details`) or a customer-facing support issue worth founder review. Distinguish `explicit_company_promise` from `customer_issue_only`. Never invent who promised, a due date, or an outcome. No owner assignment, due-date extraction requirement, scheduler, status monitor, work tracing, verification or follow-up messaging.

On founder ACCEPT / REJECT / COMMENT: post concise verdict in `#support-alerts` (or configured target, e.g. engineering) with original evidence and any founder comment; mark closed once delivered.

## 4. Technical architecture: smallest shipping surface

```
Discord / customer-facing Slack channel
  -> Switch collaboration bridge -> authorized Switch Room
  -> Founder Loop custom Switch agent WebSocket (passive, silent)
  -> normalize + durable inbox + dedupe
  -> cheap candidate filter -> structured multi-label classification
  -> conditional context: Product = Google Docs / Revenue = Google Sheets / Commitment = no external KB
  -> insight grouping + one actionable card -> Switch -> Slack #founder-loop
  -> authenticated founder ACCEPT/REJECT/COMMENT (same Switch inbound route or verified Slack callback)
  -> SQLite audit + outbox
  -> Switch -> Slack destination (#product / #sales / #support-alerts)
  -> CLOSED
```

Recommended defaults for blank repo: Python 3.11+, FastAPI only if an HTTP service is needed, SQLite, pytest, Google official Python client (or gspread for Sheets), one agent process. No Redis, pgvector, background scheduler, standalone UI, CRM, workers or service graph.

**Essential persistence:**
- `source_events`: unique(platform, room_id, platform_message_id, event_version), platform-native channel ID, source guild/server or workspace ID, **exact original text**, source author ID/display, message timestamp, verified exact-message permalink, permalink resolution status, Switch event ID, authorized scope, processed_at.
- `insights`: insight_id, types, normalized_topic, summary, confidence, context_status, `OPEN | CARD_DELIVERED | DECIDED | DELIVERY_FAILED | CLOSED`, source references.
- `insight_evidence`: insight ID, source event ID, verbatim quote, **individual exact-message permalink**, primary/supporting evidence role, relation. Never synthesize a merged quote.
- `founder_cards`: card ID, insight IDs, primary source-event reference, exact-message link and verbatim source text reference, founder destination, Switch/platform message ID, delivery status, created time.
- `founder_decisions`: unique(card_id), verified actor ID, `ACCEPT | REJECT | COMMENT`, optional comment, decided_at, destination, posted_at, delivery status.
- `lead_links`: source identity keys + optional exact matching Google Sheet row/lead ID; uncertain matches flagged, never force merged.
- `outbox`: stable idempotency key, destination, payload, attempt count, last error and state.

Prefer simple schemas. For a multi-category message, either one card listing multiple types and routes to all relevant internal channels after founder decision **OR** separate type-specific cards; choose the simpler type-specific card model for MVP, with common source evidence and exact per-type destination. Never send duplicate notification for the same card/destination.

**Founder command interface:** prefer native Slack interactive buttons ONLY if the bridge and callback handling can be verified fast. Otherwise explicit text replies in `#founder-loop` with `FL-123 ACCEPT`, `FL-123 REJECT`, `FL-123 COMMENT Please evaluate next sprint`. Commands accepted only from configured `FOUNDER_SLACK_USER_ID` (verified platform ID) and authorized founder channel/room; tests must reject messages from arbitrary community users. Do not assume the bridge exposes a button callback path.

**Outbound routing map:** `PRODUCT -> SLACK_PRODUCT_DESTINATION`, `REVENUE -> SLACK_SALES_DESTINATION`, `COMMITMENT -> SLACK_SUPPORT_DESTINATION`. Optionally environment-map specific categories to engineering or marketing. If destination is missing/unavailable, show `DELIVERY_FAILED`, do not fabricate delivery.

**Close semantics:** close after destination delivery is confirmed (or best available positive result), not after employee work completion. The **business** workflow ends when founder's verdict reaches the internal channel. Retries only ensure delivery, never follow up on task execution.

## 5. Switch verification and integration constraints

Official current docs to consult:
- https://docs.switchagents.ai/switch-rooms/internals/collaboration-bridge
- https://docs.switchagents.ai/switch-rooms/internals/agent-protocol
- https://docs.switchagents.ai/switch-rooms/internals/agent-connection
- https://docs.switchagents.ai/switch-rooms/internals/agent-events
- https://docs.switchagents.ai/switch-trust-cli/index

Documented bridge: one Switch room maps to one external channel, in both directions, and bridge receives new messages after joining rather than guaranteeing historical history. Transport adapters include Slack Socket Mode and Discord Gateway. An inbound platform message becomes a Switch room event. The bridge must be configured to connect the chosen source and destination channels.

Custom agent uses documented WebSocket subscription plus HTTP operations. Re-verify exact auth, scope/filter, event schema, GET ops and post-message semantics with the actual server; never invent a client SDK. An agent may have restrictions on receiving messages not addressed to it: **the T01 passive-message test is an explicit GO/NO-GO gate**. Different Slack channel mappings/permissions must be tested individually. Use source-event idempotency to handle replay and duplicate delivery. Bridge loop prevention does not replace your app's duplicate/outbox logic.

**Critically:** source messages can be delivered to your process silently. The app should NOT call `post_message` in source rooms and should ignore its own outbound messages when they appear via the bridge.

## 6. Google integration configuration (fastest)

Google Workspace file access via a service account shared on each individual Doc/Sheet is feasible without broad Workspace admin delegation, subject to organizational restrictions. Steps for human setup: enable Docs API and Sheets API in Google Cloud project; create service account and credentials; share only the specific roadmap Doc and lead Sheet with service-account email; configure `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_PRODUCT_DOC_ID`, `GOOGLE_REVENUE_SHEET_ID`. Viewer Docs, Editor Sheet if writes enabled. Never paste secrets into repo or a prompt.

If setup blocks progress: provide read-only export snapshots of precisely those files as fixtures, label as fixture, and keep Google adapter boundary for later. For demo credibility prioritize at least one actual Google API read before advanced matching. No assumption that ChatGPT Google Drive connector, even if installed, grants the separately running Codex app API access.

## 7. Product acceptance criteria

**A. Silent ingestion and citation fidelity**
- [ ] Normal unaddressed Discord message is received by agent; NO reply, reaction, thread or typing in Discord.
- [ ] Non-signal messages create zero founder cards.
- [ ] Duplicate source messages create zero additional founder cards.
- [ ] Every actionable card contains a clickable exact-message source link and visible original text verbatim; AI assessment is explicitly distinct.
- [ ] Every final internal verdict contains a short verbatim excerpt and the same source-message link.
- [ ] No exact link -> `EVIDENCE_BLOCKED`, zero normal decision cards and a diagnostic entry.
- [ ] Manually open an actual founder-card Discord source link and confirm it targets the exact message; also test Slack source link if Slack source is enabled.

**B. Intelligence**
- [ ] PRODUCT evidence compared with single Google Doc; card reports `supported/planned/not_planned/unknown` based only on doc.
- [ ] REVENUE evidence compared with single Google Sheet and marked `new/existing/possibly_existing` based on safe keys.
- [ ] COMMITMENT identifies customer issue versus explicit company promise, no deadline tracking.
- [ ] Context unavailable is clearly stated; no fabricated matches.

**C. Founder decision and channel handoff**
- [ ] One product, one revenue, one commitment card delivered to founder-only Slack channel.
- [ ] Verified founder can `ACCEPT`, `REJECT`, `COMMENT` by stable card ID.
- [ ] Each decision posts **once** to correct internal category channel with founder verdict and evidence.
- [ ] Founder COMMENT is carried faithfully (without interpreting it as automatic approval).
- [ ] Closed means internal notification delivered; no subsequent reminders, customer replies, or task-tracking.
- [ ] Unauthenticated or wrong-room decisions cannot trigger routing.
- [ ] Replay or repeat command cannot create duplicate destination posts.

**D. Independent shippable vertical slices**
- [ ] **Gate A Product-only** completes full Discord -> Switch -> Google Doc -> cited founder card -> authorized decision -> #product -> CLOSED pipeline, without Revenue/Commitment.
- [ ] **Gate B Revenue** independently works end-to-end using Google Sheet, reusing Gate A infrastructure; Product regression remains green.
- [ ] **Gate C Commitment** independently works end-to-end; earlier regression tests remain green.
- [ ] Each gate has its own fixture/demo, test command, and recorded PASS/BLOCKED status. If time runs out, release the last passing gate.

**E. Submission**
- [ ] README, setup/env reference, 3–5 minute demo script, sanitized integration proof, automated tests and truthful limitations.
- [ ] A fixture replay demonstrates entire flow if any external integration remains blocked, visibly labeled simulated.

## 8. Failure modes and explicit behavior

| Problem | Expected behavior |
|---|---|
| Unaddressed messages not delivered to agent | Document missing switch scope/filter/permission; do not fake live; use fixture replay |
| Google Doc unavailable | Card says product context unavailable; optionally label local snapshot fallback |
| Google Sheet unavailable | Card says lead status unknown; never assume new |
| Same revenue user posts repeatedly | Associate to same candidate when stable identity and topic match; one active card |
| Shared display name only | Mark possible match, do not merge |
| One message is PRODUCT and REVENUE | Two category cards if MVP per-type model; evidence shared, distinct destinations |
| Agent sees its own Slack destination output | Ignore bot/self-authored messages to avoid loops |
| Founder replies from wrong account or room | Reject, audit, never notify target channel |
| Founder clicks/replies twice | One immutable final decision; second is no-op/conflict, no duplicate output |
| Switch destination post fails | Outbox failed/retry (technical only); don't mark CLOSED |
| Sheets accepted-write fails | Persist accepted founder verdict and sheet write error; do not duplicate lead row |
| Malicious message instructs agent to reveal private context | Treat as untrusted data, do not follow instructions or leak secrets |

## 9. No-go features (hard scope exclusions)

- No scheduled digests, time-based jobs, reminders, SLAs, promise due dates or deadline monitoring.
- No owner assignment, staff decision approval, employee status tracking, escalation hierarchy, progress updates, or customer follow-up.
- No outbound Discord/Telegram/customer Slack messages, no customer replies, no recording customer-confirmed resolution.
- No multiple Google Docs, broad Drive discovery or full Slack search.
- No standalone founder dashboard or separate microservices.
- No broad CRM integrations or scoring pipeline after founder decision.
- No automatic creation of company work tasks; verdict is posted to internal Slack channel and ends.

## 10. Release / demo requirements

**Demo (3–5 minutes):** Start with the complete citation-backed Product vertical slice; demonstrate Revenue and Commitment only if those gates pass.  1) customer sends normal unmentioned Discord message, show no bot response; 2) agent detects product feature request, references Google Doc, founder card appears; 3) sales prospect asks about evaluation, reference lead Sheet, founder card; 4) commitment/support request gets card; 5) founder ACCEPT / REJECT / COMMENT across three examples; 6) corresponding messages appear exactly once in `#product`, `#sales`, `#support-alerts`; 7) status CLOSED and no customer replies or further tracking. Show sources and audit trail. If one integration is simulated, say so explicitly.

**Prepare:** README, `docs/DEMO_SCRIPT.md`, `docs/SWITCH_INTEGRATION.md`, `docs/GOOGLE_INTEGRATION.md`, `docs/STATUS.md`, sanitized evidence, final submission blurb, and automated tests. Always preserve a working demo over speculative features.

**Final check before submission:** Can an evaluator see a silent source message, a founder card, a founder verdict, and correct internal Slack handoff using a reproducible environment? If YES, feature complete. Stop.


## 11. Exact source citation and permalink resolution — v3

A citation means **(1) visible original message text, (2) clickable link directly to the specific original Discord/Slack message**, and (3) platform, channel, author and time. A link to the channel or Switch Room, or an AI summary without the quote, is NOT a citation. An AI must never reconstruct original wording from memory. Preserve the untouched source text from the event and escape Slack markup safely at render time.

Resolve by this priority:
1. Prefer an original-message URL carried in a trusted bridge/adapter event, if present and validated. **Do not assume Switch exposes one; inspect real events first.**
2. **Discord:** if the real adapter event contains trustworthy numeric guild ID, channel ID and message ID, generate `https://discord.com/channels/<guild_id>/<channel_id>/<message_id>` using those native IDs. Do not derive from channel names or Switch room IDs. Verify by opening a real founder-card link against a real Discord message. If no guild ID is available, obtain it from an authorized source adapter; otherwise mark evidence blocked.
3. **Slack:** request the source message's permalink via official Slack `chat.getPermalink` using the platform's original channel ID and original message `ts` (including thread reply when relevant). Never use the Switch room ID or wall-clock timestamp. If those platform IDs aren't exposed, add minimum authorized metadata enrichment or mark blocked.
4. No trustworthy IDs or URL -> `EVIDENCE_BLOCKED`, store diagnostic metadata, do not post a normal actionable card. Fixture data may have **explicitly simulated** source links, never mislabeled as real.

**Permission boundary:** a technically valid link may still be unreadable to the founder if they are outside the source Discord server or Slack workspace. Manually test founder access. Never bypass membership restrictions or repost private message text into a broader internal channel without permitted scope. For an inaccessible message, report the limitation and block that card until addressed.

**Grouped insights:** show the strongest original quote and exact link, plus up to two additional separate verbatim excerpts, each with its **own matching exact-message link**. Do not combine quotes into an invented sentence. Keep all underlying messages persisted.

**Google context:** product advice includes exact cited excerpt from the single Google Doc, its title/section and URL. A Doc URL can be a document-level link if a section deep link isn't available; it is additional evidence and does not replace customer-message permalink. Revenue includes Sheet name, tab and matching row/lead ID when present, with appropriate confidentiality safeguards. Never manufacture a supporting document statement.

**Contract tests:** exact source text persisted and rendered verbatim, special characters escaped, correct source/channel/message IDs, original threaded Slack reply link, grouped links match their quotes, missing IDs fail closed, duplicate events preserve same evidence, founder/internal handoff retain link, actual founder can open at least one live source permalink.

Official permalink references for Codex:
- Slack: https://docs.slack.dev/reference/methods/chat.getPermalink/
- Discord message link UI guidance: https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID

## 12. Vertical-slice delivery policy — v3

The earlier horizontal plan (build all classifiers, then all contexts, then all cards) is **superseded** by TASKS.md v3. Implement in this order, preserving a working demo at every gate:

- **Gate A: PRODUCT (minimum viable release).** Integration and exact source permalink -> product classifier -> one Google Doc -> founder evidence card -> ACCEPT/REJECT/COMMENT -> #product one-off handoff -> CLOSED. No Revenue/Commitment dependency.
- **Gate B: REVENUE.** Extend the same working pipeline with Sheet-based existing lead matching, lead dedup, independent revenue card -> founder decision -> #sales -> CLOSED. Keep Product green.
- **Gate C: COMMITMENT.** Extend with issue/promise classification, founder evidence card -> decision -> #support-alerts -> CLOSED. No deadline, owner, work or outcome tracking.
- **Gate D: RELEASE.** Cross-category corner cases, reliable replay, docs, smoke tests, demo and submission. Do not sacrifice the working Product slice for optional polish.

A gate is complete only when the **entire user journey** for that category works, including exact original message link and a correctly routed final Slack message. Run test(s), record observed proof, and commit checkpoint if permitted. Each gate must be independently demoable. If timing is tight, ship the last PASS gate and explicitly name unavailable gates. Do not modify FLOW_DIAGRAMS.md as part of this request.
