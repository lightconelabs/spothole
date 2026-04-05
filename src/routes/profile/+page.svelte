<script lang="ts">
  import * as m from '$lib/paraglide/messages.js';
  import { invalidate } from '$app/navigation';
  import { categoryLabels, statusLabels } from '$lib/labels';

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
  <title>{m.profile_title()} | {m.app_name()}</title>
</svelte:head>

<div class="page">
  <a href="/" class="back">&larr; {m.nav_map()}</a>

  {#if data.user}
    <div class="profile-header">
      <h1>{m.profile_title()}</h1>
      <p class="email">{data.user.email}</p>
      <button class="sign-out-btn" onclick={handleSignOut}>{m.profile_sign_out()}</button>
    </div>

    <h2>{m.profile_my_reports()}</h2>

    {#if data.reports.length === 0}
      <p class="empty">{m.profile_no_reports()}</p>
    {:else}
      <div class="report-list">
        {#each data.reports as report}
          <a href="/report/{report.id}" class="report-card">
            <img src={report.photo_url} alt={categoryLabels[report.category]?.()} class="thumb" loading="lazy" />
            <div class="report-info">
              <span class="cat">{categoryLabels[report.category]?.()}</span>
              <span class="stat">{statusLabels[report.status]?.()}</span>
            </div>
          </a>
        {/each}
      </div>
    {/if}
  {:else}
    <h1>{m.profile_sign_in()}</h1>

    <form class="auth-form" onsubmit={(e) => { e.preventDefault(); handleAuth(); }}>
      <input type="email" bind:value={email} placeholder={m.profile_email()} required />
      <input type="password" bind:value={password} placeholder={m.profile_password()} required minlength="6" />

      {#if authError}
        <p class="error-text">{authError}</p>
      {/if}

      <button class="auth-btn" type="submit" disabled={loading}>
        {isSignUp ? m.profile_sign_up() : m.profile_sign_in()}
      </button>

      <button type="button" class="toggle-btn" onclick={() => isSignUp = !isSignUp}>
        {isSignUp ? m.profile_sign_in() : m.profile_sign_up()}
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
