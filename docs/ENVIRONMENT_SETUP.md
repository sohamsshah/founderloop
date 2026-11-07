# Founder Loop environment setup

Updated 7 November 2026, 14:40 IST. The Product live technical journey passed on the standalone Docker server. With founder approval, the Console-managed server was stopped and its Slack/Discord bot credentials were connected to standalone. Do not restart the Console-managed server while standalone is using the same tokens.

## Already configured and checked

- This folder is an independent Git repository. The local `.env`, `.switch/`, `secrets/`, `data/`, and `node_modules/` are ignored.
- Node.js 22 and Docker Compose are available. An isolated `founderloop-switch` Compose project runs Switch 0.31.0 with its API at `http://127.0.0.1:18000` and Gateway at `http://127.0.0.1:13000`, both on loopback. Health checks returned HTTP 200.
- The `founder-loop` custom agent was registered on that server. Its private ID and API key are in the ignored `.env`; its registration key remains in the ignored `.switch/standalone/` area. Authenticated agent operations and a passive WebSocket handshake passed. The socket reported zero rooms, so no live message delivery was proven.
- Direct Slack bot and app-token authentication passed. Discord bot identity passed, while the guild check returned Discord code `40333` and remains unverified. These direct checks do not establish Switch bridge connectivity.
- The user-provided Google Doc was populated as a clearly labeled demo reference. A public text export read and exact excerpt match passed. This does not prove private Google Docs OAuth API access. No Leads Sheet is configured.
- The direct bot APIs can list the configured Slack workspace and Discord server channels. Dedicated private Slack founder/Product/Sales/Support channels and a Discord source channel were created. The user identified `@sohamshah456` as their Slack account and was invited to all four private channels. Their native channel IDs and Slack user ID are in ignored `.env`. These are not Switch room IDs.

## Finish the Product live setup

1. Use the existing `founder-loop` registration and Gateway on the standalone server (`http://127.0.0.1:18000` API, `http://127.0.0.1:13000` Gateway). Its Slack/Discord connections are active. Keep the Console-managed server stopped to avoid duplicate consumers.
2. The dedicated Discord source and private Slack founder/Product channels are mapped to three Switch rooms with the custom agent. Actual Switch room IDs are in ignored `.env`; native channel IDs are separate. Sales/Support rooms are unnecessary for Product-only live mode.
3. The founder-authored Slack event identified a stable Switch sender, recorded in ignored `.env`. The bridge omitted `platform_sender_id`; the app checks the verified Switch identity and founder room, and rejects a conflicting native ID if present.
4. The observed unmentioned Discord event omitted native IDs. The app now queries the configured Discord channel through the bot API and accepts only a unique exact text/author/channel/time match. Missing or ambiguous evidence remains `EVIDENCE_BLOCKED`.
5. The founder opened a real individual-message link, sent a COMMENT verdict, and one Product Slack notification reached CLOSED. See [Switch integration](SWITCH_INTEGRATION.md) and [status](STATUS.md). Capture a sanitized 3–5 minute walkthrough before final submission.
6. For Product Doc access, the current `.env` can read the named public demo Doc with `GOOGLE_DOC_PUBLIC_EXPORT=true`. For a private one-Doc API read, configure `GOOGLE_ACCESS_TOKEN` or a service-account JSON path under ignored `secrets/`, and share that Doc with the API identity. This path needs a live probe.
7. For Revenue, create one named Google Sheet with the `Leads` tab and columns in [Google integration](GOOGLE_INTEGRATION.md). Set `GOOGLE_REVENUE_SHEET_ID`; authorize the API identity. Enable `ENABLE_SHEET_WRITE=true` only after Editor access and an accepted-write test. Revenue and Commitment live signoff follow Gate A, in that order.

Run `npm test`, `npm run demo:product`, and `npm run demo` for offline verification. Use `node --env-file=.env scripts/probe-switch.js` and `node --env-file=.env scripts/probe-google.js` for the narrow integration probes. `npm run live` starts the passive agent only after room and identity mappings are complete. For the persistent local agent, use `docker compose -f compose.agent.yml up -d --build founder-loop-agent`; it connects to the existing standalone Switch Docker network and uses ignored `.env` and SQLite data.

## Interactive founder buttons

`FL-004` used Slack Block Kit sections but no buttons. The button and modal implementation passes local tests and awaits a live test. Create a second app from [`slack-founder-app-manifest.json`](../slack-founder-app-manifest.json) in the **same Slack workspace**. Install it, create an app-level token with `connections:write`, and invite its bot to private `#founder-loop-founder`. Set `SLACK_FOUNDER_APP_TOKEN=xapp-...` and `SLACK_FOUNDER_BOT_TOKEN=xoxb-...` in the ignored `.env`; never put tokens in a commit or chat. Restart the agent container with the Compose command above. A separate app is necessary because Slack may route each Socket Mode payload to any connection for one app; the existing Agent Switch app is already consumed by the Switch bridge. The new app subscribes to no channel events and only handles its own interactive cards. `SLACK_WORKSPACE_ID` is an optional extra identity check.

No secret values, live source-message IDs, or unverified permalink claims belong in committed docs or screenshots.
