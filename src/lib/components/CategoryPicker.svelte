<script lang="ts">
  import * as m from '$lib/paraglide/messages.js';

  let { value = $bindable(''), onSelect = (_c: string) => {} }: { value?: string; onSelect?: (category: string) => void } = $props();

  const categoryLabels: Record<string, () => string> = {
    pothole: m.category_pothole,
    litter: m.category_litter,
    garbage_bin: m.category_garbage_bin,
    graffiti: m.category_graffiti,
    other: m.category_other
  };

  const categories = [
    { id: 'pothole', icon: '🕳️' },
    { id: 'litter', icon: '🗑️' },
    { id: 'garbage_bin', icon: '♻️' },
    { id: 'graffiti', icon: '🎨' },
    { id: 'other', icon: '⚠️' }
  ];
</script>

<div class="category-grid">
  {#each categories as cat}
    <button
      class="category-btn"
      class:selected={value === cat.id}
      onclick={() => { value = cat.id; onSelect(cat.id); }}
    >
      <span class="icon">{cat.icon}</span>
      <span class="label">{categoryLabels[cat.id]?.()}</span>
    </button>
  {/each}
</div>

<style>
  .category-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .category-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 16px 8px;
    border-radius: var(--radius-md);
    background: var(--color-gray-100);
    transition: all 0.15s;
  }

  .category-btn.selected {
    background: var(--color-primary);
    color: white;
    box-shadow: var(--shadow-md);
  }

  .icon {
    font-size: 1.5rem;
  }

  .label {
    font-size: 0.8rem;
    font-weight: 600;
  }
</style>
