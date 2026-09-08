# Refreshing the hosted cultural calendar

The user's manual refresh request authorizes research and calendar updates, not bookings, purchases, messages or recurring tasks. Email research remains paused unless the user resumes it.

The canonical research workspace is still the original art-calendar folder. Follow its REFRESH.md, source audits and preservation rules. Retain all stable IDs and event history. Do not put that folder's private profile, research data, decisions, history or personal notes in this public repository.

## Before researching

1. Read the current hosted `calendar_research` row and its revision. Fetch `calendar_artists` and `calendar_decisions` using the authorized Supabase connection. Never assume a local JSON file contains the current choices.
2. An authenticated Supabase dashboard session can read these through the SQL Editor. For example, query `select artist_id,payload,version from public.calendar_artists order by payload->>'name'`. The user does not need to export anything. Do not inspect browser authentication tokens.
3. Save a dated research snapshot in the task's private work area. Compare hosted and local research dates and event IDs before deciding which source to update. If hosted data is newer, bring it into the private research workspace first.

## Artist searches on every refresh

For each artist whose `payload.following` is true, read their personal notes and supplied official/gallery link. Resolve ambiguous names before attributing news. Check the artist, representing galleries, museums, estates and relevant auction/sales listings for news, current and forthcoming exhibitions, new releases, and available works. Cover worldwide activity, while prioritising visits and purchases useful from London. No investment-return rankings.

Search since the previous complete check with a two-week overlap, plus current programmes and undated searches for missed announcements. During the first check cover the current and forthcoming programme and recent news. Preserve blocked sources as a stated gap; no results from a narrow search is not proof of no activity.

Append each check to the research payload's `artist_checks` array:

```json
{"artist_id":"existing stable artist ID","checked_on":"YYYY-MM-DD","status":"checked","notes":"Actual scope and limitations","source_urls":["https://official.example"],"findings":[{"title":"Sourced announcement","kind":"exhibition","url":"https://official.example/event","date":null,"event_id":"optional existing calendar ID"}]}
```

Statuses: checked, partial, blocked. Finding kinds: news, exhibition, sale. Deduplicate by announcement identity and source, preserve earlier checks, and report only meaningful new or changed findings. Add useful dated exhibitions/sales as normal calendar records; undated news stays with the artist. Never invent dates or prices, and never treat an auction estimate as a realised price. Preserve the separate annual acquisition-budget constraint from the private research profile.

Findings can include a stable `id`, `start_date`, `end_date`, `venue`, `city` and a short original `summary`. Use complete dates for exhibitions; a publication date must not masquerade as an exhibition start. The artist tab groups events by their actual dates, with incomplete dates kept separate. The newest check wins for the same finding ID. For sales add `price: {type: "asking" | "realised" | "estimate", amount: number, currency: "GBP", date: "YYYY-MM-DD", medium: "...", dimensions: "...", edition: "...", fees_note: "..."}`. Estimates may use `low` and `high` instead of amount. State whether auction premiums are included or unknown. Keep prices for different media, dimensions and editions distinct; do not manufacture a single artist-wide market price.

## Addresses and neighbourhoods

Preserve the payload's `locations` map, keyed by stable event ID, and the canonical private `event-locations.json`. Each event maps to an array of `{name,address,neighbourhood,city,country,source_urls,verified_on}`. Verify the actual event venue, not an organiser's office or another gallery branch in a page footer. Retain more than one place for shows using multiple buildings. Area-wide festivals use `{scope:"area",neighbourhood,programme_url,...}` and link to their programme rather than an arbitrary map pin. Check locations for new editions even if their series has appeared before. Do not put this private data in the public code repository.

## Past visits and next editions

The journal is ordered and filtered by optional `visited_on`, never by exhibition dates. Undated visits stay visible. Preserve `visit_notes`, `visit_rating`, `return_interest`, `return_series`, `return_season` and `return_candidate` in personal records; research publishing does not write to those tables.

On each refresh check every decision marked `return_interest:"watch"`, plus suggested return candidates. `return_interest:"dismissed"` suppresses suggestions. The app flags a Seen event when it has a favourable verdict (liked/loved, or an unambiguously favourable visit note when no verdict exists) and looks repeatable, such as open studios, an art trail, fair or festival. An old saved decision may predate the `return_candidate` field, so also apply the current app's `returnCandidate` rule. These flags are leads, not proof of recurrence. Respect corrections and do not treat every positive exhibition review as annual.

Use the original event, organiser, personal season preference and official programme to check for another edition. Record each attempt in `return_checks` as `{previous_event_id,checked_on,status,notes,source_urls,next_event_ids:[]}` with status checked, partial or blocked. If unannounced, say so without inventing a future event date. When an edition is officially announced, create a new stable event ID, link it using `next_event_ids`, and retain the old event and review. Do not mark the new edition Seen or Booked. Neither these checks nor artist checks imply a new scheduled monitor.

## Listings strategy

The September 2026 feasibility audit is saved in the private task outputs as `LISTINGS-AUDIT.md`, with a frozen 40-event sample and source snapshots in the private work area. It does not establish 90% recall. Start with structured discovery from GalleriesNow, Art Monthly and New Exhibitions, supplemented by Jewel in the Gallery and The Shock of the Now. Deduplicate event runs separately from preview dates. Retain authoritative venue checks, especially for studios, theatre, international museums, prices and date conflicts. Public entry points were tested for all 18 services in the linked article; app-rendered listings and blocked pagination remain gaps. Never count a venue directory or an artist mention as a confirmed event match.

## Publish and verify

Run the existing local updater to validate the reviewed batch without changing personal cloud records. Use `publish_calendar_research(new_payload, expected_revision)` for publishing. It checks the revision and rejects removal of event IDs. For browser-editor limits, publish field-level replacements using the current payload and its current revision, then verify the completed payload. Do not advertise a completed refresh until all pieces are present.

Read back event counts, IDs, latest research date and artist checks. Verify that personal record counts/versions did not change. The online app detects a new research revision and asks for a reload; its local unsaved drafts remain intact.

Preserve source-check and venue-check ledgers, archive admission queues and frozen audit results in the private research workspace. The hosted app's compact research payload is the display inventory, not a replacement for the research evidence archive.
