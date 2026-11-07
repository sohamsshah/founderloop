# Gate A: Product Intelligence live end-to-end checklist

Updated: 7 November 2026, 15:05 IST. The core Product live journey passed with a demo Google Doc public export. `FL-004` delivered a visual Block Kit layout and CLOSED on a text REJECT. A dedicated Slack app then handled a live Accept button on `FL-005` and Comment modal on `FL-006`; both closed with one Product verdict. A checked item needs observed evidence in `docs/STATUS.md` or `docs/SWITCH_INTEGRATION.md`.

## 0. Known starting point

- [x] Dedicated Discord `#founder-loop-source` exists; native channel ID is in ignored `.env`.
- [x] Private Slack `#founder-loop-founder` and `#founder-loop-product` exist; native channel IDs are in ignored `.env`.
- [x] The user identified `@sohamshah456` as founder, and Slack confirmed an invite to both private channels. Native Slack user ID is in ignored `.env`.
- [x] Standalone Switch 0.31.0 server and `founder-loop` custom agent authenticate. The live connection covers source and founder rooms; the Product destination is mapped and the agent is a member.
- [x] A labeled demo Product Google Doc can be read by public text export. This is a real public export read, **not** OAuth Google Docs API or a real company roadmap.
- [x] Product fixture, interactive action, and closed-card rendering paths pass 40 automated tests as of the 7 November 15:15 IST retest.
- [x] **Live Gate A technical journey:** fresh Discord source through one Product Slack verdict and CLOSED, with founder-opened exact link. Release capture and always-on hosting remain.

## 1. Choose one Switch server and connect the bridges

- [x] Inspect both servers. The Console-managed server at `127.0.0.1:55571` displays Slack and Discord connections but has no accessible Gateway registration-key UI for the external agent. The standalone server at `127.0.0.1:18000` hosts the registered agent, and its Gateway at `127.0.0.1:13000` responds HTTP 200. The standalone server is now the planned Product gate home.
- [x] The founder changed the initial separate-test-app choice and explicitly authorized stopping the Console-managed server and reusing its current Slack/Discord tokens. Console was stopped and verified unavailable before standalone connections were created.
- [x] Standalone Gateway reported Slack and Discord connections `active`. Keep Console stopped while standalone uses those tokens.
- [x] The `founder-loop` custom agent is registered on standalone. Authenticated agent ops and passive WebSocket ping/pong were observed there; rerun the probe after room mapping.

**Pass:** one authoritative server has the agent and both healthy bridges. **Stop if:** the bridges are on another server or connecting a second consumer would disrupt the current app.

## 2. Turn dedicated channels into Switch rooms

- [x] Adopted existing private Slack founder/Product channels and Discord source channel as three rooms through standalone Gateway's room API.
- [x] Added the registered `founder-loop` agent to those three rooms and confirmed membership. The live socket claims source/founder; Product is the outbound destination.
- [x] Recorded actual Switch room IDs in ignored `.env`, separate from native channel IDs.
- [x] Observed a founder-authored Slack event, matched its native Slack user ID through the bridge mapping, and recorded the stable Switch sender in ignored `.env`. The event omitted `platform_sender_id`.

**Pass:** the agent connection reports exactly the intended rooms, with correct source/founder/Product mapping and founder identity. **Stop if:** a room belongs to the other server or founder identity cannot be verified.

## 3. Make the live process Product-only

- [x] Make `npm run live` accept a Product-only configuration: require source, founder, and Product rooms but not Sales/Support rooms; set `enabledCategories` to `PRODUCT`. Automated tests pass; the live command now stops only on the four missing Product room/founder identity fields.
- [x] Verified the actual Slack event omits `platform_sender_id`. Authorization now requires the verified Switch sender and founder room, and rejects a conflicting native ID when one is supplied.
- [ ] Run `npm test` and `npm run demo:product`. Check that the labeled fixture still closes and that no fixture link is described as live.
- [x] Ran `npm run live` with ignored `.env`; `connection_state` covered source and founder rooms with `filter=all`. The Product room is mapped for outbound posts.

**Pass:** the Product-only agent stays connected and can receive unaddressed source events; Sales/Support are unnecessary for this gate.

## 4. Verify silent source capture and exact citation

- [x] The founder posted a fresh ordinary, unmentioned Product request in Discord. The live agent received it and stored the exact text.
- [x] Sanitized Switch event shape and missing native ID fields are recorded in `docs/SWITCH_INTEGRATION.md`. The Discord bot API supplied a unique exact text/author/channel/time match and numeric native IDs; Switch's message ID was never treated as a native ID.
- [x] Direct Discord read found no bot reply or reaction near the source message. No thread was generated. Transient typing indicator remains unverified retrospectively.
- [x] Resolved the individual-message permalink and the founder reported opening the exact source post from Slack. The first event without native IDs was correctly held `EVIDENCE_BLOCKED` before the resolver was added.

**Pass:** one real, unmentioned message is captured silently and its exact-message citation is founder-accessible. This is the critical Gate 0/first Gate A release blocker.

## 5. Verify Product enrichment and founder card

- [ ] Read the configured named Google Doc using the chosen access path. Record the returned title, matching section, exact excerpt, direct Doc URL, and access mode (`public_export` or authenticated Docs API). Do not call `public_export` an OAuth API integration or treat demo content as a real roadmap.
- [ ] Inspect the Product classification and Doc comparison for the real request. Confirm the AI assessment is separate from the original quote and that Doc facts are quoted exactly. If the Doc is unavailable, the card must say so rather than fabricate support or roadmap status.
- [ ] Observe **one** Product card in private Slack `#founder-loop-founder`. Confirm card ID, category, verbatim original quote, source platform/channel/author/time, clickable exact-message URL, Google Doc context/link, separate assessment, and `ACCEPT / REJECT / COMMENT` command text. Open the source link from the card as the founder.
- [ ] Check that no card appeared in a source/customer channel and that the bot did not write there.

**Pass:** the real card contains independently checked source and Doc citations and reached only the founder room.

## 6. Verify founder decision, one internal verdict, and CLOSED

- [x] From `@sohamshah456` in the founder room, sent a final `FL-003 COMMENT <text>` verdict. `FL-002` separately tested ACCEPT after a classifier replay.
- [x] SQLite confirmed one decision from the verified founder Switch sender and authorized room; both outbox entries were acknowledged.
- [x] Direct Slack read confirmed exactly one Product COMMENT notification with the same exact-message link and verbatim original excerpt; none appeared in Sales or Support. Discord source remained silent.
- [x] The Product card reached `CLOSED` after the internal post received a positive delivery result.
- [x] Replaying the source returned `DUPLICATE` and repeating the decision returned `ALREADY_DECIDED`; one founder message, one decision, and one Product notification remained.

**Pass:** real customer message → Switch → Google Doc → cited founder card → authorized founder decision → one Product Slack verdict → `CLOSED`.

## 7. Negative checks and release proof

- [ ] Test a non-Product/noise message: no founder card.
- [ ] Test missing or malformed native source IDs: `EVIDENCE_BLOCKED`, no actionable card and no invented URL.
- [ ] Test unauthorized actor/wrong room using a safe test identity or mocked event: no decision and no Product notification.
- [ ] Test a duplicate event/decision, Google unavailable, and definitive versus ambiguous outbound failure with automated tests. Preserve literal original punctuation/line breaks in quote tests.
- [ ] Run the Product test suite and capture command/result. Capture a short sanitized live walkthrough or screenshots: source message, exact link opened, Doc context, founder card, founder decision, Product verdict, and CLOSED state. Mark each integration mode truthfully.
- [ ] Update `docs/STATUS.md`, `docs/SWITCH_INTEGRATION.md`, and `TASKS.md` with actual observed IDs/shapes, evidence, pass/fail, and remaining limitations. Commit a known-good Product-only checkpoint. Only then mark **CHECKPOINT A PASS** and consider Revenue live work.

## Human actions remaining

The dedicated Slack founder app is installed and its credentials are in ignored `.env`; the existing Agent Switch Slack app remains the Switch room bridge. Live `FL-005` Accept and `FL-006` Comment actions passed with one Product verdict each. The founder confirmed buttons and the `FL-005` exact source link. Closed `FL-005`–`FL-007` cards were updated manually; a fresh `FL-008` Accept action automatically removed buttons and displayed the completion message, confirmed by direct Slack history and the founder's “done” response. Remaining release proof: a sanitized walkthrough or screenshots for the submission. The founder chose to skip the live Reject button test.
