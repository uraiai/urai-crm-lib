---
name: urai-crm-lib
description: Read and update the user's CRM (companies, contacts, deals, pipeline, interactions, worksheets, sprints, tags) and show results in the CRM app.
---

# urai-crm-lib — the CRM

```ts
import * as crm from "urai:lib/urai/urai-crm-lib";
```

Every function calls the CRM **as the signed-in user** with their session
token (from `meta.vars.session_token`). Never call the CRM with raw `fetch`.
All functions are async. All ids are strings. Timestamps are unix seconds.

**Errors.** Failures throw `crm.CrmError`, which has `.status` and `.message`. `.message` is the CRM's own explanation, so quote it to the user in plain words.

| Status | Meaning | What to do |
|---|---|---|
| 401 | session expired | ask the user to reopen the assistant; don't retry |
| 403 | not allowed for the assistant | e.g. deleting; tell the user to do it in the app |
| 404 | no such record | |
| 422 | a business rule refused it | the message says which rule, e.g. "qualify this deal before moving it to Proposal" |
| 400 | malformed input | fix the arguments |

## Find things

| Function | Returns |
|---|---|
| `search(query)` | `{ type: "company"\|"contact"\|"deal", id, title }[]` — full-text over names, emails, titles, notes, event names and tags. Start here when the user names something. |
| `listContacts({ query?, companyId?, limit=50 })` | `Contact[]`, matched on name/email/title |
| `listCompanies({ query?, limit=50 })` | `Company[]` |
| `listDeals({ query?, stage?, open?, companyId?, contactId?, dealType?, limit=50 })` | `Deal[]`. `stage` takes one stage or an array; `open: true` means active stages only |
| `getContact(id)` / `getCompany(id)` / `getDeal(id)` | the record |
| `listInteractions(dealId)` | `Interaction[]`, newest first |
| `recentActivity(limit=20)` | the team's latest interactions |
| `getWorksheet(dealId)` | `Worksheet \| null` |

## Change things

Confirm with the user first (see `confirm`). The one exception: logging an interaction they just described.

| Function | Notes |
|---|---|
| `createCompany({ name, type?: "DIRECT"\|"CHANNEL_PARTNER", businessType?, website?, notes? })` | |
| `updateCompany(id, patch)` | `null` clears a field |
| `createContact({ name, channel, source, email?, phone?, title?, companyId?, introducedByContactId?, eventName?, notes?, country?, province?, city?, linkedinUrl? })` | Source must suit the channel (`SOURCES_BY_CHANNEL`). REFERRAL needs `introducedByContactId`. `eventName` is for NETWORK/EVENT. |
| `updateContact(id, patch)` | |
| `createDeal({ name, primaryContactId, companyId?, dealType?, value?, probability?, introducedByContactId? })` | Channel, source and entry stage come from the contact: OUTBOUND → NEW, INBOUND → CONTACTED. |
| `updateDeal(id, { name?, companyId?, value?, probability?, partnerStatus? })` | Use `moveDeal` to change the stage. |
| `moveDeal(id, stage, { closeReason?, probability? })` | The pipeline rules apply; see below. |
| `logInteraction(dealId, { type, result, notes?, at? })` | `at` is a Date, an ISO string or unix seconds. It defaults to now. |
| `saveWorksheet(dealId, fields)` | Saves only the fields you pass. |
| `addDealToSprint(sprintId, dealId)` | |
| `tag(type, id, name)` / `untag(type, id, name)` | `tag` creates the tag if it doesn't exist yet. |

**You cannot** delete records, import spreadsheets or manage members. All of these return 403.

## Report

| Function | Returns |
|---|---|
| `pipelineSnapshot({ dealType? })` | `{ stages: { stage, count, value }[], weightedValue }` |
| `pipelineReport({ channel?, source?, dealType?, groupBy?: "channel"\|"source"\|"dealType" })` | `{ totals, conversion, cycle, breakdown }` |

`totals` contains `deals`, `open`, `won`, `lost`, `disqualified`, `nurture`, `winRate`, `avgDaysToWin`, `avgDaysToClose`, `weightedPipeline`, `openValue` and `openWithoutValue`. `winRate` is 0–1 or null.

**Sprints:**
- `listSprints()`
- `currentSprint()`: the sprint whose dates include today, or `null`.
- `sprintDashboard(sprintId)`: `{ sprint, deals, rows, actualInteractions }`.

## Show things in the chat

| Function | Shows |
|---|---|
| `showDeal(dealOrId)` | a deal card, with company and contact names |
| `showContact(contactOrId)` | a contact card |
| `showPipeline(snapshot?, title?)` | stage counts with bars and the weighted value |
| `confirm(summary, details?, confirmLabel?)` | Go ahead / Cancel buttons. The user's click arrives as the next message: exactly `"Yes, go ahead."` or `"No, don't do that."`. |
| `navigate(path)` | takes the user to an app page; `links.*` builds the paths |
| `refresh()` | reloads the page's data. Call it after any change. |

These are the paths `links` builds:
- `links.contacts()` → `/app`
- `links.companies()`
- `links.pipeline()`
- `links.dealWorksheet(dealId)`
- `links.sprints()`
- `links.sprint(sprintId)`
- `links.analytics()`
- `links.search(q)`

## Enums

- **Stages:**
  - Active, in order: `NEW`, `QUALIFIED`, `CONTACTED`, `DISCOVERY`, `DEMO`, `PROPOSAL`, `TRIAL`, `NEGOTIATION`.
  - Terminal: `CLOSED_WON`, `CLOSED_LOST`, `CLOSED_DISQUALIFIED`, `NURTURE`.
  - `STAGE_LABELS` gives the display names.
- **Close reasons:** `PRICE`, `TIMING`, `COMPETITOR`, `NO_DECISION`, `BUDGET`, `NOT_A_FIT`, `OTHER`.
- **Channel:** `INBOUND`, `OUTBOUND`.
- **Sources** (`SOURCES_BY_CHANNEL`):
  - INBOUND: `NETWORK`, `EVENT`, `LINKEDIN`, `WEBSITE`, `REFERRAL`.
  - OUTBOUND: `LINKEDIN`, `CRUNCHBASE`, `APOLLO`, `OTHER`, `NETWORK`, `EVENT`.
- **Interaction types:** `OUTREACH_SENT`, `CALL_HELD`, `FOLLOW_UP`, `DEMO`, `EMAIL`, `OTHER`.
- **Interaction results:** `RESPONSE_RECEIVED`, `NEXT_STEP_AGREED`, `NO_RESPONSE`, `OTHER`.
- **Deal type:** `DIRECT`, `PARTNER`. **Partner status:** `SIGNED`, `ENABLED`, `ACTIVATED`.

## Pipeline rules (`moveDeal`)

- Between active stages you can move forward or back.
- A deal must be qualified (it has reached QUALIFIED) before PROPOSAL, TRIAL, NEGOTIATION or CLOSED_WON.
- CLOSED_LOST and CLOSED_DISQUALIFIED need a `closeReason`. Ask the user for it.
- Re-opening:
  - NURTURE can go back to NEW or CONTACTED.
  - CLOSED_LOST can go back to NEW, but only if the reason was TIMING.
- Winning a PARTNER deal sets `partnerStatus` to SIGNED.

## Worksheet fields (`saveWorksheet`)

- **Before the call** (booleans): `prepReviewed`, `prepProblemIdentified`, `prepOutcomeDefined`, `prepQuestionsReady`.
- **Before the call** (text): `prospectName`, `icp`, `nextStepToAsk`.
- **During the call** (text): `problemDescribed`, `problemImpact`, `desiredOutcome`, `openQuestions`, `outcomeToLeadWith`, `relevantSolutionAspect`, `checkinQuestion`.
- **Objections:** `objectionRaised`, `objectionBehind` and `objectionResponse` (text), plus `objectionResolved` (boolean).
- **Close:** `nextStepAsked`, `theirResponse`, `agreedNextAction`, `agreedNextDate` (all text).
- **After the call** (booleans): `postPipelineUpdated`, `postFollowupSent`, `postNotesCaptured`.

## Example

```ts
import * as crm from "urai:lib/urai/urai-crm-lib";

// "I just had a call with Priya at Acme, they want a demo next Tuesday"
const [hit] = (await crm.search("Acme")).filter((h) => h.type === "deal");
const deal = await crm.getDeal(hit.id);
await crm.logInteraction(deal.id, {
  type: "CALL_HELD",
  result: "NEXT_STEP_AGREED",
  notes: "Call with Priya. Next: demo Tue.",
});
await crm.saveWorksheet(deal.id, {
  agreedNextAction: "Demo",
  agreedNextDate: "2026-10-27",
});
await crm.showDeal(deal);
await crm.refresh();
urai.complete({ logged: true, deal: deal.name, stage: deal.stage });
```
