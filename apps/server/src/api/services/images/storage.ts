import { uploadGeneratedAsset } from "@/api/services/storage";

/** Sube bytes de imagen a Supabase Storage (bucket público `generated-assets`).
 *  Wrapper delgado sobre `uploadGeneratedAsset`: providers que devuelven bytes en
 *  vez de URL hosteada (gpt-image) dependen de esto; hostear nosotros elimina el
 *  riesgo de URLs que expiran. */

export const uploadGeneratedImage = async (input: {
  bytes: Uint8Array;
  contentType: string;
  /** Carpeta lógica dentro del bucket, ej. "creatives" o "logos". */
  keyPrefix: string;
}): Promise<string> =>
  uploadGeneratedAsset({
    bytes: input.bytes,
    contentType: input.contentType,
    keyPrefix: input.keyPrefix,
    extension: input.contentType.split("/")[1] ?? "png",
  });
