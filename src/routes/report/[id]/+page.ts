import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, parent }) => {
  const { supabase } = await parent();

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

  return { report };
};
