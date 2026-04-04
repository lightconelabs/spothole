<script lang="ts">
  import * as m from '$lib/paraglide/messages.js';
  import { fly } from 'svelte/transition';
  import { onMount, onDestroy } from 'svelte';
  import type { Report } from '$lib/types';
  import { categoryLabels, statusLabels, STATUS_COLORS } from '$lib/labels';

  let { report, onClose = () => {} }: { report: Report | null; onClose?: () => void } = $props();

  function timeAgo(date: string): string {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return m.time_just_now();
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return m.time_minutes({ count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return m.time_hours({ count: hours });
    const days = Math.floor(hours / 24);
    return m.time_days({ count: days });
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && report) {
      onClose();
    }
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    document.removeEventListener('keydown', handleKeydown);
  });
</script>

{#if report}
  <div class="overlay" role="presentation" onclick={onClose}></div>
  <div class="sheet" transition:fly={{ y: 300, duration: 250 }}>
    <button class="close-btn" onclick={onClose} aria-label={m.common_close()}>&times;</button>
    <div class="sheet-content">
      <img src={report.photo_url} alt={categoryLabels[report.category]?.()} class="photo" loading="lazy" />
      <div class="info">
        <div class="header-row">
          <span class="category" style="color: var(--color-{report.category})">{categoryLabels[report.category]?.()}</span>
          <span class="status" style="background: {STATUS_COLORS[report.status]}">{statusLabels[report.status]?.()}</span>
        </div>
        {#if report.description}
          <p class="description">{report.description}</p>
        {/if}
        <span class="time">{m.detail_reported()} {timeAgo(report.created_at)} {m.detail_ago()}</span>
        <a href="/report/{report.id}" class="detail-link">{m.common_next()} &rarr;</a>
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
