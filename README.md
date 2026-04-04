![spothole](static/spothole-logo.png)

Report potholes, litter, graffiti, and other urban issues on an interactive map.

---

Spothole is a citizen reporting tool built with SvelteKit and Supabase. Snap a photo, drop a pin, and let your city know what needs fixing.

## Features

- Interactive map with clustered markers and category legend
- Photo-based reporting with NSFW detection
- Geolocation-aware location picker
- Multilingual (EN / FR / NL) with SSR locale support
- User profiles with report history

## Getting started

```sh
npm install
npm run dev
```

## Tech stack

- **Frontend:** SvelteKit, MapLibre GL, Paraglide (i18n)
- **Backend:** Supabase (auth, database, storage)
- **Logo:** Generated with [pixie](https://github.com/kwakzalf/pixie)
