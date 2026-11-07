# Founder Loop

Founder Loop silently turns ordinary messages in authorized Discord and Slack rooms into evidence-backed founder decisions. One Switch custom agent receives room events, preserves the original text, requires an exact-message link, and posts a private founder card. The founder can accept, reject, or comment. Founder Loop routes one verdict to the appropriate private Slack channel and closes the card.

**Hackathon release** — Product, Revenue, Commitment, and General each completed a live workflow on local standalone Switch. Product consults a demo Google Doc, Revenue reads a demo Leads Sheet, Commitment surfaces incidents, and General handles founder follow-up requests. See the [submission summary](docs/SUBMISSION.md), [demo script](docs/DEMO_SCRIPT.md), and [live evidence](docs/STATUS.md).

## Run locally

Use the tested Node.js version, 22.22.0.

```sh
npm ci
npm test
npm run demo:product
npm run demo
```

`demo:product` closes one Product card and prints two simulated posts. `demo` closes one card per category and prints eight simulated posts. Both commands run without `.env`, Switch, messaging accounts, or Google credentials. **SIMULATED FIXTURE** output uses `fixture://` citation markers and prints cards and verdicts to the terminal. The [live setup guide](docs/ENVIRONMENT_SETUP.md) covers connecting your own accounts.

Enable `GENERAL` in `FOUNDER_LOOP_ENABLED_CATEGORIES` and in the desired `SWITCH_SOURCE_CATEGORIES` entries to surface requests for the founder to meet, reply, review, or act. General is the fallback when a specialist card does not cover the request. Its verdict stays in the private founder room.

Commitment surfaces reports of outages, broken functionality, and suspected compromise, including short messages about unfamiliar components. The fixture demo uses local rules.

## Live configuration

This folder is its own Git repository. Keep credentials in the ignored `.env` file and any service-account JSON under ignored `secrets/`. Use [`.env.example`](.env.example) as the field reference. The Product test runs on the standalone Switch server with Gateway at `http://127.0.0.1:13000`. With the founder's approval, the Console-managed server was stopped and its Slack/Discord tokens were connected to standalone. Do not restart the Console-managed server while standalone uses those tokens. Product room IDs and the verified founder Switch identity are in ignored `.env`.

1. Use the existing **standalone** Switch server and agent. Before moving the Slack and Discord connectors, stop their current Console-server consumer or use separate test app credentials; never run two consumers on the same tokens. Connect Slack and Discord to the standalone server through its Gateway/Console connection, verify both bridges, and map the dedicated Discord source and private Slack founder/Product channels into Switch rooms. Invite the agent to those three rooms.
2. Keep the saved `SWITCH_BASE_URL`, `SWITCH_AGENT_ID`, and `SWITCH_AGENT_API_KEY` for the standalone registration. Fill `SWITCH_SOURCE_ROOM_ID` (or comma-separated `SWITCH_SOURCE_ROOM_IDS`), `SWITCH_FOUNDER_ROOM_ID`, `SWITCH_PRODUCT_ROOM_ID`, and `FOUNDER_SWITCH_SENDER_ID` from verified room/event data. `FOUNDER_SLACK_USER_ID` adds a native Slack ID check when the bridge exposes it. Sales and Support rooms are needed only if those categories are enabled.
3. Set `GOOGLE_PRODUCT_DOC_ID` to the Product reference. `GOOGLE_DOC_PUBLIC_EXPORT=true` reads the shared demo document through its text export and labels the result `public_export`. See [Google integration](docs/GOOGLE_INTEGRATION.md) for the roadmap format.
4. For Revenue, configure one `GOOGLE_REVENUE_SHEET_ID` with a `Leads` tab using the extended columns in [Google integration](docs/GOOGLE_INTEGRATION.md). The agent reads the Sheet for account context and sends the verdict to Sales. Keep `ENABLE_SHEET_WRITE=false` for the extended schema.
5. For interactive founder decisions, create a dedicated Slack app from [`slack-founder-app-manifest.json`](slack-founder-app-manifest.json), install it in the same workspace, generate an app-level `xapp-` token with `connections:write`, and invite its bot to the private founder channel. Set `SLACK_FOUNDER_APP_TOKEN` and `SLACK_FOUNDER_BOT_TOKEN` in ignored `.env`. The existing Agent Switch app remains the room bridge. Slack Socket Mode distributes payloads across connections for one app, so the two consumers need distinct apps. Without the new tokens, founder cards still show Block Kit sections and text commands, but no buttons.
6. Start the agent with `npm run live` or `docker compose -f compose.agent.yml up -d --build founder-loop-agent`. This uses Switch's documented WebSocket protocol with `scope=all`, `filter=all`, cursor resume, and ping/pong. It never posts to a source room.

The live agent requires trustworthy native Discord guild/channel/message IDs, a trusted exact message URL, or original Slack channel ID and message `ts` resolvable through Slack `chat.getPermalink`. The published generic Switch event omits native Discord IDs in the observed event. For the one configured Discord source room, the app reads recent messages through the Discord bot API and accepts only a unique exact text, author, channel, and timestamp match; otherwise it yields `EVIDENCE_BLOCKED` and sends no normal founder card. The founder opened a live individual-message link in the Product test. The dedicated Slack app delivered live interactive controls for `FL-005` and `FL-006`.

## Safety and persistence

SQLite stores source events, their unchanged text, card evidence, category cards, immutable decisions, a delivery outbox, cursor, and audit records. A repeated source event or founder decision cannot create another card or verdict. Product groups signals by roadmap item and revision. Revenue groups matched signals by lead and decision revision. A unique internal account mention can supply verified Sheet context, while ambiguous matches omit account figures. Urgent internal renewal risks and commercial approvals can reach the founder even when the Sheet holds the account or lacks a match.

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
