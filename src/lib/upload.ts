import { supabaseBrowser as supabase } from './supabase-browser';

const BUCKET = 'images';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

function mapUploadError(message: string): string {
  if (message.includes('Bucket not found')) return '스토리지가 설정되지 않았습니다. 관리자에게 문의하세요.';
  if (message.includes('row-level security')) return '업로드 권한이 없습니다. 다시 로그인해 주세요.';
  if (message.includes('Payload too large')) return '파일이 너무 큽니다.';
  if (message.includes('duplicate')) return '동일한 파일이 이미 존재합니다.';
  return '업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.';
}

export async function uploadImage(file: File, folder: string = 'general'): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('지원하지 않는 파일 형식입니다. JPG, PNG, WebP, GIF, SVG만 업로드할 수 있습니다.');
  }

  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(`파일 크기(${sizeMB}MB)가 제한(10MB)을 초과합니다.`);
  }

  const ext = file.name.split('.').pop() ?? 'jpg';
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    throw new Error(mapUploadError(error.message));
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(fileName);

  if (!urlData.publicUrl || !urlData.publicUrl.startsWith('http')) {
    throw new Error('이미지 URL 생성에 실패했습니다. 스토리지 설정을 확인해 주세요.');
  }

  return urlData.publicUrl;
}

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
