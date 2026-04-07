import type { SupabaseClient } from '@supabase/supabase-js';

export type NsfwResult = {
  safe: boolean;
  reason?: string;
};

export async function checkImage(imageBlob: Blob, supabase: SupabaseClient): Promise<NsfwResult> {
  try {
    const { data, error } = await supabase.functions.invoke('check-nsfw', {
      body: imageBlob
    });

    if (error) {
      console.warn('NSFW check failed, allowing upload:', error);
      return { safe: true };
    }

    return data as NsfwResult;
  } catch (e) {
    console.warn('NSFW check failed, allowing upload:', e);
    return { safe: true };
  }
}
