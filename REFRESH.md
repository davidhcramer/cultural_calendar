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

## Publish and verify

Run the existing local updater to validate the reviewed batch without changing personal cloud records. Use `publish_calendar_research(new_payload, expected_revision)` for publishing. It checks the revision and rejects removal of event IDs. For browser-editor limits, publish field-level replacements using the current payload and its current revision, then verify the completed payload. Do not advertise a completed refresh until all pieces are present.

Read back event counts, IDs, latest research date and artist checks. Verify that personal record counts/versions did not change. The online app detects a new research revision and asks for a reload; its local unsaved drafts remain intact.

Preserve source-check and venue-check ledgers, archive admission queues and frozen audit results in the private research workspace. The hosted app's compact research payload is the display inventory, not a replacement for the research evidence archive.
