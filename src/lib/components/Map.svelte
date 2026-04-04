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

    map.on('click', 'clusters', async (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
      const clusterId = features[0]?.properties?.cluster_id;
      const source = map.getSource('reports') as maplibregl.GeoJSONSource;
      const zoom = await source.getClusterExpansionZoom(clusterId);
      map.easeTo({ center: (features[0].geometry as GeoJSON.Point).coordinates as [number, number], zoom });
    });

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
