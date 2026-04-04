import * as m from '$lib/paraglide/messages.js';

export const categoryLabels: Record<string, () => string> = {
  pothole: m.category_pothole,
  litter: m.category_litter,
  garbage_bin: m.category_garbage_bin,
  graffiti: m.category_graffiti,
  other: m.category_other
};

export const statusLabels: Record<string, () => string> = {
  pending: m.status_pending,
  acknowledged: m.status_acknowledged,
  resolved: m.status_resolved
};

export const STATUS_COLORS: Record<string, string> = {
  pending: 'var(--color-warning)',
  acknowledged: 'var(--color-primary)',
  resolved: 'var(--color-success)'
};
