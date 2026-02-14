import { supabase } from './supabase';

const BUCKET = 'images';

/**
 * Upload a file to Supabase Storage and return the public URL.
 */
export async function uploadImage(file: File, folder: string = 'general'): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    throw new Error(`업로드 실패: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

/**
 * Delete an image from Supabase Storage by its public URL.
 */
export async function deleteImage(url: string): Promise<void> {
  const { data: { publicUrl: baseUrl } } = supabase.storage
    .from(BUCKET)
    .getPublicUrl('');

  if (!url.startsWith(baseUrl)) return;

  const path = url.replace(baseUrl, '');
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([path]);

  if (error) {
    console.error('이미지 삭제 실패:', error.message);
  }
}
