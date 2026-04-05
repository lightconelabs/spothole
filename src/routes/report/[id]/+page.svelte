<script lang="ts">
  import * as m from '$lib/paraglide/messages.js';
  import { onMount, onDestroy } from 'svelte';
  import { enhance } from '$app/forms';
  import { categoryLabels, statusLabels, STATUS_COLORS } from '$lib/labels';
  import maplibregl from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';

  let { data } = $props();
  const report = $derived(data.report);
  const session = $derived(data.session);
  const confirmationCount = $derived(data.confirmationCount);
  const userHasConfirmed = $derived(data.userHasConfirmed);
  const isResolved = $derived(report.status === 'resolved');
  const threshold = 3;

  let submitting = $state(false);
  let errorMessage = $state('');

  let mapContainer: HTMLDivElement;
  let map: maplibregl.Map;

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
  <title>{categoryLabels[report.category]?.()} | {m.app_name()}</title>
</svelte:head>

<div class="page">
  <a href="/" class="back">&larr; {m.common_back()}</a>

  <img src={report.photo_url} alt={categoryLabels[report.category]?.()} class="hero-photo" loading="lazy" />

  <div class="details">
    <div class="header-row">
      <h1 style="color: var(--color-{report.category})">{categoryLabels[report.category]?.()}</h1>
      <span class="status" style="background: {STATUS_COLORS[report.status]}">{statusLabels[report.status]?.()}</span>
    </div>

    {#if report.description}
      <p class="description">{report.description}</p>
    {/if}

    <p class="time">{m.detail_reported()} {formatDate(report.created_at)}</p>

    <div class="resolve-section">
      {#if isResolved}
        <p class="resolve-status resolved">{m.resolve_already_resolved()}</p>
      {:else}
        <div class="resolve-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: {Math.min((confirmationCount / threshold) * 100, 100)}%"></div>
          </div>
          <span class="progress-label">{m.resolve_count({ count: String(confirmationCount), threshold: String(threshold) })}</span>
        </div>

        {#if !session?.user}
          <p class="resolve-hint">{m.resolve_sign_in_prompt()}</p>
        {:else if userHasConfirmed}
          <p class="resolve-status confirmed">{m.resolve_confirmed()}</p>
        {:else}
          <form method="POST" action="?/confirm_resolved" use:enhance={() => {
            submitting = true;
            errorMessage = '';
            return async ({ result, update }) => {
              submitting = false;
              if (result.type === 'failure') {
                errorMessage = m.resolve_error();
              } else {
                await update();
              }
            };
          }}>
            <button type="submit" class="confirm-btn" disabled={submitting}>
              {m.resolve_confirm()}
            </button>
          </form>
          {#if errorMessage}
            <p class="resolve-error">{errorMessage}</p>
          {/if}
        {/if}
      {/if}
    </div>

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

  .resolve-section {
    border: 1px solid var(--color-gray-200);
    border-radius: var(--radius-md);
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .resolve-progress {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .progress-bar {
    height: 6px;
    background: var(--color-gray-200);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--color-success);
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .progress-label {
    font-size: 0.8rem;
    color: var(--color-gray-500);
  }

  .resolve-status {
    font-size: 0.85rem;
    font-weight: 500;
  }

  .resolve-status.resolved {
    color: var(--color-success);
  }

  .resolve-status.confirmed {
    color: var(--color-primary);
  }

  .resolve-hint {
    font-size: 0.8rem;
    color: var(--color-gray-500);
  }

  .confirm-btn {
    width: 100%;
    padding: 10px 16px;
    font-size: 0.9rem;
    font-weight: 600;
    color: white;
    background: var(--color-success);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .confirm-btn:hover {
    opacity: 0.9;
  }

  .confirm-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .resolve-error {
    font-size: 0.8rem;
    color: var(--color-danger, #dc2626);
  }

  .mini-map {
    width: 100%;
    height: 200px;
    border-radius: var(--radius-md);
    overflow: hidden;
  }
</style>
