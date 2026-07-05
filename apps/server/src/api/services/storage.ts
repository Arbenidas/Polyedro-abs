import { ApiError } from "@/api/shared";
import { supabase } from "@/lib/supabase";

/** Sube bytes a Supabase Storage (bucket público `generated-assets`, con policy
 *  de insert para anon) y devuelve la URL pública permanente. Compartido por
 *  imágenes (logo/creativos) y audio (voiceovers): hostear nosotros elimina el
 *  riesgo de URLs de proveedor que expiran. */

const BUCKET = "generated-assets";

export const uploadGeneratedAsset = async (input: {
  bytes: Uint8Array;
  contentType: string;
  /** Carpeta lógica dentro del bucket, ej. "creatives", "logos" o "voiceovers". */
  keyPrefix: string;
  /** Extensión del archivo; si se omite se deriva del contentType. */
  extension?: string;
}): Promise<string> => {
  const extension = input.extension ?? input.contentType.split("/")[1] ?? "bin";
  const path = `${input.keyPrefix}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, input.bytes, {
    contentType: input.contentType,
    // El nombre lleva uuid → el objeto es inmutable; cache larga.
    cacheControl: "31536000",
    upsert: false,
  });

  if (error) {
    throw new ApiError(500, `Asset upload to storage failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

  if (!data.publicUrl) {
    throw new ApiError(500, "Storage did not return a public URL");
  }

  return data.publicUrl;
};
