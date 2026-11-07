# Founder Loop v3 implementation plan

## Scope and order

The v3 handoff and `TASKS.md` are authoritative. The user subsequently asked to build all three planned category workflows now and test the live channels later. The app therefore implements Product, Revenue, and Commitment behind one shared pipeline, while **live gate signoff remains sequential**: Product must pass before Revenue or Commitment is presented as a live shippable feature.

The v3 MVP has no dashboard. Founder decisions happen in Slack; React would add a separate interface outside the approved scope.

## One process

`src/cli.js` loads configuration and starts one Switch custom-agent WebSocket connection. `src/switch-connection.js` uses the documented bearer-authenticated socket with `scope=all`, `filter=all`, cursor resume, and application-level ping/pong. `src/evidence.js` normalizes and validates inbound messages. `src/loop.js` persists source events, runs the category detectors, enriches Product/Revenue, resolves citations, delivers founder cards, verifies final decisions, and drains the outbox. `src/store.js` holds the SQLite inbox, category cards, exact evidence references, immutable decisions, outbox, cursor, and audit trail.

The category modules are `src/product.js`, `src/revenue.js`, and `src/classify.js`. Product reads one named Google Doc through OAuth Docs API or a clearly labeled public text export. Revenue reads one named Leads Sheet and can write one accepted lead with read-before-append/update. Commitment has no external knowledge base or post-decision tracking. `src/google-auth.js` can mint short-lived tokens from a service-account JSON file stored outside Git.

All source channels are read only from the app's perspective. The only outbound destinations are configured Switch rooms for the private founder channel and category-specific internal Slack channels.

## Release gates

1. **Gate 0:** authenticate Switch agent WebSocket and validate passive source delivery, bridge mapping, and exact native source metadata. The authenticated WebSocket and ping/pong have passed, but no rooms are mapped yet.
2. **Gate A Product:** prove unmentioned Discord → exact citation → one Google Doc → founder Slack card → authorized decision → internal Product Slack verdict → CLOSED. The fixture pipeline passes; live proof awaits room mapping and exact source IDs.
3. **Gate B Revenue:** preserve Gate A, prove one Sheet read and safe lead match, then founder verdict to Sales. ACCEPT writes to Sheet only when enabled and authorized. Offline tests pass; live Sheet and room are absent.
4. **Gate C Commitment:** preserve previous gates, distinguish issue from explicit promise and route the verdict to Support. Offline tests pass; live room is absent.
5. **Gate D:** replay, authorization, failure, exact-link, and integration evidence checks; demo packaging; sign off only the last complete live gate.

## Demo and verification

- `npm test`: automated category, evidence, storage, retry, and transport-contract checks.
- `npm run demo:product`: Product-only simulated release checkpoint.
- `npm run demo`: all-category simulated walkthrough.
- `node --env-file=.env scripts/probe-switch.js`: authenticated Switch connection-state and ping/pong probe. It does not prove room delivery.
- `node --env-file=.env scripts/probe-google.js`: one configured Doc read probe, printing only mode and match metadata.

The `fixture://` links are deliberately synthetic and never treated as live exact-message URLs. A live card is blocked if trustworthy native IDs or a platform-provided exact link are absent. Any claimed live shippable gate requires a founder-accessible exact-message click check and observed Slack handoff.
