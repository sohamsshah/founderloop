# Gate A: Product Intelligence live end-to-end checklist

Updated: 7 November 2026, 10:44 IST. This is the execution order for the **first live shippable slice**. A checked item needs observed evidence in `docs/STATUS.md` or `docs/SWITCH_INTEGRATION.md`; existing fixture tests do not satisfy live checks. Do not start Revenue live work until this gate passes.

## 0. Known starting point

- [x] Dedicated Discord `#founder-loop-source` exists; native channel ID is in ignored `.env`.
- [x] Private Slack `#founder-loop-founder` and `#founder-loop-product` exist; native channel IDs are in ignored `.env`.
- [x] The user identified `@sohamshah456` as founder, and Slack confirmed an invite to both private channels. Native Slack user ID is in ignored `.env`.
- [x] Standalone Switch 0.31.0 server and `founder-loop` custom agent authenticate. Passive WebSocket handshake works, but currently covers zero rooms.
- [x] A labeled demo Product Google Doc can be read by public text export. This is a real public export read, **not** OAuth Google Docs API or a real company roadmap.
- [x] Product fixture path and 28 automated tests pass as of the previous checkpoint.
- [ ] **Live Gate A signoff:** blocked until steps below pass.

## 1. Choose one Switch server and connect the bridges

- [x] Inspect Switch Console and the standalone server. The Console-managed Switch 0.31.0 server is running on `127.0.0.1:55571`, displays Slack and Discord messaging app connections, and is the chosen home for the Product gate. The standalone agent at `127.0.0.1:18000` belongs to a different server and cannot see Console rooms.
- [x] Keep the existing Slack app and Discord bot attached to the Console server. No second consumer has been attached to the standalone server; its bridge setup is out of this Product gate.
- [ ] Connect Slack and Discord to the chosen server using the [official Slack setup](https://docs.switchagents.ai/switch-rooms/deploy/messaging-apps/slack) and [Discord setup](https://docs.switchagents.ai/switch-rooms/deploy/messaging-apps/discord). Verify both show connected/healthy in that server's Home page. Record a sanitized screenshot or status, never tokens.
- [ ] Confirm the `founder-loop` custom agent is registered **on the same server**. If the chosen server changes, register it there and update ignored `.env` credentials. Verify authenticated agent ops and WebSocket again.

**Pass:** one authoritative server has the agent and both healthy bridges. **Stop if:** the bridges are on another server or connecting a second consumer would disrupt the current app.

## 2. Turn dedicated channels into Switch rooms

- [ ] In the connected Slack app, bring Switch into `#founder-loop-founder` and `#founder-loop-product` (Switch documents `/invite @Agent Switch` for an existing channel). Confirm each appears under **Your Rooms** on the **chosen server**. [Slack instructions](https://docs.switchagents.ai/switch-rooms/deploy/messaging-apps/slack#bring-switch-into-a-channel).
- [ ] Post one harmless human message in Discord `#founder-loop-source` after its bridge is connected; Switch documents that the first post creates its room. Confirm it appears under **Your Rooms** on the chosen server. This setup message is not the Product signal test. [Discord instructions](https://docs.switchagents.ai/switch-rooms/deploy/messaging-apps/discord#bring-switch-into-a-channel).
- [ ] Add the registered `founder-loop` agent to these **three** rooms. Confirm agent membership and passive room access. Do not invite it to unrelated customer channels.
- [ ] Read the actual Switch room IDs from the server/agent room listing and set `SWITCH_SOURCE_ROOM_ID`, `SWITCH_FOUNDER_ROOM_ID`, and `SWITCH_PRODUCT_ROOM_ID` in ignored `.env`. Keep native channel IDs in their separate variables. Record sanitized ID mapping in `docs/SWITCH_INTEGRATION.md`.
- [ ] In `#founder-loop-founder`, observe a message authored by `@sohamshah456`. Capture the trusted Switch sender ID, set `FOUNDER_SWITCH_SENDER_ID`, and verify whether Switch also supplies the native Slack user ID. Do not infer identity from display name.

**Pass:** the agent connection reports exactly the intended rooms, with correct source/founder/Product mapping and founder identity. **Stop if:** a room belongs to the other server or founder identity cannot be verified.

## 3. Make the live process Product-only

- [x] Make `npm run live` accept a Product-only configuration: require source, founder, and Product rooms but not Sales/Support rooms; set `enabledCategories` to `PRODUCT`. Automated tests pass; the live command now stops only on the four missing Product room/founder identity fields.
- [ ] Verify the founder authorization rule against the **actual** Slack event shape. The current code requires both Switch sender ID and native Slack user ID; if the bridge omits `platform_sender_id`, use a verified Switch identity policy rather than silently weakening authorization.
- [ ] Run `npm test` and `npm run demo:product`. Check that the labeled fixture still closes and that no fixture link is described as live.
- [ ] Run `npm run live` with ignored `.env`. Confirm WebSocket `connection_state` lists the three mapped rooms and `filter=all`; watch only sanitized event/status logs. Do not print bot tokens, private message bodies, or agent keys.

**Pass:** the Product-only agent stays connected and can receive unaddressed source events; Sales/Support are unnecessary for this gate.

## 4. Verify silent source capture and exact citation

- [ ] Have a human post one ordinary, unmentioned Product request in Discord `#founder-loop-source`. Use a unique, harmless request whose exact text can be checked against the card and Doc; avoid the setup message. Record the actual Discord message URL and time as test evidence.
- [ ] Observe an inbound Switch `message` event for the correct source room. Record a **sanitized field-name/sample-shape** showing original text, Switch sender/message IDs, native Discord guild/channel/message IDs (or a trusted exact URL), timestamp, and addressed flag. Do not treat a Switch message ID as a Discord message ID.
- [ ] Verify the bot produces **no reply, reaction, thread, or typing indicator** in the Discord source channel. Check through Discord, not only through source-code inspection.
- [ ] Resolve an individual-message permalink from trusted native IDs. Open it using the founder's Discord access. Compare the original author, channel, timestamp, and **verbatim text** with the stored event. If native IDs are absent or the founder cannot open the link, record `EVIDENCE_BLOCKED` and **do not send an actionable founder card**.

**Pass:** one real, unmentioned message is captured silently and its exact-message citation is founder-accessible. This is the critical Gate 0/first Gate A release blocker.

## 5. Verify Product enrichment and founder card

- [ ] Read the configured named Google Doc using the chosen access path. Record the returned title, matching section, exact excerpt, direct Doc URL, and access mode (`public_export` or authenticated Docs API). Do not call `public_export` an OAuth API integration or treat demo content as a real roadmap.
- [ ] Inspect the Product classification and Doc comparison for the real request. Confirm the AI assessment is separate from the original quote and that Doc facts are quoted exactly. If the Doc is unavailable, the card must say so rather than fabricate support or roadmap status.
- [ ] Observe **one** Product card in private Slack `#founder-loop-founder`. Confirm card ID, category, verbatim original quote, source platform/channel/author/time, clickable exact-message URL, Google Doc context/link, separate assessment, and `ACCEPT / REJECT / COMMENT` command text. Open the source link from the card as the founder.
- [ ] Check that no card appeared in a source/customer channel and that the bot did not write there.

**Pass:** the real card contains independently checked source and Doc citations and reached only the founder room.

## 6. Verify founder decision, one internal verdict, and CLOSED

- [ ] From `@sohamshah456` in `#founder-loop-founder`, send `FL-<actual card ID> ACCEPT` (or one chosen final verdict). Use the real card ID; do not assume `FL-001`.
- [ ] Observe that the decision was accepted from the verified founder Switch sender and authorized room. Inspect the immutable decision record and outbox state without exposing credentials or private message bodies.
- [ ] Observe **exactly one** notification in `#founder-loop-product`, containing the verdict, same card ID, short **verbatim** original excerpt, and the **same exact-message permalink**. Confirm no notification in Sales, Support, or source channel.
- [ ] Confirm the Product card is `CLOSED` only after the internal Slack post received a positive delivery result. If transport is ambiguous, keep it `DELIVERY_UNCERTAIN` and reconcile before retrying; do not claim CLOSED.
- [ ] Re-send the same founder command and replay the source event. Verify there is still one founder card, one immutable decision, and one Product notification.

**Pass:** real customer message → Switch → Google Doc → cited founder card → authorized founder decision → one Product Slack verdict → `CLOSED`.

## 7. Negative checks and release proof

- [ ] Test a non-Product/noise message: no founder card.
- [ ] Test missing or malformed native source IDs: `EVIDENCE_BLOCKED`, no actionable card and no invented URL.
- [ ] Test unauthorized actor/wrong room using a safe test identity or mocked event: no decision and no Product notification.
- [ ] Test a duplicate event/decision, Google unavailable, and definitive versus ambiguous outbound failure with automated tests. Preserve literal original punctuation/line breaks in quote tests.
- [ ] Run the Product test suite and capture command/result. Capture a short sanitized live walkthrough or screenshots: source message, exact link opened, Doc context, founder card, founder decision, Product verdict, and CLOSED state. Mark each integration mode truthfully.
- [ ] Update `docs/STATUS.md`, `docs/SWITCH_INTEGRATION.md`, and `TASKS.md` with actual observed IDs/shapes, evidence, pass/fail, and remaining limitations. Commit a known-good Product-only checkpoint. Only then mark **CHECKPOINT A PASS** and consider Revenue live work.

## Human actions remaining

The bot/channel credentials and native channel IDs are already local. The founder will need to post one **ordinary human** Discord test message, open its exact-message link from their own account, and send one Slack decision from `@sohamshah456`. Codex can perform the setup, run the agent, inspect logs and persisted state, and update proof. If the chosen Switch server requires account linking or admin sign-in in Console, the founder may need to complete that interactive step.
