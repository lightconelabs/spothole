import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import * as tf from "npm:@tensorflow/tfjs@4.22.0";
import { load, type NSFWJS } from "npm:nsfwjs@4.3.0";
import { decode } from "npm:jpeg-js@0.4.4";

let model: NSFWJS | null = null;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const imageBytes = new Uint8Array(await req.arrayBuffer());

    // Decode JPEG to raw pixel data
    const { width, height, data } = decode(imageBytes, { useTArray: true });

    // Convert RGBA to RGB for TensorFlow
    const numPixels = width * height;
    const rgb = new Uint8Array(numPixels * 3);
    for (let i = 0; i < numPixels; i++) {
      rgb[i * 3] = data[i * 4];
      rgb[i * 3 + 1] = data[i * 4 + 1];
      rgb[i * 3 + 2] = data[i * 4 + 2];
    }

    const tensor = tf.tensor3d(rgb, [height, width, 3]);

    if (!model) {
      model = await load();
    }

    const predictions = await model.classify(tensor);
    tensor.dispose();

    const scores: Record<string, number> = {};
    for (const p of predictions) {
      scores[p.className.toLowerCase()] = p.probability;
    }

    const pornScore = scores["porn"] ?? 0;
    const hentaiScore = scores["hentai"] ?? 0;
    const safe = pornScore <= 0.3 && hentaiScore <= 0.3;

    return new Response(
      JSON.stringify({ safe, reason: safe ? undefined : "nsfw_content" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("NSFW check error:", e);
    // Fail open - allow upload if check fails
    return new Response(JSON.stringify({ safe: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
