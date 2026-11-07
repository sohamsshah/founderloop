# Founder Loop

Founder Loop silently turns ordinary customer messages in authorized Discord, Mattermost, Slack, or Telegram rooms into evidence-backed founder decisions. One Switch custom agent receives passive room events, preserves the verbatim source text, requires an exact-message link, enriches Product and Revenue signals, and posts a founder-only card. An authenticated founder replies `ACCEPT`, `REJECT`, or `COMMENT`; one verdict goes to the correct internal Slack channel and the card closes.

**Current state:** the Product workflow passed live Discord → Switch → private founder Slack → Product Slack → CLOSED tests using a text command, an Accept button, and a Comment modal. Completed interactive cards replace their buttons with “🎉 Decision made. Loop closed”; fresh `FL-008` proved the automatic update and one Product verdict. The Support Slack channel is now a second source room: only customer issues or explicit promises should create Commitment founder cards. Its exact Slack permalink resolver passed a live read-only probe; a fresh human issue is still needed for a live card. Telegram source support is implemented and its Docker bridge is connected, but message delivery has not been verified live. All 51 automated tests pass. The Product reference remains labeled demo content read through `public_export`. Revenue, Google Docs OAuth API access, and a live Leads Sheet remain unverified. See [status](docs/STATUS.md).

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

This folder is its own Git repository. Keep credentials in the ignored `.env` file and any service-account JSON under ignored `secrets/`. Use [`.env.example`](.env.example) as the field reference. The Product test runs on the standalone Switch server with Gateway at `http://127.0.0.1:13000`. With the founder's approval, the Console-managed server was stopped and its Slack/Discord tokens were connected to standalone. Do not restart the Console-managed server while standalone uses those tokens. Product room IDs and the verified founder Switch identity are in ignored `.env`.

1. Use the existing **standalone** Switch server and agent. Before moving the Slack and Discord connectors, stop their current Console-server consumer or use separate test app credentials; never run two consumers on the same tokens. Connect Slack and Discord to the standalone server through its Gateway/Console connection, verify both bridges, and map the dedicated Discord source and private Slack founder/Product channels into Switch rooms. Invite the agent to those three rooms.
2. Keep the saved `SWITCH_BASE_URL`, `SWITCH_AGENT_ID`, and `SWITCH_AGENT_API_KEY` for the standalone registration. Fill `SWITCH_SOURCE_ROOM_ID` (or comma-separated `SWITCH_SOURCE_ROOM_IDS`), `SWITCH_FOUNDER_ROOM_ID`, `SWITCH_PRODUCT_ROOM_ID`, and `FOUNDER_SWITCH_SENDER_ID` from verified room/event data. `FOUNDER_SLACK_USER_ID` adds a native Slack ID check when the bridge exposes it. Sales and Support rooms are needed only if those categories are enabled.
3. The provided demo Product Doc ID is already in local `.env`. `GOOGLE_DOC_PUBLIC_EXPORT=true` reads this publicly shared document through its text export and labels the result `public_export`. For private Docs, use a valid `GOOGLE_ACCESS_TOKEN` or a service-account JSON path in `GOOGLE_APPLICATION_CREDENTIALS`; share that **single Doc** with the service-account identity. The OAuth Docs API path has not been live tested.
4. For Revenue, configure one `GOOGLE_REVENUE_SHEET_ID` with a `Leads` tab using the columns in [Google integration](docs/GOOGLE_INTEGRATION.md). Enable `ENABLE_SHEET_WRITE=true` only after the chosen Google identity has Editor access. Read-only matching can run without writes.
5. For interactive founder decisions, create a dedicated Slack app from [`slack-founder-app-manifest.json`](slack-founder-app-manifest.json), install it in the same workspace, generate an app-level `xapp-` token with `connections:write`, and invite its bot to the private founder channel. Set `SLACK_FOUNDER_APP_TOKEN` and `SLACK_FOUNDER_BOT_TOKEN` in ignored `.env`. The existing Agent Switch app remains the room bridge. Slack Socket Mode distributes payloads across connections for one app, so the two consumers need distinct apps. Without the new tokens, founder cards still show Block Kit sections and text commands, but no buttons.
6. Start the agent with `npm run live` or `docker compose -f compose.agent.yml up -d --build founder-loop-agent`. This uses Switch's documented WebSocket protocol with `scope=all`, `filter=all`, cursor resume, and ping/pong. It never posts to a source room.

The live agent requires trustworthy native Discord guild/channel/message IDs, a trusted exact message URL, or original Slack channel ID and message `ts` resolvable through Slack `chat.getPermalink`. The published generic Switch event omits native Discord IDs in the observed event. For the one configured Discord source room, the app reads recent messages through the Discord bot API and accepts only a unique exact text, author, channel, and timestamp match; otherwise it yields `EVIDENCE_BLOCKED` and sends no normal founder card. The founder opened a live individual-message link in the Product test. The dedicated Slack app delivered live interactive controls for `FL-005` and `FL-006`.

### Telegram source room

Create a Telegram **supergroup** for customer intake. Connect a Switch Telegram bot to the standalone server with Group Privacy disabled before adding the bot. Add the bot to the supergroup, invite `founder-loop` to the resulting Switch room, and add its room ID to `SWITCH_SOURCE_ROOM_IDS` with `"telegram"` in `SWITCH_SOURCE_PLATFORMS`. See the [Switch Telegram setup guide](https://docs.switchagents.ai/switch-rooms/deploy/messaging-apps/telegram).

In the Docker deployment, the agent uses a dedicated **read-only PostgreSQL role** to look up Switch's durable native-message correlation. Configure the room's native `-100...` chat ID in `TELEGRAM_SOURCE_CHATS` and the `TELEGRAM_DB_*` settings in ignored `.env`. The bot token stays with Switch; Founder Loop does not poll Telegram or need a second bot. An optional separate evidence bot remains available as a fallback when direct database access is unavailable. Basic groups and broadcast channels are not supported as Founder Loop Telegram sources.

The database lookup requires the exact Switch message ID and the configured chat ID. If no unique correlation exists, the source remains `EVIDENCE_BLOCKED`. Telegram setup and delivery have automated coverage but have not yet been verified against a live Telegram chat.

## Safety and persistence

SQLite stores source events, their unchanged text, card evidence, category cards, immutable decisions, a delivery outbox, cursor, and audit records. A repeated source event or founder decision cannot create another card or verdict. Revenue groups messages by stable platform user ID and buying topic; display-name-only matches remain `possibly_existing`. On founder ACCEPT, a configured Sheet write re-reads by stable lead ID before append/update. If it fails, `SHEET_WRITE_FAILED` remains visible and the Sales verdict waits for a successful retry. With read-only/unavailable Sheet write access, the decision notification states the limitation.

SQLite commits each decision together with its pending handoff. The agent records `CLOSED` when Switch acknowledges the verdict and queues an edit of the existing founder card. If the edit fails, the agent retries the edit without sending the verdict again.

An ambiguous post or Sheet write stays in `UNCERTAIN` until an operator checks the destination. List these deliveries from the running local container:

```sh
docker compose -f compose.agent.yml exec founder-loop-agent node src/cli.js reconcile
```

Verify the card ID in the target Slack room or the stable lead ID in the Leads Sheet. Use the same command with `KEY delivered REFERENCE` to record a verified delivery, or `KEY retry` once you have verified the post or write did not happen. For a founder card, use the original Slack message timestamp as the reference. The agent resumes queued work on its next outbox pass.

## Integration probes

```sh
node --env-file=.env scripts/probe-switch.js
node --env-file=.env scripts/probe-google.js
```

The Switch probe authenticates the socket and answers a ping; it does not prove room message delivery. The Google probe prints the configured Doc read mode and match metadata without exposing document content or credentials. See [Switch evidence](docs/SWITCH_INTEGRATION.md), [Google setup](docs/GOOGLE_INTEGRATION.md), and the [demo script](docs/DEMO_SCRIPT.md).
