<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as m from '$lib/paraglide/messages.js';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import maplibregl from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';

  let {
    latitude = $bindable(50.8503),
    longitude = $bindable(4.3517),
    address = $bindable('')
  }: { latitude?: number; longitude?: number; address?: string } = $props();

  let mapContainer: HTMLDivElement;
  let map: maplibregl.Map;
  let marker: maplibregl.Marker;
  let mapReady = $state(false);

  function initMap(center: [number, number], zoom: number) {
    map = new maplibregl.Map({
      container: mapContainer,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center,
      zoom
    });

    marker = new maplibregl.Marker({ draggable: true, color: '#2563eb' })
      .setLngLat(center)
      .addTo(map);

    marker.on('dragend', () => {
      const lngLat = marker.getLngLat();
      latitude = lngLat.lat;
      longitude = lngLat.lng;
      reverseGeocode(latitude, longitude);
    });

    map.on('click', (e) => {
      latitude = e.lngLat.lat;
      longitude = e.lngLat.lng;
      marker.setLngLat([longitude, latitude]);
      reverseGeocode(latitude, longitude);
    });

    reverseGeocode(center[1], center[0]);
    mapReady = true;
  }

  onMount(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          latitude = pos.coords.latitude;
          longitude = pos.coords.longitude;
          initMap([longitude, latitude], 16);
        },
        () => {
          initMap([longitude, latitude], 15);
        }
      );
    } else {
      initMap([longitude, latitude], 15);
    }
  });

  onDestroy(() => {
    map?.remove();
  });

  async function reverseGeocode(lat: number, lng: number) {
    try {
      const locale = getLocale();
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': locale } }
      );
      const data = await res.json();
      address = data.display_name || '';
    } catch {
      address = '';
    }
  }
</script>

<div class="location-picker">
  <div class="map-container" bind:this={mapContainer}>
    {#if !mapReady}
      <div class="map-loading">
        <span>{m.report_location_hint()}</span>
      </div>
    {/if}
  </div>
  {#if mapReady}
    <p class="hint">{m.report_location_hint()}</p>
  {/if}
  {#if address}
    <p class="address">{address}</p>
  {/if}
</div>

<style>
  .location-picker {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .map-container {
    width: 100%;
    height: 250px;
    border-radius: var(--radius-md);
    overflow: hidden;
    position: relative;
  }

  .map-loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-gray-100);
    color: var(--color-gray-500);
    font-size: 0.85rem;
    z-index: 1;
  }

  .hint {
    font-size: 0.8rem;
    color: var(--color-gray-500);
  }

  .address {
    font-size: 0.85rem;
    color: var(--color-gray-700);
  }
</style>
