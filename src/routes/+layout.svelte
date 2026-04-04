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
    }
  }

  const currentLocale = $derived(getLocale());
</script>

<div class="app">
  <header class="top-bar">
    <span class="logo">{m.app_name()}</span>
    <div class="lang-picker">
      <button class:active={currentLocale === 'en'} onclick={() => switchLocale('en')}>EN</button>
      <button class:active={currentLocale === 'fr'} onclick={() => switchLocale('fr')}>FR</button>
      <button class:active={currentLocale === 'nl'} onclick={() => switchLocale('nl')}>NL</button>
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
