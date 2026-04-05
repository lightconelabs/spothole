<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as m from '$lib/paraglide/messages.js';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import type { Report } from '$lib/types';
  import maplibregl from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';

  let { reports = [], onMarkerClick = (_r: Report) => {} }: { reports: Report[]; onMarkerClick?: (report: Report) => void } = $props();

  let mapContainer: HTMLDivElement;
  let map: maplibregl.Map;
  let hoverPopup: maplibregl.Popup | null = null;
  let searchQuery: string = $state('');
  let searchResults: Array<{ display_name: string; lat: string; lon: string }> = $state([]);
  let searchTimeout: ReturnType<typeof setTimeout>;
  let searchFocused: boolean = $state(false);

  // Category filter state
  let activeFilters: Record<string, boolean> = $state({
    pothole: true,
    litter: true,
    garbage_bin: true,
    graffiti: true,
    other: true
  });

  const CATEGORIES = [
    { id: 'pothole', color: '#fb923c', label: m.category_pothole },
    { id: 'litter', color: '#60a5fa', label: m.category_litter },
    { id: 'garbage_bin', color: '#4ade80', label: m.category_garbage_bin },
    { id: 'graffiti', color: '#f87171', label: m.category_graffiti },
    { id: 'other', color: '#9ca3af', label: m.category_other }
  ];

  const CATEGORY_COLORS: Record<string, string> = Object.fromEntries(
    CATEGORIES.map(c => [c.id, c.color])
  );

  const STORAGE_KEY = 'spothole_map_view';
  const DEFAULT_CENTER: [number, number] = [4.3517, 50.8503];
  const DEFAULT_ZOOM = 13;

  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getSavedView(): { center: [number, number]; zoom: number } {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };
  }

  function saveView() {
    if (!map) return;
    const center = map.getCenter();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      center: [center.lng, center.lat],
      zoom: map.getZoom()
    }));
  }

  function toggleFilter(categoryId: string) {
    activeFilters[categoryId] = !activeFilters[categoryId];
    updateSourceData();
  }

  function getFilteredReports(reps: Report[]): Report[] {
    return reps.filter(r => activeFilters[r.category] !== false);
  }

  function updateSourceData() {
    if (!map || !map.getSource('reports')) return;
    const source = map.getSource('reports') as maplibregl.GeoJSONSource;
    source.setData(reportsToGeoJSON(getFilteredReports(reports)));
  }

  function reportsToGeoJSON(reps: Report[]): GeoJSON.FeatureCollection {
    return {
      type: 'FeatureCollection',
      features: reps.map((r) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [r.longitude, r.latitude] },
        properties: {
          id: r.id,
          category: r.category,
          status: r.status,
          color: CATEGORY_COLORS[r.category] || '#6b7280',
          photo_url: r.photo_url,
          description: r.description || '',
          address: r.address || ''
        }
      }))
    };
  }

  async function handleSearch(query: string) {
    if (query.length < 3) {
      searchResults = [];
      return;
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      try {
        const locale = getLocale();
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
          { headers: { 'Accept-Language': locale } }
        );
        searchResults = await res.json();
      } catch {
        searchResults = [];
      }
    }, 300);
  }

  function selectResult(result: { display_name: string; lat: string; lon: string }) {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    map.flyTo({ center: [lng, lat], zoom: 15 });
    searchQuery = result.display_name;
    searchResults = [];
  }

  function handleSearchBlur(e: FocusEvent) {
    const related = e.relatedTarget as HTMLElement | null;
    if (related?.closest('.search-results')) return;
    searchFocused = false;
    searchResults = [];
  }

  onMount(() => {
    const { center, zoom } = getSavedView();

    map = new maplibregl.Map({
      container: mapContainer,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center,
      zoom
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    const geolocate = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true
    });
    map.addControl(geolocate, 'top-right');

    // Save view on move
    map.on('moveend', saveView);

    // Save location from geolocate
    geolocate.on('geolocate', () => {
      saveView();
    });

    map.on('load', () => {
      setupMapLayers(reports);
      setupMapInteractions();
      // Only auto-geolocate if no saved view
      if (!localStorage.getItem(STORAGE_KEY)) {
        geolocate.trigger();
      }
    });
  });

  onDestroy(() => {
    hoverPopup?.remove();
    map?.remove();
  });

  function setupMapLayers(reps: Report[]) {
    if (!map || !map.loaded()) return;

    const filtered = getFilteredReports(reps);

    map.addSource('reports', {
      type: 'geojson',
      data: reportsToGeoJSON(filtered),
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
        'circle-color': '#60a5fa',
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
  }

  function setupMapInteractions() {
    // Click cluster to zoom
    map.on('click', 'clusters', async (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
      const clusterId = features[0]?.properties?.cluster_id;
      const source = map.getSource('reports') as maplibregl.GeoJSONSource;
      const zoom = await source.getClusterExpansionZoom(clusterId);
      map.easeTo({ center: (features[0].geometry as GeoJSON.Point).coordinates as [number, number], zoom });
    });

    // Click marker to open bottom sheet
    map.on('click', 'unclustered-point', (e) => {
      hoverPopup?.remove();
      hoverPopup = null;

      const feature = e.features?.[0];
      if (feature) {
        const report = reports.find((r) => r.id === feature.properties?.id);
        if (report) onMarkerClick(report);
      }
    });

    // Hover popup with thumbnail (skip on touch devices to avoid flash before bottom sheet)
    map.on('mouseenter', 'unclustered-point', (e) => {
      map.getCanvas().style.cursor = 'pointer';

      if ('ontouchstart' in window) return;

      const feature = e.features?.[0];
      if (!feature) return;

      const props = feature.properties!;
      const coords = (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
      const categoryLabel = CATEGORIES.find(c => c.id === props.category)?.label() ?? props.category;

      hoverPopup?.remove();
      const shortAddress = props.address
        ? props.address.split(',').slice(0, 2).map((s: string) => s.trim()).join(', ')
        : '';

      hoverPopup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 12,
        className: 'report-popup'
      })
        .setLngLat(coords)
        .setHTML(`
          <div class="popup-link">
            <img src="${escapeHtml(props.photo_url)}" alt="${escapeHtml(categoryLabel)}" />
            <div class="popup-info">
              <strong style="color: ${escapeHtml(CATEGORY_COLORS[props.category] || '#6b7280')}">${escapeHtml(categoryLabel)}</strong>
              ${shortAddress ? `<span class="popup-address">${escapeHtml(shortAddress)}</span>` : ''}
            </div>
          </div>
        `)
        .addTo(map);

      // Click on the popup should open the same bottom sheet as clicking the marker
      hoverPopup.getElement().addEventListener('click', () => {
        const report = reps.find((r) => r.id === props.id);
        if (report) onMarkerClick(report);
        hoverPopup?.remove();
        hoverPopup = null;
      });
    });

    map.on('mouseleave', 'unclustered-point', () => {
      map.getCanvas().style.cursor = '';
      hoverPopup?.remove();
      hoverPopup = null;
    });

    map.on('mouseenter', 'clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'clusters', () => { map.getCanvas().style.cursor = ''; });
  }

  $effect(() => {
    if (map?.loaded() && map.getSource('reports')) {
      updateSourceData();
    } else if (map?.loaded() && !map.getSource('reports')) {
      setupMapLayers(reports);
      setupMapInteractions();
    }
  });
</script>

<div class="map-container">
  <div class="search-bar">
    <input
      type="text"
      placeholder={m.map_search_placeholder()}
      bind:value={searchQuery}
      oninput={() => handleSearch(searchQuery)}
      onfocus={() => { searchFocused = true; handleSearch(searchQuery); }}
      onblur={handleSearchBlur}
    />
    {#if searchResults.length > 0 && searchFocused}
      <ul class="search-results">
        {#each searchResults as result}
          <li>
            <button onmousedown={() => selectResult(result)}>{result.display_name}</button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <div class="legend">
    {#each CATEGORIES as cat}
      <button
        class="legend-item"
        class:inactive={!activeFilters[cat.id]}
        onclick={() => toggleFilter(cat.id)}
      >
        <span class="legend-dot" style="background: {cat.color}"></span>
        <span class="legend-label">{cat.label()}</span>
      </button>
    {/each}
  </div>

  <div class="map-wrapper" bind:this={mapContainer}></div>
</div>

<style>
  .map-container {
    width: 100%;
    height: 100%;
    position: relative;
  }

  .map-wrapper {
    width: 100%;
    height: 100%;
  }

  .search-bar {
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 10;
    width: min(350px, calc(100% - 80px));
  }

  .search-bar input {
    width: 100%;
    padding: 10px 14px;
    border: none;
    border-radius: var(--radius-md);
    background: white;
    box-shadow: var(--shadow-md);
    font-size: 0.9rem;
    font-family: inherit;
  }

  .search-bar input:focus {
    outline: none;
    box-shadow: var(--shadow-lg), 0 0 0 2px var(--color-primary);
  }

  .search-results {
    list-style: none;
    background: white;
    border-radius: 0 0 var(--radius-md) var(--radius-md);
    box-shadow: var(--shadow-md);
    margin-top: 2px;
    max-height: 200px;
    overflow-y: auto;
  }

  .search-results button {
    width: 100%;
    text-align: left;
    padding: 10px 14px;
    font-size: 0.85rem;
    background: none;
    color: var(--color-gray-700);
    border-bottom: 1px solid var(--color-gray-100);
  }

  .search-results button:hover {
    background: var(--color-gray-50);
  }

  .search-results li:last-child button {
    border-bottom: none;
  }

  /* Legend */
  .legend {
    position: absolute;
    bottom: 32px;
    left: 12px;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: white;
    padding: 10px;
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    background: none;
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-gray-700);
    transition: opacity 0.15s;
  }

  .legend-item:hover {
    background: var(--color-gray-50);
  }

  .legend-item.inactive {
    opacity: 0.35;
  }

  .legend-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .legend-label {
    white-space: nowrap;
  }

  /* Hover popup styles — MapLibre popups use global CSS */
  :global(.report-popup) {
    cursor: pointer;
  }

  :global(.report-popup .maplibregl-popup-content) {
    padding: 0;
    border-radius: var(--radius-md);
    overflow: hidden;
    box-shadow: var(--shadow-lg);
    min-width: 200px;
  }

  :global(.popup-link) {
    display: flex;
    gap: 10px;
    padding: 8px;
    color: inherit;
    text-decoration: none;
  }

  :global(.popup-link img) {
    width: 64px;
    height: 64px;
    object-fit: cover;
    border-radius: 6px;
    flex-shrink: 0;
  }

  :global(.popup-info) {
    display: flex;
    flex-direction: column;
    gap: 4px;
    justify-content: center;
    min-width: 0;
  }

  :global(.popup-info strong) {
    font-size: 0.85rem;
  }

  :global(.popup-address) {
    font-size: 0.75rem;
    color: #6b7280;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
