export interface ImageTransformOptions {
  width?: number;
  quality?: number;
}

export interface ResponsiveImageOptions {
  widths?: number[];
  sizes?: string;
  quality?: number;
}

export interface SupabaseImageOptions {
  bucket: string;
  path: string;
}

const SUPABASE_PROJECT_URL = import.meta.env.PUBLIC_SUPABASE_URL as string;
const DEFAULT_WIDTHS = [320, 640, 768, 1024, 1280, 1536];
const DEFAULT_QUALITY = 75;

/**
 * @example
 * getSupabasePublicUrl('images', 'products/hero.jpg')
 * // → "https://xxx.supabase.co/storage/v1/object/public/images/products/hero.jpg"
 */
export function getSupabasePublicUrl(bucket: string, path: string): string {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${SUPABASE_PROJECT_URL}/storage/v1/object/public/${bucket}/${cleanPath}`;
}

/**
 * @example
 * getOptimizedUrl('https://xxx.supabase.co/.../hero.jpg', { width: 800 })
 * // → "/_vercel/image?url=https%3A%2F%2F...&w=800&q=75"
 */
export function getOptimizedUrl(
  sourceUrl: string,
  options: ImageTransformOptions = {},
): string {
  const { width, quality = DEFAULT_QUALITY } = options;

  const params = new URLSearchParams();
  params.set('url', sourceUrl);
  if (width) params.set('w', width.toString());
  params.set('q', quality.toString());

  return `/_vercel/image?${params.toString()}`;
}

/** @example getSupabaseOptimizedUrl({ bucket: 'images', path: 'hero.jpg' }, { width: 800 }) */
export function getSupabaseOptimizedUrl(
  image: SupabaseImageOptions,
  options: ImageTransformOptions = {},
): string {
  const publicUrl = getSupabasePublicUrl(image.bucket, image.path);
  return getOptimizedUrl(publicUrl, options);
}

/** @example generateSrcset('https://xxx.supabase.co/.../hero.jpg', { widths: [640, 1024] }) */
export function generateSrcset(
  sourceUrl: string,
  options: ResponsiveImageOptions = {},
): string {
  const { widths = DEFAULT_WIDTHS, quality = DEFAULT_QUALITY } = options;

  return widths
    .sort((a, b) => a - b)
    .map((w) => {
      const url = getOptimizedUrl(sourceUrl, { width: w, quality });
      return `${url} ${w}w`;
    })
    .join(', ');
}

/** @example generateSupabaseSrcset({ bucket: 'images', path: 'hero.jpg' }, { widths: [640, 1024] }) */
export function generateSupabaseSrcset(
  image: SupabaseImageOptions,
  options: ResponsiveImageOptions = {},
): string {
  const publicUrl = getSupabasePublicUrl(image.bucket, image.path);
  return generateSrcset(publicUrl, options);
}


export function isDev(): boolean {
  return import.meta.env.DEV;
}


export function getImageUrl(
  sourceUrl: string,
  options: ImageTransformOptions = {},
): string {
  if (isDev()) {
    return sourceUrl;
  }
  return getOptimizedUrl(sourceUrl, options);
}


export function getSupabaseImageUrl(
  image: SupabaseImageOptions,
  options: ImageTransformOptions = {},
): string {
  const publicUrl = getSupabasePublicUrl(image.bucket, image.path);
  return getImageUrl(publicUrl, options);
}
