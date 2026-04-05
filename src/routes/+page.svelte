<script lang="ts">
  import * as m from '$lib/paraglide/messages.js';
  import type { Report } from '$lib/types';
  import Map from '$lib/components/Map.svelte';
  import BottomSheet from '$lib/components/BottomSheet.svelte';

  let { data } = $props();

  let selectedReport: Report | null = $state(null);
</script>

<svelte:head>
  <title>{m.app_name()}</title>
</svelte:head>

<Map reports={data.reports} onMarkerClick={(r) => selectedReport = r} />

<a href="/report/new" class="fab" aria-label={m.report_new()}>
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
