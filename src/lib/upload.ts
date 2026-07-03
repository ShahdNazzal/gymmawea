import { supabase } from "@/integrations/supabase/client";

/**
 * Upload a file to the "media" bucket under {userId}/{folder}/{filename}
 * Returns a long-lived signed URL (~10 years). Works with private bucket.
 */
export async function uploadFile(
  file: File,
  userId: string,
  folder: "avatars" | "posts" | "workouts" = "posts",
): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${userId}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, file, {
    upsert: false,
    cacheControl: "31536000",
  });
  if (error) throw error;
  const { data, error: sErr } = await supabase.storage
    .from("media")
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (sErr) throw sErr;
  return data.signedUrl;
}
