# SOSPHD — Fieldwork Consent Framework

**Status**: v1.0, effective 2026-08-13. Pairs with migration
`20260813_011_research_consent_fields.sql` (consent columns on
`research.journal_entries` and `research.uploads`).

## Why this exists

Field recordings, interviews, and notes that involve **other people**
(providers, fixers, clients, officials) are only usable as *research data* when
collected with informed consent under the rules of the jurisdiction where they
were captured. **Consent cannot be granted retroactively** — a session recorded
without consent is permanently unusable in a paper, no matter how valuable.
As reps replicate fieldwork across markets, every record must carry its own
consent state and jurisdiction; a deployment-wide assumption does not survive
the second country.

This framework is deliberately minimal. It is **not** IRB approval — it is the
capture discipline that makes later IRB/ethics review and publication possible.
When a formal ethics protocol exists, its requirements supersede anything here.

## The four consent states (`research.consent_status`)

| Status | Meaning | Research-usable? |
|---|---|---|
| `not_required` | Self-authored material; no third party involved | Yes |
| `pending` | Third party involved; consent not yet captured | **No — resolve before citing** |
| `obtained` | Informed consent captured (`consent_method` + `consent_captured_at` set) | Yes |
| `declined` | Consent refused | **Never** — operational context only |

Rules of thumb:
- Your own reflections, plans, and ideas → `not_required`.
- Anything quoting, recording, or describing an identifiable person → needs
  `obtained` before it can appear in research outputs.
- If in doubt in the field, save as `pending` and resolve the same day —
  pending records age into unusable records.

## The verbal consent script (adapt per language; log method as `verbal`)

> "I'm [name], doing doctoral research on how medical emergencies involving
> tourists get coordinated — timing, payments, transport. May I take notes on
> our conversation *(and/or: record this conversation)* and use what you tell
> me, without your name, in academic publications? You can decline, stop at
> any time, or ask me to leave anything out. Nothing you say affects our
> business relationship either way."

Then record in the journal entry / upload:
- **Status**: `obtained` (or `declined` — still log the meeting as operational context)
- **Method**: `verbal`, `written`, or `recorded_verbal` (consent captured on the recording itself)
- **Jurisdiction**: ISO country code where the capture happened (e.g. `TH`, `ID`, `VN`)

For **recordings**, prefer `recorded_verbal`: start the recording, read the
script, capture the "yes" on tape. The recording then carries its own proof.

## Jurisdiction notes

- **Thailand (`TH`)**: PDPA applies to identifiable personal data; health data
  is a sensitive category. Verbal consent captured on the record is workable
  for research field interviews; written is stronger for anything clinical.
- **Every new market**: before the first recorded session, spend thirty
  minutes confirming (a) whether one-party recording is lawful, (b) whether a
  data-protection statute adds requirements. Note findings in this file.
- The `consent_jurisdiction` field exists precisely because a 40-country
  operation cannot assume one legal regime.

## Storage and retention

- Recordings and documents go in the **private** `research-uploads` bucket
  (migration 013; owner-folder RLS, signed-URL access only). Never a public
  bucket, never a personal drive.
- The upload's metadata row carries the consent fields; a recording without
  `obtained` consent stays quarantined from research use by its own metadata.
- If a participant later withdraws: mark the record `declined` in the app and
  delete the stored file. Withdrawal is honored going forward; published
  aggregates are not retracted (say this in the consent conversation if asked).

## What this framework does NOT cover

- Patient/clinical data — SOSPHD never stores raw PHI; `patient_ref` is a
  pseudonym. Operational PHI is governed by the operational apps.
- Formal IRB submission — this framework is the field practice an IRB
  application will describe, not a substitute for one.
- Employment/marketing recordings with no research use — out of scope, but
  the same capture discipline is cheap insurance if they ever become research.
