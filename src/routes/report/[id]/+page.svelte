<script lang="ts">
  import * as m from '$lib/paraglide/messages.js';
  import { onMount, onDestroy } from 'svelte';
  import { categoryLabels, statusLabels, STATUS_COLORS } from '$lib/labels';
  import maplibregl from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';

  let { data } = $props();
  const report = $derived(data.report);

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
