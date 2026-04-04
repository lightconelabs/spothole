import type { NSFWJS } from 'nsfwjs';

let model: NSFWJS | null = null;

export async function loadNsfwModel(): Promise<NSFWJS> {
  if (model) return model;

  const nsfwjs = await import('nsfwjs');
  const tf = await import('@tensorflow/tfjs');

  model = await nsfwjs.load();
  return model;
}

export type NsfwResult = {
  safe: boolean;
  reason?: string;
};

export async function checkImage(imageElement: HTMLImageElement): Promise<NsfwResult> {
  try {
    const nsfwModel = await loadNsfwModel();
    const predictions = await nsfwModel.classify(imageElement);

    const scores: Record<string, number> = {};
    for (const p of predictions) {
      scores[p.className.toLowerCase()] = p.probability;
    }

    const pornScore = scores['porn'] ?? 0;
    const hentaiScore = scores['hentai'] ?? 0;

    if (pornScore > 0.3 || hentaiScore > 0.3) {
      return { safe: false, reason: 'nsfw_content' };
    }

    return { safe: true };
  } catch (e) {
    console.warn('NSFW check failed, allowing upload:', e);
    return { safe: true };
  }
}
