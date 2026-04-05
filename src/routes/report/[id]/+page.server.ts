import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

const RESOLUTION_THRESHOLD = 3;

export const actions = {
  confirm_resolved: async ({ params, locals: { supabase, safeGetSession } }) => {
    const { session, user } = await safeGetSession();

    if (!user) {
      return fail(401, { error: 'You must be signed in to confirm a resolution.' });
    }

    // Check the report exists and isn't already resolved
    const { data: report } = await supabase
      .from('reports')
      .select('status')
      .eq('id', params.id)
      .single();

    if (!report) {
      return fail(404, { error: 'Report not found.' });
    }

    if (report.status === 'resolved') {
      return fail(400, { error: 'This report is already resolved.' });
    }

    // Insert confirmation (unique constraint prevents duplicates)
    const { error: insertError } = await supabase
      .from('resolution_confirmations')
      .insert({ report_id: params.id, user_id: user.id });

    if (insertError) {
      // Unique violation = user already confirmed
      if (insertError.code === '23505') {
        return fail(400, { error: 'You have already confirmed this resolution.' });
      }
      console.error('Failed to insert confirmation:', insertError);
      return fail(500, { error: 'Could not record your confirmation.' });
    }

    return { confirmed: true };
  }
} satisfies Actions;
