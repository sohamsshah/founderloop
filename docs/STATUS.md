# Founder Loop v3 status

Updated: 7 November 2026, 10:33 IST.

The user authorized building all three category workflows now and deferring the live channel test. This implementation is a structured Node.js app with a single Switch agent process; the v3 specification excludes a standalone dashboard, so there is no React UI. **No live gate is signed off.** The release remains the last fully proven scope, currently the labeled fixture demo.

| Gate | Code and offline proof | Live release proof |
| --- | --- | --- |
| Gate 0 | PASS: separate repo, ignored secrets, SQLite foundation, Switch custom agent and WebSocket client. | BLOCKED: no mapped source/founder/internal rooms; no unmentioned Discord event or source-silence observation. |
| Gate A Product | PASS: Product-only fixture end to end, exact fixture quote, Doc adapter, founder ACCEPT/REJECT/COMMENT, one Product verdict, CLOSED. | BLOCKED: no verified native Discord IDs, founder-accessible exact permalink, Slack card/verdict, or Google Docs API read through the agent. |
| Gate B Revenue | PASS: Sheet adapter and match rules, stable lead grouping, accepted-write path with failure/retry, Sales verdict, CLOSED in fixtures/mocks. Product regression green. | BLOCKED: no actual Leads Sheet or Sales room; no live lead read/write or Slack verdict. |
| Gate C Commitment | PASS: issue versus explicit promise classification, founder verdict, Support route, CLOSED in fixtures. Product and Revenue regressions green. | BLOCKED: no Support room or live source/verdict observation. |
| Gate D Release | Partial: README, demo, integration docs, 28 automated tests passing. | BLOCKED: no live 3–5 minute capture, screenshot, or verified source link. |

## Observed integration evidence

- `npm test` on 7 November: **28/28 pass**. `npm run demo:product`: one simulated founder card, one simulated Product verdict, CLOSED. `npm run demo`: all three categories and a multi-category source run, all simulated cards CLOSED. These use `fixture://` provenance markers, not real message links. Optional structured model classification has mock coverage; no live model request was made.
- `npm run live` was attempted on 7 November and stopped at configuration validation before any network connection or posting. Missing variables were `SWITCH_SOURCE_ROOM_ID`/`SWITCH_SOURCE_ROOM_IDS`, `SWITCH_FOUNDER_ROOM_ID`, `SWITCH_PRODUCT_ROOM_ID`, `SWITCH_SALES_ROOM_ID`, `SWITCH_SUPPORT_ROOM_ID`, and `FOUNDER_SWITCH_SENDER_ID`. The existing local agent credentials were not missing.
- Standalone Switch 0.31.0 Compose API `/health` and Gateway responded HTTP 200. The custom `founder-loop` agent ID/key are in ignored local files. Authenticated `GET /agents/{id}/ops` passed earlier. On 7 November, the new `scripts/probe-switch.js` authenticated over the documented WebSocket, received `connection_state` with `filter=all`, then received `ping` and sent `pong`. It covered **zero rooms**. No passive message or outbound post was tested.
- Slack bot `auth.test` passed and its team ID matched the supplied workspace ID. Slack app token `apps.connections.open` passed. Discord bot `/users/@me` passed. Discord `/guilds/{id}` returned HTTP 403 with Discord code `40333` (`internal network error`), so guild access remains unverified. These are direct credential checks, not Switch bridge evidence.
- The user supplied an empty Google Doc and authorized filling it. It was populated with a **clearly labeled demo reference**, renamed “Founder Loop Product Intelligence — Demo Reference,” and Google Docs showed **Saved to Drive**. The Doc is configured in ignored `.env`. An unauthenticated public text export returned HTTP 200; the app's `scripts/probe-google.js` read 16 nonempty lines and matched the exports statement as `not_planned` with an exact excerpt. This is a **live read of a public Doc export**, not OAuth Google Docs API access or a real company roadmap. No Google Sheet exists in the app config.
- The source-channel silence rule is enforced in code by routing outbound only to configured founder/internal rooms. Live silence has not been observed in Discord. Switch's published generic message event does not guarantee native Discord guild/channel/message IDs or Slack channel/`ts`; missing values cause `EVIDENCE_BLOCKED` with no actionable card.
- Outbound HTTP timeouts and 5xx are `UNCERTAIN` and stop automatic retry until reconciled, because Switch's post endpoint has no verified idempotency key. Definitive failures retry from the SQLite outbox. Accepted Revenue Sheet writes re-read by stable lead ID before append/update to avoid a duplicate row on retry.

## Required next live checks

1. Confirm the Discord bot's server access and connect Discord/Slack to the **standalone** Switch server. Existing Console connections belong to a separate server.
2. Map one authorized source channel and private founder, Product, Sales, and Support Slack channels to Switch rooms. Record room IDs in ignored `.env`; invite the custom agent. Verify the founder's actual Switch sender ID, and native Slack user ID if Switch exposes it.
3. Send one ordinary unmentioned Discord message. Capture a **sanitized** event shape, prove no bot reply/reaction/typing, and verify native IDs or an exact message URL. If absent, keep `EVIDENCE_BLOCKED`; do not infer IDs from a Switch message ID.
4. Open a real card's source link as the founder, compare the quote with the original, read the configured Google Doc through the chosen access path, decide, observe one internal Slack notification, and confirm CLOSED. Repeat independently for Revenue/Commitment only after Product is proven live.
5. For a live Revenue test, supply a named Leads Sheet and read/write authorization. Test accepted write separately from read-only lookup.

The `.env`, `.switch/`, `secrets/`, SQLite data, and node_modules are Git-ignored. No secret values are recorded in these docs.
