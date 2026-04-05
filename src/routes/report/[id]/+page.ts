import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, parent }) => {
  const { supabase, session } = await parent();

  const { data: report, error: fetchError } = await supabase
    .from('reports')
    .select('*')
    .eq('id', params.id)
    .single();

  if (fetchError) {
    const status = fetchError.code === 'PGRST116' ? 404 : 500;
    const message = status === 404 ? 'Report not found' : 'Failed to load report';
    throw error(status, message);
  }

  if (!report) throw error(404, 'Report not found');

  // Fetch confirmation count for this report
  const { count: confirmationCount } = await supabase
    .from('resolution_confirmations')
    .select('*', { count: 'exact', head: true })
    .eq('report_id', params.id);

  // Check if the current user has already confirmed
  let userHasConfirmed = false;
  if (session?.user) {
    const { data: existing } = await supabase
      .from('resolution_confirmations')
      .select('id')
      .eq('report_id', params.id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    userHasConfirmed = !!existing;
  }

  return {
    report,
    confirmationCount: confirmationCount ?? 0,
    userHasConfirmed
  };
};
