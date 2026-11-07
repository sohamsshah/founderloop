# Google context integration

## Product: one named Google Doc

The user supplied [Founder Loop Product Intelligence — Demo Reference](https://docs.google.com/document/d/1Yy15hB0JMrwkmsyme_m1kVMatEm70vNOWyQ7D23RS8Q/edit) and authorized filling it. It now contains labeled demo product context: overview, local features, limitations, Now/Next/Later roadmap, and engineering constraints. The document explicitly says it is **demo reference material**, not a verified roadmap for another company.

The app can read this named Doc by either:

1. **OAuth Docs API:** `GOOGLE_PRODUCT_DOC_ID` plus `GOOGLE_ACCESS_TOKEN`, or `GOOGLE_APPLICATION_CREDENTIALS` pointing to an ignored service-account JSON file shared on the Doc. `src/google-auth.js` mints short-lived tokens using Google's documented service-account JWT flow. `documents.get?includeTabsContent=true` reads tabs and exact paragraph text.
2. **Public text export:** `GOOGLE_DOC_PUBLIC_EXPORT=true` only for a Doc intentionally accessible via link. The user-supplied demo Doc returned HTTP 200 from its text export. On 7 November, `scripts/probe-google.js` read 16 nonempty lines and found the exact sentence about scheduled exports, correctly marking it `not_planned`. Cards label the source mode `public_export`, so it cannot be mistaken for an OAuth API read. This path depends on the Doc's current public sharing and Google's export behavior; use OAuth for private production Docs.

The Doc now includes a **Product roadmap and founder decisions** section. Keep one plain text paragraph per item in this format:

```text
ROADMAP | scheduled-exports | 1 | scheduled exports; schedule exports | proposed | Product | TBD | founder_review | Should we approve a scoped pilot?
```

Use a stable item ID, a positive revision number, aliases separated by semicolons, a status, an owner, a deadline (`YYYY-MM-DD` or `TBD`), an action, and a specific decision question. Use `hold` for routine work or items with no open question. Eligible review statuses are `proposed`, `blocked`, `planned`, and `in_progress`. `shipped`, `deferred`, and `declined` stay out of the founder channel. A request must match exactly one row by alias. Unknown, ambiguous, and unavailable roadmap matches are held. One card is created per item and revision, and subsequent messages attach as evidence. Increment the revision when there is a new decision to make. Dates are context for the decision.

The sample rows in the live Doc are on hold. Replace the demo owners and dates with approved data before using the Doc for real decisions. The offline fixture has one simulated review item.

Official references: [Docs `documents.get`](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/get), [working with tabs](https://developers.google.com/workspace/docs/api/how-tos/tabs), [service-account OAuth](https://developers.google.com/identity/protocols/oauth2/service-account).

## Revenue: one Leads Google Sheet

The supplied [FounderLoopRevenue workbook](https://docs.google.com/spreadsheets/d/1nGPrIAhUYGyQH0gY7Cv0nx6_BXdwLJuIttKRGUXzrak/edit) contains a `Leads` tab with two fictional demo rows. Set `GOOGLE_REVENUE_PUBLIC_EXPORT=true` for this public demo. Cards label the read mode `public_export`.

For actual records, set General access to Restricted and disable public export. Share the workbook as Viewer with the Revenue service account and enable the Google Sheets API for its Cloud project. Keep the service-account JSON in ignored `secrets/revenue-reader.json`. Set `GOOGLE_REVENUE_CREDENTIALS=/run/founder-loop-secrets/revenue-reader.json` for Docker. For a host-side read probe, set the same variable to the absolute host path and run `node --env-file=.env scripts/probe-google.js revenue`.

`lead_id | company | contact_name | platform | platform_user_id | email_if_supplied | source_ref | buying_signal | stage | notes | updated_at | owner | currency | opportunity_value | current_mrr | renewal_date | next_step | decision_status | decision_revision | decision_question`

Use one stable `lead_id` per opportunity or account decision record. Record deal value and current monthly recurring revenue separately and include a three-letter currency code. Use `YYYY-MM-DD` for renewal dates. Keep `decision_status` on `hold` for routine work. For a founder decision, set it to `founder_review`, add a positive integer revision, and write the question. Increment the revision for a new decision. Keep the header row intact.

Map the existing Discord source to `discord`, Slack Sales to `sales`, and Slack Customer Success and Support Alerts to `csm` in `REVENUE_SOURCES`. The room category map can keep Product in Discord and Commitment in Support Alerts. Invite the Switch bridge bot to Sales and Customer Success, connect both as Switch rooms, and set the Slack native channel map for exact citations. A strong Discord buying request can surface as an untracked prospect. For a known Discord prospect use the native Discord user ID.

Internal Slack signals can match a unique company name or an explicit lead ID. An urgent renewal risk, commercial deadline requiring approval, or explicit request for a founder decision can open a card even when the account is unmatched or the Sheet is on hold. The card shows the original message and includes account figures only when one row matches. A known record opens one card per decision revision. Routine updates follow the Sheet review gate. Forwarded email is a separate integration.

The agent reads this extended schema and sends one verdict to the private Sales destination. Sales and CSM maintain the Sheet. The earlier optional write path applies only to legacy A:K integrations with explicit write access.

Official references: [Sheets Values get](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/get), [append](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/append), [update](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/update).

Keep Google access tokens and service-account keys out of Git and screenshots. The app does not search Drive or crawl other Docs/Sheets.
