# Next E2E pass

The local agent has Revenue enabled for Discord `#founder-loop-source` and Slack `#sales`, `#customer-success`, and `#support-alerts`. The two fictional Leads records are readable through the demo public export. For the staff promise case, set `COMMITMENT_STAFF_IDS` to the verified sender IDs. Support intake is `#support-alerts`, founder decisions go to `#founder-loop-founder`, and Support verdicts go to `#founder-loop-support`.

| Flow | Posts that should stay quiet | One card to close |
| --- | --- | --- |
| Product | Casual feedback, a shipped feature, or a matching roadmap item on hold | Post `Could Product add a webhook for workspace anniversaries?` in Discord to review a new request, or enable a roadmap revision and post a matching request with a follow-up. Accept and check the Product verdict. |
| Revenue | Generic pricing inquiry or a routine update for a held account | In `#customer-success`, post a severe renewal risk such as `Churn rate super high for Northwind`. Confirm the exact Slack link and matched Sheet figures. Accept and check one verdict in private `#founder-loop-sales`. If an existing card already covers that account revision, use it to demonstrate grouping. |
| Commitment | Routine support request, planned maintenance, or a promise without customer impact or timing | Post `Image preview worker unreachable.` in Slack `#support-alerts` or Discord `#founder-loop-source`. Check that the founder card is titled “Reported incident” and links to the original message. Decide and confirm one verdict in `#founder-loop-support`. |
| General | Casual mentions of the founder | Post `I want to set up a meeting with the founder.` in an enabled intake channel. Confirm the General card and its exact source link. Accept and check that the verdict stays in `#founder-loop-founder`. |

For each card, confirm the source link opens the exact original, a repeat does not create another card, and the buttons disappear after the verdict posts. Record any unexpected card or delivery before moving on.
