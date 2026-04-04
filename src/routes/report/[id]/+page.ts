import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, parent }) => {
  const { supabase } = await parent();

  const { data: report, error: fetchError } = await supabase
    .from('reports')
    .select('*')
    .eq('id', params.id)
    .single();

  if (fetchError || !report) throw error(404, 'Report not found');

  return { report };
};
