# Founder Loop

Founder Loop silently turns ordinary customer messages in authorized Discord or Slack channels into evidence-backed founder decisions. One Switch custom agent receives passive room events, preserves the verbatim source text, requires an exact-message link, enriches Product and Revenue signals, and posts a founder-only card. An authenticated founder replies `ACCEPT`, `REJECT`, or `COMMENT`; one verdict goes to the correct internal Slack channel and the card closes.

**Current state:** the complete three-category workflow runs in a clearly labeled local fixture demo and 28 automated tests pass. Switch agent WebSocket authentication and one public Google Doc export read were verified. Discord → Switch → Slack end-to-end delivery, founder-accessible source permalinks, Google Docs OAuth API access, and a live Leads Sheet are **not yet verified**. See [status](docs/STATUS.md).

## Run locally

Requires Node.js 22 or newer.

```sh
npm ci
npm test
npm run demo:product
npm run demo
```

`demo:product` is the preserved Product-only checkpoint. `demo` walks through Product, Revenue, and Commitment. Both are **SIMULATED FIXTURE** replays: `fixture://` citations are provenance markers, not live Discord links or actual Slack posts. The all-category replay intentionally shows that one support message can create two category-specific cards and route separate founder verdicts.

Detection uses a cheap local candidate filter. If both `OPENAI_API_KEY` and `OPENAI_MODEL` are configured, a structured model response may classify candidates; its evidence excerpt must be a literal substring of the original message. Model failures fall back to local rules. The fixture demo uses local rules and makes no live model claim.

## Live configuration

This folder is its own Git repository. Keep credentials in the ignored `.env` file and any service-account JSON under ignored `secrets/`. Use [`.env.example`](.env.example) as the field reference. The standalone Switch agent ID/key and Slack/Discord connector credentials have already been saved locally; room IDs, founder identity, and a Leads Sheet are still needed.

1. Connect Slack and Discord to the **standalone** Switch server, then map an authorized source channel and private founder, Product, Sales, and Support Slack channels into Switch rooms. Invite the custom agent to those rooms. The old Console-managed Switch server is separate.
2. Fill `SWITCH_SOURCE_ROOM_ID` (or comma-separated `SWITCH_SOURCE_ROOM_IDS`), `SWITCH_FOUNDER_ROOM_ID`, `SWITCH_PRODUCT_ROOM_ID`, `SWITCH_SALES_ROOM_ID`, `SWITCH_SUPPORT_ROOM_ID`, and `FOUNDER_SWITCH_SENDER_ID` from a verified founder Slack event. `FOUNDER_SLACK_USER_ID` adds a native Slack ID check when the bridge exposes it.
3. The provided demo Product Doc ID is already in local `.env`. `GOOGLE_DOC_PUBLIC_EXPORT=true` reads this publicly shared document through its text export and labels the result `public_export`. For private Docs, use a valid `GOOGLE_ACCESS_TOKEN` or a service-account JSON path in `GOOGLE_APPLICATION_CREDENTIALS`; share that **single Doc** with the service-account identity. The OAuth Docs API path has not been live tested.
4. For Revenue, configure one `GOOGLE_REVENUE_SHEET_ID` with a `Leads` tab using the columns in [Google integration](docs/GOOGLE_INTEGRATION.md). Enable `ENABLE_SHEET_WRITE=true` only after the chosen Google identity has Editor access. Read-only matching can run without writes.
5. Start the agent with `npm run live`. This uses Switch's documented WebSocket protocol with `scope=all`, `filter=all`, cursor resume, and ping/pong. It never posts to a source room.

The live agent requires trustworthy native Discord guild/channel/message IDs, a trusted exact message URL, or original Slack channel ID and message `ts` resolvable through Slack `chat.getPermalink`. The published generic Switch event does not promise these fields. Missing evidence yields `EVIDENCE_BLOCKED` and **no normal founder card**. Open a real source link as the founder before claiming Gate A passes.

## Safety and persistence

SQLite stores source events, their unchanged text, card evidence, category cards, immutable decisions, a delivery outbox, cursor, and audit records. A repeated source event or founder decision cannot create another card or verdict. Revenue groups messages by stable platform user ID and buying topic; display-name-only matches remain `possibly_existing`. On founder ACCEPT, a configured Sheet write re-reads by stable lead ID before append/update. If it fails, `SHEET_WRITE_FAILED` remains visible and the Sales verdict waits for a successful retry. With read-only/unavailable Sheet write access, the decision notification states the limitation.

Outbound HTTP timeouts and server errors are `DELIVERY_UNCERTAIN`; they are **not automatically retried**, because Switch has not provided a verified idempotency key for posts. Definitive failures remain retryable. CLOSED means the founder's verdict reached the configured internal room; it does not mean employee work was completed. There are no customer replies, reminders, owner assignments, follow-up tracking, or dashboard.

## Integration probes

```sh
node --env-file=.env scripts/probe-switch.js
node --env-file=.env scripts/probe-google.js
```

The Switch probe authenticates the socket and answers a ping; it does not prove room message delivery. The Google probe prints the configured Doc read mode and match metadata without exposing document content or credentials. See [Switch evidence](docs/SWITCH_INTEGRATION.md), [Google setup](docs/GOOGLE_INTEGRATION.md), and the [demo script](docs/DEMO_SCRIPT.md).
