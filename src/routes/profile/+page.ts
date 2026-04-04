import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { supabase, session } = await parent();

  if (!session || session.user?.is_anonymous) {
    return { user: null, reports: [] };
  }

  const { data: reports } = await supabase
    .from('reports')
    .select('id, category, status, created_at, photo_url')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  return { user: session.user, reports: reports ?? [] };
};
