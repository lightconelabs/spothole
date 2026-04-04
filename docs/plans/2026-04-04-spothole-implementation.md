# Spothole Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a neighborhood issue reporting web app where users photograph problems (potholes, litter, etc.) and pin them on a map for city councils.

**Architecture:** SvelteKit SPA with Supabase backend (auth, Postgres, storage). MapLibre GL JS renders a full-screen map with clustered report markers. NSFW.js runs client-side to block inappropriate images before upload. svelte-i18n provides EN/FR/NL translations.

**Tech Stack:** SvelteKit, Supabase (@supabase/supabase-js, @supabase/ssr), MapLibre GL JS (maplibre-gl), NSFW.js (nsfwjs, @tensorflow/tfjs), svelte-i18n

---

### Task 1: Project Scaffolding

**Files:**
- Create: SvelteKit project in current directory
- Create: `.env.local` (gitignored)
- Create: `.env.example`

**Step 1: Initialize SvelteKit project**

Run:
```bash
npx sv create . --template minimal --types ts
```

Select defaults. If prompted about existing files, allow overwrite.

**Step 2: Install all dependencies**

Run:
```bash
npm install
npm install @supabase/supabase-js @supabase/ssr maplibre-gl svelte-i18n nsfwjs @tensorflow/tfjs
```

**Step 3: Create environment files**

Create `.env.example`:
```
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Create `.env.local` with actual Supabase credentials (this file is gitignored).

**Step 4: Add `.env.local` to `.gitignore`**

Ensure `.gitignore` contains:
```
.env.local
```

**Step 5: Verify dev server starts**

Run: `npm run dev`
Expected: SvelteKit dev server starts on localhost:5173

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold SvelteKit project with dependencies"
```

---

### Task 2: Supabase Client Setup

**Files:**
- Create: `src/lib/supabase.ts`
- Create: `src/hooks.server.ts`
- Modify: `src/routes/+layout.ts`
- Create: `src/routes/+layout.server.ts`
- Create: `src/routes/+layout.svelte`

**Step 1: Create Supabase client helper**

Create `src/lib/supabase.ts`:
```typescript
import { createBrowserClient, createServerClient, isBrowser } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { LayoutLoad } from '../routes/$types';

export const createSupabaseLoadClient = (fetch: LayoutLoad['fetch'], data: { session: any }) => {
  return isBrowser()
    ? createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
        global: { fetch }
      })
    : createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
        global: { fetch },
        cookies: { getAll: () => [] }
      });
};
```

**Step 2: Create server hooks for Supabase auth**

Create `src/hooks.server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => event.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          event.cookies.set(name, value, { ...options, path: '/' });
        });
      }
    }
  });

  event.locals.safeGetSession = async () => {
    const { data: { session } } = await event.locals.supabase.auth.getSession();
    if (!session) return { session: null, user: null };

    const { data: { user }, error } = await event.locals.supabase.auth.getUser();
    if (error) return { session: null, user: null };

    return { session, user };
  };

  return resolve(event, {
    filterSerializedResponseHeaders(name) {
      return name === 'content-range' || name === 'x-supabase-api-version';
    }
  });
};
```

**Step 3: Create layout server load**

Create `src/routes/+layout.server.ts`:
```typescript
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession } }) => {
  const { session } = await safeGetSession();
  return { session };
};
```

**Step 4: Create layout client load**

Create `src/routes/+layout.ts`:
```typescript
import { createBrowserClient, createServerClient, isBrowser } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ data, depends, fetch }) => {
  depends('supabase:auth');

  const supabase = isBrowser()
    ? createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, { global: { fetch } })
    : createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
        global: { fetch },
        cookies: { getAll: () => [] }
      });

  const { data: { session } } = await supabase.auth.getSession();

  return { supabase, session };
};
```

**Step 5: Create root layout component**

Create `src/routes/+layout.svelte`:
```svelte
<script lang="ts">
  import { invalidate } from '$app/navigation';
  import { onMount } from 'svelte';

  let { data, children } = $props();

  onMount(() => {
    const { data: { subscription } } = data.supabase.auth.onAuthStateChange((_, newSession) => {
      if (newSession?.expires_at !== data.session?.expires_at) {
        invalidate('supabase:auth');
      }
    });

    return () => subscription.unsubscribe();
  });
</script>

{@render children()}
```

**Step 6: Add type declarations**

Create `src/app.d.ts`:
```typescript
import type { SupabaseClient, Session } from '@supabase/supabase-js';

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient;
      safeGetSession: () => Promise<{ session: Session | null; user: any }>;
    }
    interface PageData {
      session: Session | null;
    }
  }
}

export {};
```

**Step 7: Verify dev server still starts**

Run: `npm run dev`
Expected: No errors (Supabase will fail to connect without real credentials, but the app should compile)

**Step 8: Commit**

```bash
git add src/lib/supabase.ts src/hooks.server.ts src/routes/+layout.ts src/routes/+layout.server.ts src/routes/+layout.svelte src/app.d.ts
git commit -m "feat: add Supabase client setup with SSR auth hooks"
```

---

### Task 3: Supabase Database Schema

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

**Step 1: Create migration file**

Create `supabase/migrations/001_initial_schema.sql`:
```sql
-- Categories enum
CREATE TYPE report_category AS ENUM ('pothole', 'litter', 'garbage_bin', 'graffiti', 'other');

-- Status enum
CREATE TYPE report_status AS ENUM ('pending', 'acknowledged', 'resolved');

-- Reports table
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category report_category NOT NULL,
  description TEXT CHECK (char_length(description) <= 500),
  latitude FLOAT8 NOT NULL,
  longitude FLOAT8 NOT NULL,
  photo_url TEXT NOT NULL,
  status report_status NOT NULL DEFAULT 'pending',
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS policies
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read reports
CREATE POLICY "Reports are viewable by everyone"
  ON reports FOR SELECT
  USING (true);

-- Authenticated users can insert reports
CREATE POLICY "Users can create reports"
  ON reports FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can update their own reports
CREATE POLICY "Users can update own reports"
  ON reports FOR UPDATE
  USING (auth.uid() = user_id);

-- Profiles readable by everyone
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

-- Users can manage own profile
CREATE POLICY "Users can manage own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Storage bucket for report photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('report-photos', 'report-photos', true);

-- Anyone authenticated can upload photos
CREATE POLICY "Authenticated users can upload photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'report-photos' AND auth.role() = 'authenticated');

-- Anyone can view photos
CREATE POLICY "Photos are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'report-photos');

-- Index for map queries
CREATE INDEX idx_reports_location ON reports (latitude, longitude);
CREATE INDEX idx_reports_created_at ON reports (created_at DESC);
```

**Step 2: Commit**

```bash
git add supabase/
git commit -m "feat: add Supabase database schema migration"
```

**Note:** This migration is run via the Supabase dashboard (SQL editor) or `supabase db push` if using the CLI. For now we just version the file.

---

### Task 4: Internationalization Setup

**Files:**
- Create: `src/lib/i18n/index.ts`
- Create: `src/lib/i18n/en.json`
- Create: `src/lib/i18n/fr.json`
- Create: `src/lib/i18n/nl.json`
- Modify: `src/routes/+layout.svelte`

**Step 1: Create English locale file**

Create `src/lib/i18n/en.json`:
```json
{
  "app": {
    "name": "Spothole",
    "tagline": "Report neighborhood issues"
  },
  "map": {
    "loading": "Loading map...",
    "locate_me": "My location",
    "no_gps": "Location access denied. Tap the map to set your position."
  },
  "categories": {
    "pothole": "Pothole",
    "litter": "Litter",
    "garbage_bin": "Overflowing bin",
    "graffiti": "Graffiti",
    "other": "Other"
  },
  "status": {
    "pending": "Pending",
    "acknowledged": "Acknowledged",
    "resolved": "Resolved"
  },
  "report": {
    "new": "Report an issue",
    "photo": "Take or upload a photo",
    "photo_change": "Change photo",
    "category": "What's the issue?",
    "location": "Where is it?",
    "location_hint": "Drag the pin to adjust",
    "description": "Description (optional)",
    "description_placeholder": "Add details about the issue...",
    "submit": "Submit report",
    "submitting": "Submitting...",
    "success": "Report submitted!",
    "success_message": "Thank you for helping improve your neighborhood.",
    "sign_up_prompt": "Create an account to track your reports",
    "view_on_map": "View on map"
  },
  "nsfw": {
    "blocked": "This image was blocked. Please upload an appropriate photo."
  },
  "detail": {
    "reported": "Reported",
    "ago": "ago",
    "address": "Address"
  },
  "profile": {
    "title": "My Profile",
    "sign_in": "Sign in",
    "sign_up": "Sign up",
    "sign_out": "Sign out",
    "email": "Email",
    "password": "Password",
    "display_name": "Display name",
    "my_reports": "My Reports",
    "no_reports": "You haven't submitted any reports yet."
  },
  "nav": {
    "map": "Map",
    "report": "Report",
    "profile": "Profile"
  },
  "common": {
    "cancel": "Cancel",
    "back": "Back",
    "next": "Next",
    "close": "Close",
    "error": "Something went wrong. Please try again.",
    "no_connection": "No internet connection."
  },
  "time": {
    "just_now": "just now",
    "minutes": "{count} min",
    "hours": "{count}h",
    "days": "{count}d"
  }
}
```

**Step 2: Create French locale file**

Create `src/lib/i18n/fr.json`:
```json
{
  "app": {
    "name": "Spothole",
    "tagline": "Signalez les problemes de quartier"
  },
  "map": {
    "loading": "Chargement de la carte...",
    "locate_me": "Ma position",
    "no_gps": "Acces a la localisation refuse. Touchez la carte pour definir votre position."
  },
  "categories": {
    "pothole": "Nid-de-poule",
    "litter": "Dechets",
    "garbage_bin": "Poubelle pleine",
    "graffiti": "Graffiti",
    "other": "Autre"
  },
  "status": {
    "pending": "En attente",
    "acknowledged": "Pris en compte",
    "resolved": "Resolu"
  },
  "report": {
    "new": "Signaler un probleme",
    "photo": "Prendre ou importer une photo",
    "photo_change": "Changer la photo",
    "category": "Quel est le probleme ?",
    "location": "Ou est-ce ?",
    "location_hint": "Deplacez le marqueur pour ajuster",
    "description": "Description (facultatif)",
    "description_placeholder": "Ajoutez des details sur le probleme...",
    "submit": "Envoyer le signalement",
    "submitting": "Envoi en cours...",
    "success": "Signalement envoye !",
    "success_message": "Merci de contribuer a ameliorer votre quartier.",
    "sign_up_prompt": "Creez un compte pour suivre vos signalements",
    "view_on_map": "Voir sur la carte"
  },
  "nsfw": {
    "blocked": "Cette image a ete bloquee. Veuillez importer une photo appropriee."
  },
  "detail": {
    "reported": "Signale",
    "ago": "",
    "address": "Adresse"
  },
  "profile": {
    "title": "Mon Profil",
    "sign_in": "Se connecter",
    "sign_up": "S'inscrire",
    "sign_out": "Se deconnecter",
    "email": "Email",
    "password": "Mot de passe",
    "display_name": "Nom d'affichage",
    "my_reports": "Mes Signalements",
    "no_reports": "Vous n'avez encore soumis aucun signalement."
  },
  "nav": {
    "map": "Carte",
    "report": "Signaler",
    "profile": "Profil"
  },
  "common": {
    "cancel": "Annuler",
    "back": "Retour",
    "next": "Suivant",
    "close": "Fermer",
    "error": "Une erreur est survenue. Veuillez reessayer.",
    "no_connection": "Pas de connexion internet."
  },
  "time": {
    "just_now": "a l'instant",
    "minutes": "{count} min",
    "hours": "{count}h",
    "days": "{count}j"
  }
}
```

**Step 3: Create Dutch locale file**

Create `src/lib/i18n/nl.json`:
```json
{
  "app": {
    "name": "Spothole",
    "tagline": "Meld problemen in je buurt"
  },
  "map": {
    "loading": "Kaart laden...",
    "locate_me": "Mijn locatie",
    "no_gps": "Locatietoegang geweigerd. Tik op de kaart om je positie in te stellen."
  },
  "categories": {
    "pothole": "Putveger",
    "litter": "Zwerfvuil",
    "garbage_bin": "Overvolle vuilnisbak",
    "graffiti": "Graffiti",
    "other": "Andere"
  },
  "status": {
    "pending": "In afwachting",
    "acknowledged": "Bevestigd",
    "resolved": "Opgelost"
  },
  "report": {
    "new": "Meld een probleem",
    "photo": "Neem of upload een foto",
    "photo_change": "Foto wijzigen",
    "category": "Wat is het probleem?",
    "location": "Waar is het?",
    "location_hint": "Sleep de pin om aan te passen",
    "description": "Beschrijving (optioneel)",
    "description_placeholder": "Voeg details toe over het probleem...",
    "submit": "Melding versturen",
    "submitting": "Verzenden...",
    "success": "Melding verstuurd!",
    "success_message": "Bedankt om je buurt te helpen verbeteren.",
    "sign_up_prompt": "Maak een account aan om je meldingen te volgen",
    "view_on_map": "Bekijk op kaart"
  },
  "nsfw": {
    "blocked": "Deze afbeelding werd geblokkeerd. Upload een gepaste foto."
  },
  "detail": {
    "reported": "Gemeld",
    "ago": "geleden",
    "address": "Adres"
  },
  "profile": {
    "title": "Mijn Profiel",
    "sign_in": "Aanmelden",
    "sign_up": "Registreren",
    "sign_out": "Afmelden",
    "email": "Email",
    "password": "Wachtwoord",
    "display_name": "Weergavenaam",
    "my_reports": "Mijn Meldingen",
    "no_reports": "Je hebt nog geen meldingen ingediend."
  },
  "nav": {
    "map": "Kaart",
    "report": "Melden",
    "profile": "Profiel"
  },
  "common": {
    "cancel": "Annuleren",
    "back": "Terug",
    "next": "Volgende",
    "close": "Sluiten",
    "error": "Er ging iets mis. Probeer opnieuw.",
    "no_connection": "Geen internetverbinding."
  },
  "time": {
    "just_now": "zojuist",
    "minutes": "{count} min",
    "hours": "{count}u",
    "days": "{count}d"
  }
}
```

**Step 4: Create i18n initialization**

Create `src/lib/i18n/index.ts`:
```typescript
import { browser } from '$app/environment';
import { init, register, getLocaleFromNavigator } from 'svelte-i18n';

register('en', () => import('./en.json'));
register('fr', () => import('./fr.json'));
register('nl', () => import('./nl.json'));

const storedLocale = browser ? localStorage.getItem('locale') : null;

init({
  fallbackLocale: 'en',
  initialLocale: storedLocale || (browser ? getLocaleFromNavigator() : 'en')
});
```

**Step 5: Import i18n in root layout**

Modify `src/routes/+layout.svelte` to add at the top of the script tag:
```typescript
import '$lib/i18n';
```

**Step 6: Verify app loads with i18n**

Run: `npm run dev`
Expected: No errors. App compiles with i18n loaded.

**Step 7: Commit**

```bash
git add src/lib/i18n/ src/routes/+layout.svelte
git commit -m "feat: add i18n with EN/FR/NL locale files"
```

---

### Task 5: Global Styles and App Shell

**Files:**
- Create: `src/app.css`
- Modify: `src/routes/+layout.svelte`

**Step 1: Create global styles**

Create `src/app.css`:
```css
:root {
  --color-primary: #2563eb;
  --color-primary-dark: #1d4ed8;
  --color-success: #16a34a;
  --color-warning: #ea580c;
  --color-danger: #dc2626;
  --color-gray-50: #f9fafb;
  --color-gray-100: #f3f4f6;
  --color-gray-200: #e5e7eb;
  --color-gray-300: #d1d5db;
  --color-gray-500: #6b7280;
  --color-gray-700: #374151;
  --color-gray-900: #111827;

  --color-pothole: #ea580c;
  --color-litter: #2563eb;
  --color-garbage_bin: #16a34a;
  --color-graffiti: #dc2626;
  --color-other: #6b7280;

  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 16px;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  height: 100%;
  font-family: var(--font-sans);
  color: var(--color-gray-900);
  background: var(--color-gray-50);
  -webkit-font-smoothing: antialiased;
}

button {
  cursor: pointer;
  border: none;
  font-family: inherit;
}

a {
  color: var(--color-primary);
  text-decoration: none;
}
```

**Step 2: Update root layout with app shell**

Replace `src/routes/+layout.svelte` with:
```svelte
<script lang="ts">
  import { invalidate } from '$app/navigation';
  import { onMount } from 'svelte';
  import { _, locale } from 'svelte-i18n';
  import '$lib/i18n';
  import '../app.css';

  let { data, children } = $props();

  onMount(() => {
    const { data: { subscription } } = data.supabase.auth.onAuthStateChange((_, newSession) => {
      if (newSession?.expires_at !== data.session?.expires_at) {
        invalidate('supabase:auth');
      }
    });

    return () => subscription.unsubscribe();
  });

  function setLocale(lang: string) {
    locale.set(lang);
    localStorage.setItem('locale', lang);
  }
</script>

<div class="app">
  <header class="top-bar">
    <span class="logo">{$_('app.name')}</span>
    <div class="lang-picker">
      <button class:active={$locale?.startsWith('en')} onclick={() => setLocale('en')}>EN</button>
      <button class:active={$locale?.startsWith('fr')} onclick={() => setLocale('fr')}>FR</button>
      <button class:active={$locale?.startsWith('nl')} onclick={() => setLocale('nl')}>NL</button>
    </div>
  </header>
  <main class="content">
    {@render children()}
  </main>
</div>

<style>
  .app {
    height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: white;
    border-bottom: 1px solid var(--color-gray-200);
    z-index: 100;
    flex-shrink: 0;
  }

  .logo {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-primary);
  }

  .lang-picker {
    display: flex;
    gap: 4px;
  }

  .lang-picker button {
    padding: 4px 10px;
    border-radius: var(--radius-sm);
    font-size: 0.8rem;
    font-weight: 600;
    background: var(--color-gray-100);
    color: var(--color-gray-500);
    transition: all 0.15s;
  }

  .lang-picker button.active {
    background: var(--color-primary);
    color: white;
  }

  .content {
    flex: 1;
    overflow: hidden;
    position: relative;
  }
</style>
```

**Step 3: Commit**

```bash
git add src/app.css src/routes/+layout.svelte
git commit -m "feat: add global styles and app shell with language picker"
```

---

### Task 6: Map View (Home Page)

**Files:**
- Create: `src/routes/+page.svelte`
- Create: `src/routes/+page.ts`
- Create: `src/lib/components/Map.svelte`
- Create: `src/lib/components/ReportMarker.svelte`
- Create: `src/lib/components/BottomSheet.svelte`

**Step 1: Create page load function**

Create `src/routes/+page.ts`:
```typescript
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { supabase } = await parent();

  const { data: reports } = await supabase
    .from('reports')
    .select('id, category, description, latitude, longitude, photo_url, status, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  return { reports: reports ?? [] };
};
```

**Step 2: Create Map component**

Create `src/lib/components/Map.svelte`:
```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import maplibregl from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';

  type Report = {
    id: string;
    category: string;
    latitude: number;
    longitude: number;
    photo_url: string;
    status: string;
    description: string;
    created_at: string;
  };

  let { reports = [], onMarkerClick = (_r: Report) => {} }: { reports: Report[]; onMarkerClick?: (report: Report) => void } = $props();

  let mapContainer: HTMLDivElement;
  let map: maplibregl.Map;

  const CATEGORY_COLORS: Record<string, string> = {
    pothole: '#ea580c',
    litter: '#2563eb',
    garbage_bin: '#16a34a',
    graffiti: '#dc2626',
    other: '#6b7280'
  };

  const BRUSSELS_CENTER: [number, number] = [4.3517, 50.8503];

  onMount(() => {
    map = new maplibregl.Map({
      container: mapContainer,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: BRUSSELS_CENTER,
      zoom: 13
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true
      }),
      'top-right'
    );

    map.on('load', () => {
      addReportsToMap(reports);
    });
  });

  onDestroy(() => {
    map?.remove();
  });

  function addReportsToMap(reports: Report[]) {
    if (!map || !map.loaded()) return;

    // Remove existing source/layers
    if (map.getSource('reports')) {
      map.removeLayer('clusters');
      map.removeLayer('cluster-count');
      map.removeLayer('unclustered-point');
      map.removeSource('reports');
    }

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: reports.map((r) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [r.longitude, r.latitude] },
        properties: { id: r.id, category: r.category, status: r.status, color: CATEGORY_COLORS[r.category] || '#6b7280' }
      }))
    };

    map.addSource('reports', {
      type: 'geojson',
      data: geojson,
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50
    });

    map.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'reports',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#2563eb',
        'circle-radius': ['step', ['get', 'point_count'], 20, 10, 30, 50, 40],
        'circle-opacity': 0.8
      }
    });

    map.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'reports',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-size': 13
      },
      paint: {
        'text-color': '#ffffff'
      }
    });

    map.addLayer({
      id: 'unclustered-point',
      type: 'circle',
      source: 'reports',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': ['get', 'color'],
        'circle-radius': 8,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });

    // Click cluster to zoom
    map.on('click', 'clusters', async (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
      const clusterId = features[0]?.properties?.cluster_id;
      const source = map.getSource('reports') as maplibregl.GeoJSONSource;
      const zoom = await source.getClusterExpansionZoom(clusterId);
      map.easeTo({ center: (features[0].geometry as GeoJSON.Point).coordinates as [number, number], zoom });
    });

    // Click marker to show details
    map.on('click', 'unclustered-point', (e) => {
      const feature = e.features?.[0];
      if (feature) {
        const report = reports.find((r) => r.id === feature.properties?.id);
        if (report) onMarkerClick(report);
      }
    });

    map.on('mouseenter', 'clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'clusters', () => { map.getCanvas().style.cursor = ''; });
    map.on('mouseenter', 'unclustered-point', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'unclustered-point', () => { map.getCanvas().style.cursor = ''; });
  }

  $effect(() => {
    if (map?.loaded()) {
      addReportsToMap(reports);
    }
  });
</script>

<div class="map-wrapper" bind:this={mapContainer}></div>

<style>
  .map-wrapper {
    width: 100%;
    height: 100%;
  }
</style>
```

**Step 3: Create BottomSheet component**

Create `src/lib/components/BottomSheet.svelte`:
```svelte
<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { fly } from 'svelte/transition';

  type Report = {
    id: string;
    category: string;
    latitude: number;
    longitude: number;
    photo_url: string;
    status: string;
    description: string;
    created_at: string;
  };

  let { report, onClose = () => {} }: { report: Report | null; onClose?: () => void } = $props();

  function timeAgo(date: string): string {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return $_('time.just_now');
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return $_('time.minutes', { values: { count: minutes } });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return $_('time.hours', { values: { count: hours } });
    const days = Math.floor(hours / 24);
    return $_('time.days', { values: { count: days } });
  }

  const STATUS_COLORS: Record<string, string> = {
    pending: 'var(--color-warning)',
    acknowledged: 'var(--color-primary)',
    resolved: 'var(--color-success)'
  };
</script>

{#if report}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="overlay" onclick={onClose}></div>
  <div class="sheet" transition:fly={{ y: 300, duration: 250 }}>
    <button class="close-btn" onclick={onClose}>&times;</button>
    <div class="sheet-content">
      <img src={report.photo_url} alt={$_(`categories.${report.category}`)} class="photo" />
      <div class="info">
        <div class="header-row">
          <span class="category" style="color: var(--color-{report.category})">{$_(`categories.${report.category}`)}</span>
          <span class="status" style="background: {STATUS_COLORS[report.status]}">{$_(`status.${report.status}`)}</span>
        </div>
        {#if report.description}
          <p class="description">{report.description}</p>
        {/if}
        <span class="time">{$_('detail.reported')} {timeAgo(report.created_at)} {$_('detail.ago')}</span>
        <a href="/report/{report.id}" class="detail-link">{$_('common.next')} &rarr;</a>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.3);
    z-index: 200;
  }

  .sheet {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: white;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    z-index: 201;
    max-height: 60vh;
    overflow-y: auto;
    box-shadow: var(--shadow-lg);
  }

  .close-btn {
    position: absolute;
    top: 8px;
    right: 12px;
    font-size: 1.5rem;
    background: none;
    color: var(--color-gray-500);
  }

  .sheet-content {
    display: flex;
    gap: 12px;
    padding: 16px;
  }

  .photo {
    width: 100px;
    height: 100px;
    object-fit: cover;
    border-radius: var(--radius-md);
    flex-shrink: 0;
  }

  .info {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .header-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .category {
    font-weight: 700;
    font-size: 1rem;
  }

  .status {
    font-size: 0.7rem;
    font-weight: 600;
    color: white;
    padding: 2px 8px;
    border-radius: 99px;
  }

  .description {
    font-size: 0.85rem;
    color: var(--color-gray-700);
  }

  .time {
    font-size: 0.75rem;
    color: var(--color-gray-500);
  }

  .detail-link {
    font-size: 0.85rem;
    font-weight: 600;
    margin-top: 4px;
  }
</style>
```

**Step 4: Create home page**

Create `src/routes/+page.svelte`:
```svelte
<script lang="ts">
  import { _ } from 'svelte-i18n';
  import Map from '$lib/components/Map.svelte';
  import BottomSheet from '$lib/components/BottomSheet.svelte';

  let { data } = $props();

  type Report = {
    id: string;
    category: string;
    latitude: number;
    longitude: number;
    photo_url: string;
    status: string;
    description: string;
    created_at: string;
  };

  let selectedReport: Report | null = $state(null);
</script>

<svelte:head>
  <title>{$_('app.name')}</title>
</svelte:head>

<Map reports={data.reports} onMarkerClick={(r) => selectedReport = r} />

<a href="/report/new" class="fab" aria-label={$_('report.new')}>
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
</a>

<BottomSheet report={selectedReport} onClose={() => selectedReport = null} />

<style>
  .fab {
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--color-primary);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow-lg);
    z-index: 100;
    transition: transform 0.15s, background 0.15s;
  }

  .fab:hover {
    background: var(--color-primary-dark);
    transform: scale(1.05);
  }
</style>
```

**Step 5: Verify map renders**

Run: `npm run dev`
Expected: Full-screen map renders with Carto basemap, centered on Brussels. FAB button visible.

**Step 6: Commit**

```bash
git add src/routes/+page.svelte src/routes/+page.ts src/lib/components/
git commit -m "feat: add map view with clustered markers and bottom sheet"
```

---

### Task 7: NSFW Detection Module

**Files:**
- Create: `src/lib/nsfw.ts`

**Step 1: Create NSFW module**

Create `src/lib/nsfw.ts`:
```typescript
import type { NSFWJS } from 'nsfwjs';

let model: NSFWJS | null = null;

export async function loadNsfwModel(): Promise<NSFWJS> {
  if (model) return model;

  const nsfwjs = await import('nsfwjs');
  const tf = await import('@tensorflow/tfjs');

  // Use smaller mobilenet model for faster loading
  model = await nsfwjs.load();
  return model;
}

export type NsfwResult = {
  safe: boolean;
  reason?: string;
};

export async function checkImage(imageElement: HTMLImageElement): Promise<NsfwResult> {
  const nsfwModel = await loadNsfwModel();
  const predictions = await nsfwModel.classify(imageElement);

  const scores: Record<string, number> = {};
  for (const p of predictions) {
    scores[p.className.toLowerCase()] = p.probability;
  }

  const pornScore = scores['porn'] ?? 0;
  const hentaiScore = scores['hentai'] ?? 0;

  if (pornScore > 0.3 || hentaiScore > 0.3) {
    return { safe: false, reason: 'nsfw_content' };
  }

  return { safe: true };
}
```

**Step 2: Commit**

```bash
git add src/lib/nsfw.ts
git commit -m "feat: add NSFW.js detection module with lazy loading"
```

---

### Task 8: Image Compression Utility

**Files:**
- Create: `src/lib/image.ts`

**Step 1: Create image utility**

Create `src/lib/image.ts`:
```typescript
const MAX_WIDTH = 1920;
const QUALITY = 0.8;

export function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      if (width > MAX_WIDTH) {
        height = (height * MAX_WIDTH) / width;
        width = MAX_WIDTH;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas not supported'));

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Compression failed'));
        },
        'image/jpeg',
        QUALITY
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

export function createImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}
```

**Step 2: Commit**

```bash
git add src/lib/image.ts
git commit -m "feat: add client-side image compression utility"
```

---

### Task 9: Report Creation Page

**Files:**
- Create: `src/routes/report/new/+page.svelte`
- Create: `src/lib/components/LocationPicker.svelte`
- Create: `src/lib/components/CategoryPicker.svelte`

**Step 1: Create CategoryPicker component**

Create `src/lib/components/CategoryPicker.svelte`:
```svelte
<script lang="ts">
  import { _ } from 'svelte-i18n';

  let { value = $bindable(''), onSelect = (_c: string) => {} }: { value?: string; onSelect?: (category: string) => void } = $props();

  const categories = [
    { id: 'pothole', icon: '🕳️' },
    { id: 'litter', icon: '🗑️' },
    { id: 'garbage_bin', icon: '♻️' },
    { id: 'graffiti', icon: '🎨' },
    { id: 'other', icon: '⚠️' }
  ];
</script>

<div class="category-grid">
  {#each categories as cat}
    <button
      class="category-btn"
      class:selected={value === cat.id}
      onclick={() => { value = cat.id; onSelect(cat.id); }}
    >
      <span class="icon">{cat.icon}</span>
      <span class="label">{$_(`categories.${cat.id}`)}</span>
    </button>
  {/each}
</div>

<style>
  .category-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .category-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 16px 8px;
    border-radius: var(--radius-md);
    background: var(--color-gray-100);
    transition: all 0.15s;
  }

  .category-btn.selected {
    background: var(--color-primary);
    color: white;
    box-shadow: var(--shadow-md);
  }

  .icon {
    font-size: 1.5rem;
  }

  .label {
    font-size: 0.8rem;
    font-weight: 600;
  }
</style>
```

**Step 2: Create LocationPicker component**

Create `src/lib/components/LocationPicker.svelte`:
```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { _ } from 'svelte-i18n';
  import maplibregl from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';

  let {
    latitude = $bindable(50.8503),
    longitude = $bindable(4.3517),
    address = $bindable('')
  }: { latitude?: number; longitude?: number; address?: string } = $props();

  let mapContainer: HTMLDivElement;
  let map: maplibregl.Map;
  let marker: maplibregl.Marker;

  onMount(() => {
    map = new maplibregl.Map({
      container: mapContainer,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [longitude, latitude],
      zoom: 15
    });

    marker = new maplibregl.Marker({ draggable: true, color: '#2563eb' })
      .setLngLat([longitude, latitude])
      .addTo(map);

    marker.on('dragend', () => {
      const lngLat = marker.getLngLat();
      latitude = lngLat.lat;
      longitude = lngLat.lng;
      reverseGeocode(latitude, longitude);
    });

    map.on('click', (e) => {
      latitude = e.lngLat.lat;
      longitude = e.lngLat.lng;
      marker.setLngLat([longitude, latitude]);
      reverseGeocode(latitude, longitude);
    });

    // Try to geolocate
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
        marker.setLngLat([longitude, latitude]);
        map.flyTo({ center: [longitude, latitude], zoom: 16 });
        reverseGeocode(latitude, longitude);
      },
      () => {
        // GPS denied, use default
        reverseGeocode(latitude, longitude);
      }
    );
  });

  onDestroy(() => {
    map?.remove();
  });

  async function reverseGeocode(lat: number, lng: number) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      address = data.display_name || '';
    } catch {
      address = '';
    }
  }
</script>

<div class="location-picker">
  <div class="map-container" bind:this={mapContainer}></div>
  <p class="hint">{$_('report.location_hint')}</p>
  {#if address}
    <p class="address">{address}</p>
  {/if}
</div>

<style>
  .location-picker {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .map-container {
    width: 100%;
    height: 250px;
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .hint {
    font-size: 0.8rem;
    color: var(--color-gray-500);
  }

  .address {
    font-size: 0.85rem;
    color: var(--color-gray-700);
  }
</style>
```

**Step 3: Create report creation page**

Create `src/routes/report/new/+page.svelte`:
```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { _ } from 'svelte-i18n';
  import CategoryPicker from '$lib/components/CategoryPicker.svelte';
  import LocationPicker from '$lib/components/LocationPicker.svelte';
  import { checkImage } from '$lib/nsfw';
  import { compressImage, createImageElement } from '$lib/image';

  let { data } = $props();

  let photoFile: File | null = $state(null);
  let photoPreview: string = $state('');
  let category: string = $state('');
  let latitude: number = $state(50.8503);
  let longitude: number = $state(4.3517);
  let address: string = $state('');
  let description: string = $state('');
  let submitting: boolean = $state(false);
  let nsfwError: string = $state('');
  let error: string = $state('');
  let success: boolean = $state(false);

  let fileInput: HTMLInputElement;

  async function handlePhoto(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    nsfwError = '';

    // Check NSFW
    const img = await createImageElement(file);
    const result = await checkImage(img);

    if (!result.safe) {
      nsfwError = $_('nsfw.blocked');
      input.value = '';
      return;
    }

    photoFile = file;
    photoPreview = URL.createObjectURL(file);
  }

  async function handleSubmit() {
    if (!photoFile || !category) return;

    submitting = true;
    error = '';

    try {
      const { supabase } = data;

      // Ensure we have an anonymous session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        await supabase.auth.signInAnonymously();
      }

      // Compress and upload photo
      const compressed = await compressImage(photoFile);
      const fileName = `${Date.now()}-${crypto.randomUUID()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('report-photos')
        .upload(fileName, compressed, { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('report-photos')
        .getPublicUrl(fileName);

      // Insert report
      const { error: insertError } = await supabase.from('reports').insert({
        category,
        description: description.trim() || null,
        latitude,
        longitude,
        photo_url: urlData.publicUrl,
        user_id: (await supabase.auth.getUser()).data.user?.id
      });

      if (insertError) throw insertError;

      success = true;
    } catch (e) {
      error = $_('common.error');
      console.error(e);
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>{$_('report.new')} | {$_('app.name')}</title>
</svelte:head>

<div class="page">
  {#if success}
    <div class="success-card">
      <div class="check">&#10003;</div>
      <h2>{$_('report.success')}</h2>
      <p>{$_('report.success_message')}</p>
      <a href="/" class="btn">{$_('report.view_on_map')}</a>
      {#if !data.session}
        <a href="/profile" class="btn btn-secondary">{$_('report.sign_up_prompt')}</a>
      {/if}
    </div>
  {:else}
    <div class="form-header">
      <a href="/" class="back">&larr; {$_('common.back')}</a>
      <h1>{$_('report.new')}</h1>
    </div>

    <div class="form">
      <!-- Photo -->
      <section>
        <label class="section-label">{$_('report.photo')}</label>
        {#if photoPreview}
          <div class="photo-preview">
            <img src={photoPreview} alt="Preview" />
            <button class="change-btn" onclick={() => fileInput.click()}>{$_('report.photo_change')}</button>
          </div>
        {:else}
          <button class="photo-btn" onclick={() => fileInput.click()}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="12" cy="12" r="3" />
              <path d="M9 5l1-2h4l1 2" />
            </svg>
            <span>{$_('report.photo')}</span>
          </button>
        {/if}
        <input
          bind:this={fileInput}
          type="file"
          accept="image/*"
          capture="environment"
          onchange={handlePhoto}
          hidden
        />
        {#if nsfwError}
          <p class="error-text">{nsfwError}</p>
        {/if}
      </section>

      <!-- Category -->
      <section>
        <label class="section-label">{$_('report.category')}</label>
        <CategoryPicker bind:value={category} />
      </section>

      <!-- Location -->
      <section>
        <label class="section-label">{$_('report.location')}</label>
        <LocationPicker bind:latitude bind:longitude bind:address />
      </section>

      <!-- Description -->
      <section>
        <label class="section-label" for="description">{$_('report.description')}</label>
        <textarea
          id="description"
          bind:value={description}
          placeholder={$_('report.description_placeholder')}
          maxlength="500"
          rows="3"
        ></textarea>
      </section>

      {#if error}
        <p class="error-text">{error}</p>
      {/if}

      <button
        class="submit-btn"
        onclick={handleSubmit}
        disabled={!photoFile || !category || submitting}
      >
        {submitting ? $_('report.submitting') : $_('report.submit')}
      </button>
    </div>
  {/if}
</div>

<style>
  .page {
    padding: 16px;
    max-width: 600px;
    margin: 0 auto;
    height: 100%;
    overflow-y: auto;
  }

  .form-header {
    margin-bottom: 20px;
  }

  .back {
    font-size: 0.85rem;
    color: var(--color-gray-500);
  }

  h1 {
    font-size: 1.4rem;
    margin-top: 8px;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-label {
    font-weight: 600;
    font-size: 0.95rem;
  }

  .photo-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 32px;
    border: 2px dashed var(--color-gray-300);
    border-radius: var(--radius-md);
    background: white;
    color: var(--color-gray-500);
    font-size: 0.9rem;
  }

  .photo-preview {
    position: relative;
  }

  .photo-preview img {
    width: 100%;
    max-height: 250px;
    object-fit: cover;
    border-radius: var(--radius-md);
  }

  .change-btn {
    position: absolute;
    bottom: 8px;
    right: 8px;
    padding: 6px 12px;
    background: rgba(0,0,0,0.6);
    color: white;
    border-radius: var(--radius-sm);
    font-size: 0.8rem;
  }

  textarea {
    padding: 12px;
    border: 1px solid var(--color-gray-300);
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: 0.9rem;
    resize: vertical;
  }

  textarea:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  .submit-btn {
    padding: 14px;
    background: var(--color-primary);
    color: white;
    font-size: 1rem;
    font-weight: 600;
    border-radius: var(--radius-md);
    transition: background 0.15s;
  }

  .submit-btn:hover:not(:disabled) {
    background: var(--color-primary-dark);
  }

  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error-text {
    color: var(--color-danger);
    font-size: 0.85rem;
  }

  .success-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
    padding: 48px 16px;
  }

  .check {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--color-success);
    color: white;
    font-size: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn {
    display: block;
    width: 100%;
    max-width: 300px;
    padding: 12px;
    border-radius: var(--radius-md);
    font-weight: 600;
    text-align: center;
    background: var(--color-primary);
    color: white;
  }

  .btn-secondary {
    background: var(--color-gray-100);
    color: var(--color-gray-700);
  }
</style>
```

**Step 4: Verify report page renders**

Run: `npm run dev`, navigate to `/report/new`
Expected: Form renders with photo upload, category picker, map, description field, submit button.

**Step 5: Commit**

```bash
git add src/routes/report/ src/lib/components/CategoryPicker.svelte src/lib/components/LocationPicker.svelte
git commit -m "feat: add report creation page with NSFW check and location picker"
```

---

### Task 10: Report Detail Page

**Files:**
- Create: `src/routes/report/[id]/+page.ts`
- Create: `src/routes/report/[id]/+page.svelte`

**Step 1: Create detail page loader**

Create `src/routes/report/[id]/+page.ts`:
```typescript
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, parent }) => {
  const { supabase } = await parent();

  const { data: report, error: fetchError } = await supabase
    .from('reports')
    .select('*')
    .eq('id', params.id)
    .single();

  if (fetchError || !report) throw error(404, 'Report not found');

  return { report };
};
```

**Step 2: Create detail page**

Create `src/routes/report/[id]/+page.svelte`:
```svelte
<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { onMount, onDestroy } from 'svelte';
  import maplibregl from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';

  let { data } = $props();
  const report = data.report;

  let mapContainer: HTMLDivElement;
  let map: maplibregl.Map;

  const STATUS_COLORS: Record<string, string> = {
    pending: 'var(--color-warning)',
    acknowledged: 'var(--color-primary)',
    resolved: 'var(--color-success)'
  };

  onMount(() => {
    map = new maplibregl.Map({
      container: mapContainer,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [report.longitude, report.latitude],
      zoom: 16,
      interactive: false
    });

    new maplibregl.Marker({ color: '#2563eb' })
      .setLngLat([report.longitude, report.latitude])
      .addTo(map);
  });

  onDestroy(() => {
    map?.remove();
  });

  function formatDate(date: string): string {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(date));
  }
</script>

<svelte:head>
  <title>{$_(`categories.${report.category}`)} | {$_('app.name')}</title>
</svelte:head>

<div class="page">
  <a href="/" class="back">&larr; {$_('common.back')}</a>

  <img src={report.photo_url} alt={$_(`categories.${report.category}`)} class="hero-photo" />

  <div class="details">
    <div class="header-row">
      <h1 style="color: var(--color-{report.category})">{$_(`categories.${report.category}`)}</h1>
      <span class="status" style="background: {STATUS_COLORS[report.status]}">{$_(`status.${report.status}`)}</span>
    </div>

    {#if report.description}
      <p class="description">{report.description}</p>
    {/if}

    <p class="time">{$_('detail.reported')} {formatDate(report.created_at)}</p>

    <div class="mini-map" bind:this={mapContainer}></div>
  </div>
</div>

<style>
  .page {
    max-width: 600px;
    margin: 0 auto;
    height: 100%;
    overflow-y: auto;
  }

  .back {
    display: inline-block;
    padding: 12px 16px;
    font-size: 0.85rem;
    color: var(--color-gray-500);
  }

  .hero-photo {
    width: 100%;
    max-height: 300px;
    object-fit: cover;
  }

  .details {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .header-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  h1 {
    font-size: 1.3rem;
  }

  .status {
    font-size: 0.75rem;
    font-weight: 600;
    color: white;
    padding: 3px 10px;
    border-radius: 99px;
  }

  .description {
    font-size: 0.95rem;
    color: var(--color-gray-700);
    line-height: 1.5;
  }

  .time {
    font-size: 0.8rem;
    color: var(--color-gray-500);
  }

  .mini-map {
    width: 100%;
    height: 200px;
    border-radius: var(--radius-md);
    overflow: hidden;
  }
</style>
```

**Step 3: Commit**

```bash
git add src/routes/report/
git commit -m "feat: add report detail page with static map"
```

---

### Task 11: Profile Page

**Files:**
- Create: `src/routes/profile/+page.svelte`
- Create: `src/routes/profile/+page.ts`

**Step 1: Create profile page loader**

Create `src/routes/profile/+page.ts`:
```typescript
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { supabase, session } = await parent();

  if (!session || session.user?.is_anonymous) {
    return { user: null, reports: [] };
  }

  const { data: reports } = await supabase
    .from('reports')
    .select('id, category, status, created_at, photo_url')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  return { user: session.user, reports: reports ?? [] };
};
```

**Step 2: Create profile page**

Create `src/routes/profile/+page.svelte`:
```svelte
<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { invalidate } from '$app/navigation';

  let { data } = $props();

  let email: string = $state('');
  let password: string = $state('');
  let authError: string = $state('');
  let loading: boolean = $state(false);
  let isSignUp: boolean = $state(false);

  async function handleAuth() {
    loading = true;
    authError = '';

    const { supabase } = data;

    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      authError = error.message;
    } else {
      invalidate('supabase:auth');
    }

    loading = false;
  }

  async function handleSignOut() {
    await data.supabase.auth.signOut();
    invalidate('supabase:auth');
  }
</script>

<svelte:head>
  <title>{$_('profile.title')} | {$_('app.name')}</title>
</svelte:head>

<div class="page">
  <a href="/" class="back">&larr; {$_('nav.map')}</a>

  {#if data.user}
    <div class="profile-header">
      <h1>{$_('profile.title')}</h1>
      <p class="email">{data.user.email}</p>
      <button class="sign-out-btn" onclick={handleSignOut}>{$_('profile.sign_out')}</button>
    </div>

    <h2>{$_('profile.my_reports')}</h2>

    {#if data.reports.length === 0}
      <p class="empty">{$_('profile.no_reports')}</p>
    {:else}
      <div class="report-list">
        {#each data.reports as report}
          <a href="/report/{report.id}" class="report-card">
            <img src={report.photo_url} alt="" class="thumb" />
            <div class="report-info">
              <span class="cat">{$_(`categories.${report.category}`)}</span>
              <span class="stat">{$_(`status.${report.status}`)}</span>
            </div>
          </a>
        {/each}
      </div>
    {/if}
  {:else}
    <h1>{$_('profile.sign_in')}</h1>

    <form class="auth-form" onsubmit|preventDefault={handleAuth}>
      <input type="email" bind:value={email} placeholder={$_('profile.email')} required />
      <input type="password" bind:value={password} placeholder={$_('profile.password')} required minlength="6" />

      {#if authError}
        <p class="error-text">{authError}</p>
      {/if}

      <button class="auth-btn" type="submit" disabled={loading}>
        {isSignUp ? $_('profile.sign_up') : $_('profile.sign_in')}
      </button>

      <button type="button" class="toggle-btn" onclick={() => isSignUp = !isSignUp}>
        {isSignUp ? $_('profile.sign_in') : $_('profile.sign_up')}
      </button>
    </form>
  {/if}
</div>

<style>
  .page {
    padding: 16px;
    max-width: 600px;
    margin: 0 auto;
    height: 100%;
    overflow-y: auto;
  }

  .back {
    font-size: 0.85rem;
    color: var(--color-gray-500);
  }

  .profile-header {
    margin: 16px 0;
  }

  h1 {
    font-size: 1.4rem;
    margin: 12px 0;
  }

  h2 {
    font-size: 1.1rem;
    margin: 20px 0 12px;
  }

  .email {
    color: var(--color-gray-500);
    font-size: 0.9rem;
  }

  .sign-out-btn {
    margin-top: 8px;
    padding: 8px 16px;
    background: var(--color-gray-100);
    border-radius: var(--radius-sm);
    font-size: 0.85rem;
    color: var(--color-gray-700);
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 16px;
  }

  .auth-form input {
    padding: 12px;
    border: 1px solid var(--color-gray-300);
    border-radius: var(--radius-md);
    font-size: 0.95rem;
  }

  .auth-form input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  .auth-btn {
    padding: 14px;
    background: var(--color-primary);
    color: white;
    font-size: 1rem;
    font-weight: 600;
    border-radius: var(--radius-md);
  }

  .toggle-btn {
    background: none;
    color: var(--color-primary);
    font-size: 0.9rem;
  }

  .error-text {
    color: var(--color-danger);
    font-size: 0.85rem;
  }

  .empty {
    color: var(--color-gray-500);
    font-size: 0.9rem;
  }

  .report-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .report-card {
    display: flex;
    gap: 12px;
    padding: 10px;
    background: white;
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    color: inherit;
  }

  .thumb {
    width: 60px;
    height: 60px;
    object-fit: cover;
    border-radius: var(--radius-sm);
  }

  .report-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    justify-content: center;
  }

  .cat {
    font-weight: 600;
    font-size: 0.9rem;
  }

  .stat {
    font-size: 0.8rem;
    color: var(--color-gray-500);
  }
</style>
```

**Step 3: Commit**

```bash
git add src/routes/profile/
git commit -m "feat: add profile page with auth and report list"
```

---

### Task 12: Final Integration & Cleanup

**Step 1: Verify all routes work**

Run: `npm run dev`
Check:
- `/` — Map loads, FAB visible
- `/report/new` — Form renders with all sections
- `/profile` — Auth form shows for logged-out users

**Step 2: Run type check**

Run: `npm run check`
Expected: No type errors

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: final integration cleanup"
```
