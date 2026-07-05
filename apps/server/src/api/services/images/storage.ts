import { ApiError } from "@/api/shared";
import { supabase } from "@/lib/supabase";

/** Sube bytes de imagen a Supabase Storage (bucket público `generated-assets`,
 *  con policy de insert para anon) y devuelve la URL pública permanente.
 *  Providers que devuelven bytes en vez de URL hosteada (gpt-image) dependen
 *  de esto; hostear nosotros también elimina el riesgo de URLs que expiran. */

const BUCKET = "generated-assets";

export const uploadGeneratedImage = async (input: {
  bytes: Uint8Array;
  contentType: string;
  /** Carpeta lógica dentro del bucket, ej. "creatives" o "logos". */
  keyPrefix: string;
}): Promise<string> => {
  const extension = input.contentType.split("/")[1] ?? "png";
  const path = `${input.keyPrefix}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, input.bytes, {
    contentType: input.contentType,
    // El nombre lleva uuid → el objeto es inmutable; cache larga.
    cacheControl: "31536000",
    upsert: false,
  });

  if (error) {
    throw new ApiError(500, `Image upload to storage failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

  if (!data.publicUrl) {
    throw new ApiError(500, "Storage did not return a public URL");
  }

  return data.publicUrl;
};
