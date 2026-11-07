# Founder Loop demo script

## Repeatable offline walkthrough (3–5 minutes)

1. State: “This is a simulated message replay through the same app pipeline. The `fixture://` markers are not live Discord permalinks, and the printed posts are not actual Slack messages.”
2. Run `npm test` and show the final passing count. Run `npm run demo:product` first to preserve the independently demoable Product slice. Point out the unchanged original customer sentence, separate heuristic assessment, simulated Doc excerpt, ACCEPT command, one Product verdict, and CLOSED state.
3. Run `npm run demo`. Show the Revenue card's Sheet status and Sales verdict, then the Commitment issue card and Support verdict. One support source also yields a Product card, proving separate category routes without merging quotes.
4. Open `docs/STATUS.md`. Explain the actual live Product proof: unmentioned Discord message, exact Discord API citation opened by the founder, demo Doc `public_export`, one private founder Slack message, founder COMMENT, one Product verdict, and CLOSED. State that Revenue/Commitment, private Docs API, Leads Sheet, and always-on hosting remain unverified.
5. Show the negative tests: missing native IDs block a card, unauthorized founder commands do not route, replay does not duplicate, and ambiguous outbound delivery is held for reconciliation.

## Live sequence after setup

1. In a mapped Discord source channel, post an ordinary message without mentioning the bot. Observe that it produces no reply, reaction, or typing indicator.
2. Inspect the sanitized Switch event. The observed event omits native Discord IDs. The bot API must find exactly one message matching text, author, configured channel, and time, then construct the individual-message permalink. If no unique match exists, show `EVIDENCE_BLOCKED` and stop the live card claim. Open the resulting exact-message link as the founder.
3. Compare Product context with the named Google Doc. Describe its mode accurately: `public_export` for the demo Doc or `live` for an authenticated Docs API read.
4. In the private Slack founder room, open the exact source link. If the dedicated founder Slack app is connected, click Accept or Reject, or click Comment and submit the input modal, from the configured founder account. Otherwise use the actual card ID shown in the live founder message, for example `FL-<actual ID> ACCEPT`, `FL-<actual ID> REJECT`, or `FL-<actual ID> COMMENT <text>`. Show one Product notification, same exact source link, and CLOSED. Label the button/modal route live only after its click is observed.
5. Replay the source event and founder command; show no additional notification. Only then sign off live Gate A. Repeat Revenue and Commitment with their own Sheet/channel evidence.

Do not capture secrets or private message bodies in screenshots. Do not call any fixture integration “live.”
