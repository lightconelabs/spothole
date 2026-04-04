import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { supabase } = await parent();

  const { data: reports } = await supabase
    .from('reports')
    .select('id, category, description, latitude, longitude, address, photo_url, status, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  return { reports: reports ?? [] };
};
