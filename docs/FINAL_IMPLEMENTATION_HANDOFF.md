# Founder Loop — final implementation handoff

**Prepared:** 7 November 2026

**Repository:** https://github.com/sohamsshah/founderloop

**Local project:** `FounderLoopCodexv3/`

**Purpose:** hand the implementation, its verified Product Intelligence flow, demo procedure, limitations, and next operational steps to a new maintainer or presentation session.

## Read this first

Founder Loop is a single Switch custom agent that listens in authorized source rooms, turns qualifying messages into evidence-backed founder decisions, and routes one final verdict to private Slack. The four routes are **Product**, **Revenue**, **Commitment**, and **General**. General handles requests for the founder to respond or act when a specialist route does not cover the request.

The latest local release status records a live Product journey (`FL-011`), a live Revenue journey (`FL-012`), and a live Commitment journey (`FL-010`) on a **local standalone Switch server**. The reproducible judge demo is separate: it is a labeled fixture replay and does not contact Switch, Discord, Slack, or Google. See [`STATUS.md`](STATUS.md) for the observed live evidence and limits.

The source release target is `main` in the GitHub repository above. Live validation was performed with the local standalone Switch deployment.

## Architecture in one path

```text
Customer / staff message in an authorized Discord or Slack room
  → Switch messaging bridge and mapped Switch room
  → Founder Loop custom-agent WebSocket (unaddressed room events included)
  → source validation + exact-message evidence resolution
  → Product / Revenue / Commitment / General relevance and context
  → private Slack founder card
  → authenticated ACCEPT, REJECT, or COMMENT
  → one verdict to private Product, Sales, Support, or founder Slack room
  → CLOSED after acknowledged verdict delivery
```

The code is a Node.js 22 ES-module process. `src/switch-connection.js` maintains the Switch WebSocket with room claims, cursor resume, and ping/pong. `src/evidence.js` resolves source citations. `src/loop.js` coordinates classification, enrichment, cards, decisions, and delivery. `src/store.js` holds the SQLite inbox, source evidence, cards, decisions, outbox, and cursor. `src/transport.js` posts through Switch. `src/slack-interactions.js` handles founder buttons and the Comment modal through a **separate Slack app**; text commands remain available. `src/product.js`, `src/revenue.js`, and `src/classify.js` implement the category logic.

Switch supplies messaging connectors, rooms, and the agent communication protocol. Founder Loop supplies the business rules and decision lifecycle. The Switch generic message event does not guarantee the native IDs required for a platform permalink; Founder Loop therefore independently verifies a unique source message or holds the candidate as `EVIDENCE_BLOCKED`.

## Latest Product Intelligence test flow

The latest live Product evidence is `FL-011`, recorded in [`STATUS.md`](STATUS.md):

1. A demo roadmap row was set to `founder_review` with a concrete question. A shipped manual-exports request stayed quiet.
2. An ordinary dashboard-reporting request was posted in Discord without addressing the agent. Switch carried the event to Founder Loop. A follow-up grouped under the **same roadmap item and revision**, rather than creating another founder decision.
3. The founder card carried the original source text and an exact Discord message link. The founder opened that link. Product context came from the named **demo Google Doc through public text export**.
4. The founder used **Accept**. One private Product verdict carried the same source citation. The card reached `CLOSED`, and its Slack controls were removed. The demo roadmap row was returned to hold after the test.

Earlier live Product tests covered a Comment modal (`FL-006`) and a Reject text command (`FL-004`). See the [Product test checklist](PRODUCT_E2E_CHECKLIST.md) for reproduction steps.

An existing roadmap item needs an eligible status, `founder_review`, a positive decision revision, and a specific decision question. Subsequent matching messages attach as evidence for the same item and revision. A concrete new request can surface as unreviewed when it has no matching roadmap entry. See [`GOOGLE_INTEGRATION.md`](GOOGLE_INTEGRATION.md) for the row format.

## Other verified live flows

| Flow | Local evidence | Boundary |
| --- | --- | --- |
| Revenue | `FL-012` matched fictional lead `DEMO-001` from a public Leads Sheet export, showed USD 24,000 opportunity value and USD 2,000 current MRR, sent one private Sales verdict after Accept, and closed. `FL-013` also closed after Accept. | Extended Leads schema is read-only here. |
| Commitment | `FL-010` took an outage report from Slack `#support-alerts`, kept its exact source link, sent one private Support verdict after Accept, and closed. | Staff-promise intake needs a verified staff identity allowlist for a live check. |
| General | `FL-024` closed after Accept. | The verdict stays in the private founder room. |

## Run and verify the current source

From this repository root with Node.js **22.22.0**:

```sh
npm ci
npm test
npm run demo:product
npm run demo
```

At handoff, `npm test` passed **59/59**. `npm run demo:product` closes one Product card and `npm run demo` closes four category cards. The fixture uses `fixture://` citation markers for simulated source links. These commands require no `.env` or service credentials.

For a live local deployment, follow [`ENVIRONMENT_SETUP.md`](ENVIRONMENT_SETUP.md). Use the standalone Switch server, map the source and private Slack rooms, verify the founder's Switch sender identity, configure exact-source evidence and Google references, then start `npm run live` or the bundled Compose agent. Keep `.env`, tokens, service-account files, and SQLite data out of Git. Do not run two Switch bridge consumers against the same Slack/Discord app credentials.

The Docker agent can list `UNCERTAIN` outbox deliveries with:

```sh
docker compose -f compose.agent.yml exec founder-loop-agent node src/cli.js reconcile
```

Inspect the destination before marking an uncertain post delivered or retryable. An ambiguous outbound result is intentionally not retried automatically, because it may already have posted.

## Evidence and safety contracts

- Preserve the **verbatim original** separately from any AI or heuristic assessment. Carry an exact-message citation into both the founder card and internal verdict.
- A missing or ambiguous individual-message citation produces `EVIDENCE_BLOCKED`; never substitute a channel URL or fabricate platform IDs.
- Source rooms are intake only. Founder Loop does not reply, react, or post a verdict there.
- Founder decisions require the configured founder identity and room. A decision is final and immutable; a repeated event or command must not create a second verdict.
- SQLite commits decisions with pending handoffs and tracks outbound state. A card becomes `CLOSED` after the destination accepts the verdict, not after the downstream team completes work.
- The Google exports used for the walkthrough contain demo data.

## Handoff actions

1. **Verify the release revision.** Compare the local commit with GitHub `main` before using the repo as the installation source.
2. **Capture the public walkthrough.** Follow [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md): show the verified Product source link, roadmap context, closed card and Product verdict; then Revenue and Commitment. Crop unrelated channels, private conversation content, IDs, and credentials. Verify the published capture opens for a signed-out viewer.
3. **Choose the production Google access mode.** Replace demo public exports with approved private data and authenticated read access; verify the Docs and Sheets paths against the real references. Keep the extended Leads workbook read-only unless a separately reviewed write path is introduced.

## Reference map

- [`README.md`](../README.md) — product overview and local run
- [`STATUS.md`](STATUS.md) — latest recorded live proof and limitations
- [`INTELLIGENCE_E2E.md`](INTELLIGENCE_E2E.md) — test cases for all four categories
- [`PRODUCT_E2E_CHECKLIST.md`](PRODUCT_E2E_CHECKLIST.md) — detailed Product gate evidence procedure
- [`SWITCH_INTEGRATION.md`](SWITCH_INTEGRATION.md) — Switch connection and exact citation details
- [`GOOGLE_INTEGRATION.md`](GOOGLE_INTEGRATION.md) — Product roadmap and Leads schemas
- [`ENVIRONMENT_SETUP.md`](ENVIRONMENT_SETUP.md) — live setup
- [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md) — sanitized 3–5 minute recording plan
- [`SUBMISSION.md`](SUBMISSION.md) — concise submission claims
- [Switch: life of a message](https://docs.switchagents.ai/switch-rooms/internals/life-of-a-message)
- [Switch: agent connection](https://docs.switchagents.ai/switch-rooms/internals/agent-connection)
- [Switch: agent events](https://docs.switchagents.ai/switch-rooms/internals/agent-events)
