# Spothole — Design Document

Neighborhood issue reporting app for Belgian city councils.

## Stack

- **SvelteKit** — frontend framework (SPA)
- **Supabase** — auth, Postgres database, file storage
- **MapLibre GL JS** — full-screen interactive map with clustered markers
- **NSFW.js** — client-side image moderation before upload
- **svelte-i18n** — internationalization (EN, FR, NL)

## Routes

- `/` — Full-screen map with clustered report markers. Floating action button to create a report. Tap a marker to see details in a bottom sheet.
- `/report/new` — Report creation flow: photo, category, location, description, submit.
- `/report/[id]` — Report detail view.
- `/profile` — Optional sign-up/login, view your submissions.

## Data Model

### `reports` table

| Column      | Type                                                    | Notes                    |
|-------------|---------------------------------------------------------|--------------------------|
| id          | uuid (PK)                                               | default gen_random_uuid  |
| category    | enum: pothole, litter, garbage_bin, graffiti, other     |                          |
| description | text                                                    | max 500 chars, optional  |
| latitude    | float8                                                  |                          |
| longitude   | float8                                                  |                          |
| photo_url   | text                                                    | Supabase Storage path    |
| status      | enum: pending, acknowledged, resolved                   | default pending          |
| user_id     | uuid (FK to auth.users)                                 | nullable for anonymous   |
| created_at  | timestamptz                                             | default now()            |

### `profiles` table

| Column       | Type                    | Notes                   |
|--------------|-------------------------|-------------------------|
| id           | uuid (PK, FK auth.users)|                         |
| display_name | text                    |                         |
| created_at   | timestamptz             | default now()           |

Photos stored in a `report-photos` Supabase Storage bucket with RLS.

## Authentication

Anonymous + optional account. Anyone can submit reports without signing up. Supabase anonymous auth used silently. Users can optionally create an account (email or OAuth) to track submissions. Past anonymous reports link to the new account.

## Map View

- Full-screen MapLibre map centered on user's GPS location (with permission) or default city center.
- Report markers clustered at lower zoom levels. Color-coded by category: orange (pothole), green (garbage), blue (litter), red (graffiti), gray (other).
- Tap cluster to zoom in. Tap marker to open bottom sheet with photo thumbnail, category, time ago, status badge.
- Floating action button (bottom-right) to create a report.

## Report Creation Flow

1. **Photo** — Camera capture or file upload. NSFW.js runs client-side. Block if `porn` or `hentai` score > 0.3. No image leaves device if flagged.
2. **Category** — Icon grid: pothole, litter, overflowing bin, graffiti, other.
3. **Location** — Map snippet centered on GPS. Draggable pin to adjust. Reverse geocode via Nominatim for human-readable address.
4. **Description** — Optional text (max 500 chars).
5. **Submit** — Upload photo to Supabase Storage, insert report row. Show success with option to sign up.

## Internationalization

- `svelte-i18n` with JSON locale files: `en.json`, `fr.json`, `nl.json`.
- Language picker in top bar. Persisted to localStorage. Auto-detect browser language on first visit.
- All UI strings externalized.

## NSFW Moderation

- NSFW.js loaded client-side via TensorFlow.js. Loaded lazily on first report creation.
- Block threshold: `porn` or `hentai` > 0.3.
- If blocked: clear image, show localized error, no upload.

## Image Handling

- Client-side compression before upload: max 1920px wide, ~80% JPEG quality.

## Out of Scope (v1)

- Offline support
- Duplicate report detection
- Admin dashboard for city councils
- Push notifications
