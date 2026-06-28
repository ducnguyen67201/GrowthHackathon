# Data-Sources Integration — Real Retrieval & Aggregation

Wire the re-trigger engine to real external systems for the two data types it can't make up:
**closed-lost deals** (CRM) and **call transcripts** (call-recording). Enrichment (Fiber) and
execution (Orange Slice) clients already exist; this plan adds the missing two behind one
swappable seam, with a generated provider so the system runs end-to-end today with zero keys.

## Principle

One interface per source. A `generated` impl ships realistic retrieved data now; a real vendor
adapter drops in behind the same interface later. The deal shape mirrors `lostDeals.byAccount`,
so **swapping the vendor never touches the UI** — the /live autopsy popup renders a synced row
identically to a seeded one.

## Architecture

```
lib/sources/
  types.ts        DealSource / TranscriptSource interfaces + SourceDeal / SourceTranscript
  generated.ts    GeneratedDealSource + GeneratedTranscriptSource  (demo provider, deterministic)
  index.ts        getDealSource() / getTranscriptSource()  — env-switched registry
                  DEAL_SOURCE=generated|salesforce|hubspot
                  TRANSCRIPT_SOURCE=generated|gong|fireflies

convex/sources.ts        sync action: retrieve deals → aggregate transcripts → importSynced
convex/lostDeals.ts      importSynced mutation (sink) + byAccount query (read)
lib/retrigger-live.ts    engine reads the retrieved transcript (grounded objection extraction)
```

Data flow:

```
sources:sync ─► DealSource.listClosedLost() ─┐
                                             ├─ join per deal ─► lostDeals.importSynced ─► Convex
             ─► TranscriptSource.getForDeal()┘                                                │
                                                                                              ▼
/live re-trigger ─► lostDeals.byAccount ─► (a) DealMoment autopsy popup   (b) extractObjection reads
                                            the retrieved transcript        the real call, grounded
```

## Status

| Source | Client | State |
|---|---|---|
| Fiber (firmographics/social/email) | `lib/fiber.ts` `discoverAndEnrich` | ✅ exists; wired into ingest + livegen |
| Orange Slice (send + contact enrich) | `lib/orangeslice.ts` `execute` | ✅ wired at send (Gmail fallback) |
| Closed-lost deals | `lib/sources` (generated) | ✅ this plan — generated now, CRM adapter later |
| Transcripts | `lib/sources` (generated) | ✅ this plan — generated now, call-vendor later |

## Wiring a real vendor (the only change needed)

1. Add `lib/sources/<vendor>.ts` implementing `DealSource` or `TranscriptSource`.
   - **Salesforce**: SOQL `Opportunity WHERE StageName='Closed Lost'` → `SourceDeal[]`.
   - **HubSpot**: CRM deals API, `dealstage=closedlost`.
   - **Gong**: `GET /v2/calls` filtered by account → `/v2/calls/transcript`.
   - **Fireflies**: GraphQL `transcript` query.
2. Register a `case` in `lib/sources/index.ts`.
3. Set the env var (`DEAL_SOURCE=salesforce`, creds) + run `npx convex run sources:sync`.

Nothing downstream changes. The interface throws a precise "not wired" error naming the exact
adapter + creds until step 1 is done — no silent fallback that hides a misconfig.

## Run

```bash
npx convex run sources:sync                 # 12 deals + transcripts from configured sources
npx convex run sources:sync '{"count": 30}' # scale up the dead pipeline
```

## Out of scope (next)

- Generated source is deterministic templates; add an LLM variant if transcripts feel samey.
- `sources:sync` writes `lostDeals` only; it does not regenerate scored re-trigger creatives
  (the /signals board). Add that join if the board should light up for synced deals too.
- A cron (`convex/crons.ts`) to re-sync on a schedule once a real vendor is keyed.
