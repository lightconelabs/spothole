<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as m from '$lib/paraglide/messages.js';
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
    address: string | null;
    created_at: string;
  };

  let { reports = [], onMarkerClick = (_r: Report) => {} }: { reports: Report[]; onMarkerClick?: (report: Report) => void } = $props();

  let mapContainer: HTMLDivElement;
  let map: maplibregl.Map;
  let hoverPopup: maplibregl.Popup | null = null;
  let searchQuery: string = $state('');
  let searchResults: Array<{ display_name: string; lat: string; lon: string }> = $state([]);
  let searchTimeout: ReturnType<typeof setTimeout>;

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
    updateFilters();
  }

  function updateFilters() {
    if (!map || !map.getLayer('unclustered-point')) return;

    const activeCats = Object.entries(activeFilters)
      .filter(([_, active]) => active)
      .map(([id]) => id);

    const filterExpr: maplibregl.FilterSpecification = [
      'all',
      ['!', ['has', 'point_count']],
      ['in', ['get', 'category'], ['literal', activeCats]]
    ];

    map.setFilter('unclustered-point', filterExpr);
  }

  async function handleSearch(query: string) {
    if (query.length < 3) {
      searchResults = [];
      return;
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
          { headers: { 'Accept-Language': 'en' } }
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
    geolocate.on('geolocate', (e: any) => {
      saveView();
    });

    map.on('load', () => {
      addReportsToMap(reports);
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

  function addReportsToMap(reps: Report[]) {
    if (!map || !map.loaded()) return;

    if (map.getSource('reports')) {
      map.removeLayer('clusters');
      map.removeLayer('cluster-count');
      map.removeLayer('unclustered-point');
      map.removeSource('reports');
    }

    const geojson: GeoJSON.FeatureCollection = {
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

    // Apply active filters
    updateFilters();

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
      const feature = e.features?.[0];
      if (feature) {
        const report = reps.find((r) => r.id === feature.properties?.id);
        if (report) onMarkerClick(report);
      }
    });

    // Hover popup with thumbnail
    map.on('mouseenter', 'unclustered-point', (e) => {
      map.getCanvas().style.cursor = 'pointer';

      const feature = e.features?.[0];
      if (!feature) return;

      const props = feature.properties!;
      const coords = (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
      const categoryLabel = CATEGORIES.find(c => c.id === props.category)?.label() ?? props.category;

      hoverPopup?.remove();
      // Show short address: take first 2 parts (street + number area) from the full display_name
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
            <img src="${props.photo_url}" alt="${categoryLabel}" />
            <div class="popup-info">
              <strong style="color: ${CATEGORY_COLORS[props.category] || '#6b7280'}">${categoryLabel}</strong>
              ${shortAddress ? `<span class="popup-address">${shortAddress}</span>` : ''}
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
    if (map?.loaded()) {
      addReportsToMap(reports);
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
      onfocus={() => handleSearch(searchQuery)}
      onblur={() => setTimeout(() => searchResults = [], 200)}
    />
    {#if searchResults.length > 0}
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
