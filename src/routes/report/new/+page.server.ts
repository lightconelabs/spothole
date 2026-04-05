import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

const VALID_CATEGORIES = ['pothole', 'litter', 'garbage_bin', 'graffiti', 'other'];

export const actions = {
  default: async ({ request, locals: { supabase, safeGetSession } }) => {
    const form = await request.formData();

    const category = form.get('category') as string;
    const description = (form.get('description') as string)?.trim() || null;
    const latitude = parseFloat(form.get('latitude') as string);
    const longitude = parseFloat(form.get('longitude') as string);
    const address = (form.get('address') as string) || null;
    const photoUrl = form.get('photo_url') as string;

    // Validate category
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return fail(400, { error: 'Invalid category' });
    }

    // Validate coordinates
    if (isNaN(latitude) || isNaN(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return fail(400, { error: 'Invalid coordinates' });
    }

    // Validate description length
    if (description && description.length > 500) {
      return fail(400, { error: 'Description too long' });
    }

    // Validate photo URL
    if (!photoUrl) {
      return fail(400, { error: 'Photo is required' });
    }

    const { session, user } = await safeGetSession();

    const { error: insertError } = await supabase.from('reports').insert({
      category,
      description,
      latitude,
      longitude,
      address,
      photo_url: photoUrl,
      user_id: user?.id ?? null
    });

    if (insertError) {
      console.error('Failed to create report:', insertError);
      return fail(500, { error: 'Failed to create report' });
    }

    return { success: true };
  }
} satisfies Actions;
