# Google context integration

## Product: one named Google Doc

The user supplied [Founder Loop Product Intelligence — Demo Reference](https://docs.google.com/document/d/1Yy15hB0JMrwkmsyme_m1kVMatEm70vNOWyQ7D23RS8Q/edit) and authorized filling it. It now contains labeled demo product context: overview, local features, limitations, Now/Next/Later roadmap, and engineering constraints. The document explicitly says it is **demo reference material**, not a verified roadmap for another company.

The app can read this named Doc by either:

1. **OAuth Docs API:** `GOOGLE_PRODUCT_DOC_ID` plus `GOOGLE_ACCESS_TOKEN`, or `GOOGLE_APPLICATION_CREDENTIALS` pointing to an ignored service-account JSON file shared on the Doc. `src/google-auth.js` mints short-lived tokens using Google's documented service-account JWT flow. `documents.get?includeTabsContent=true` reads tabs and exact paragraph text. This path is implemented with mocked tests but **not yet live verified**.
2. **Public text export:** `GOOGLE_DOC_PUBLIC_EXPORT=true` only for a Doc intentionally accessible via link. The user-supplied demo Doc returned HTTP 200 from its text export. On 7 November, `scripts/probe-google.js` read 16 nonempty lines and found the exact sentence about scheduled exports, correctly marking it `not_planned`. Cards label the source mode `public_export`, so it cannot be mistaken for an OAuth API read. This path depends on the Doc's current public sharing and Google's export behavior; use OAuth for private production Docs.

The Doc link and exact excerpt supplement the customer message citation. They never replace the exact-message source link. If Doc access fails, the card says product knowledge is unavailable; it does not invent roadmap facts. The offline demo uses [`fixtures/product-doc.json`](../fixtures/product-doc.json), labeled simulated and separate from the user-supplied Doc.

Official references: [Docs `documents.get`](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/get), [working with tabs](https://developers.google.com/workspace/docs/api/how-tos/tabs), [service-account OAuth](https://developers.google.com/identity/protocols/oauth2/service-account).

## Revenue: one Leads Google Sheet

No live Leads Sheet has been supplied or tested. The implemented adapter reads only `GOOGLE_REVENUE_SHEET_ID`, tab `Leads`, columns A:K:

`lead_id | company | contact_name | platform | platform_user_id | email_if_supplied | source_ref | buying_signal | stage | notes | updated_at`

It returns `existing` only for a stable platform user ID or explicitly supplied exact email. A matching display name alone yields `possibly_existing`; unavailable Sheet access yields `unknown`, never `new`. The fixture sheet is empty and visibly simulated.

If `ENABLE_SHEET_WRITE=true` and the founder ACCEPTS, the app re-reads the Sheet by stable lead ID and updates the existing row or appends one row. A failed write records `SHEET_WRITE_FAILED` and the Sales verdict waits for retry. REJECT and COMMENT do not write. If writes are disabled, an accepted Sales verdict can still be posted, with `SHEET WRITE: UNAVAILABLE` in the notification. A future live test must verify API authorization, row layout, and retry behavior against a disposable test lead before claiming production correctness.

Official references: [Sheets Values get](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/get), [append](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/append), [update](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/update).

Keep Google access tokens and service-account keys out of Git and screenshots. The app does not search Drive or crawl other Docs/Sheets.
