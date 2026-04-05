<script lang="ts">
  import { invalidate } from '$app/navigation';
  import { onMount } from 'svelte';
  import * as m from '$lib/paraglide/messages.js';
  import { getLocale, setLocale, isLocale } from '$lib/paraglide/runtime.js';
  import '../app.css';

  let { data, children } = $props();

  onMount(() => {
    const { data: { subscription } } = data.supabase.auth.onAuthStateChange((_: any, newSession: any) => {
      if (newSession?.expires_at !== data.session?.expires_at) {
        invalidate('supabase:auth');
      }
    });

    return () => subscription.unsubscribe();
  });

  function switchLocale(lang: string) {
    if (isLocale(lang)) {
      setLocale(lang);
      document.cookie = `PARAGLIDE_LOCALE=${lang};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
    }
  }

  const currentLocale = $derived(getLocale());
</script>

<div class="app">
  <header class="top-bar">
    <a href="/" class="logo">
      <img src="/spothole-logo.svg" alt={m.app_name()} class="logo-img" />
    </a>
    <div class="top-bar-right">
      <div class="lang-picker">
        <button class:active={currentLocale === 'en'} onclick={() => switchLocale('en')}>EN</button>
        <button class:active={currentLocale === 'fr'} onclick={() => switchLocale('fr')}>FR</button>
        <button class:active={currentLocale === 'nl'} onclick={() => switchLocale('nl')}>NL</button>
      </div>
      <a href="/profile" class="profile-link" aria-label={m.profile_title()}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M20 21a8 8 0 1 0-16 0" />
        </svg>
      </a>
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
    display: flex;
    align-items: center;
    text-decoration: none;
  }

  .logo-img {
    height: 28px;
    width: auto;
  }

  .top-bar-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .profile-link {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    color: var(--color-gray-500);
    transition: background 0.15s, color 0.15s;
  }

  .profile-link:hover {
    background: var(--color-gray-100);
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
    overflow: auto;
    position: relative;
  }
</style>
