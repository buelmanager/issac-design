import { useState, useRef, useCallback, useEffect } from 'react';
import { uploadImage } from '../../../lib/upload';
import { Upload, Link, X, Loader2, AlertCircle, ImageOff } from 'lucide-react';

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  folder?: string;
}

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function ImageUploader({ value, onChange, folder = 'general' }: ImageUploaderProps) {
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [imgError, setImgError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    setImgError(false);
  }, [value]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드할 수 있습니다');
      return;
    }
    setUploading(true);
    setError(null);
    setDragOver(false);
    try {
      const url = await uploadImage(file, folder);
      if (mountedRef.current) onChange(url);
    } catch (err: any) {
      if (mountedRef.current) {
        const msg = err?.message ?? '업로드에 실패했습니다';
        setError(msg);
      }
    } finally {
      if (mountedRef.current) setUploading(false);
    }
  }, [folder, onChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleUrlConfirm = useCallback(() => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if (!isValidUrl(trimmed)) {
      setError('올바른 URL 형식이 아닙니다. http:// 또는 https://로 시작해야 합니다.');
      return;
    }
    setError(null);
    onChange(trimmed);
    setUrlInput('');
  }, [urlInput, onChange]);

  const handleClear = useCallback(() => {
    onChange('');
  }, [onChange]);

  return (
    <div className="img-uploader">
      {value ? (
        <div className="img-uploader-preview">
          {imgError ? (
            <div className="img-uploader-broken">
              <ImageOff size={32} />
              <span>이미지를 불러올 수 없습니다</span>
            </div>
          ) : (
            <img
              src={value}
              alt="미리보기"
              className="img-uploader-img"
              onError={() => setImgError(true)}
            />
          )}
          <button type="button" className="img-uploader-remove" onClick={handleClear}>
            <X size={14} />
          </button>
        </div>
      ) : (
        <>
          <div className="img-uploader-tabs">
            <button
              type="button"
              className={`img-uploader-tab ${mode === 'upload' ? 'img-uploader-tab-active' : ''}`}
              onClick={() => { setMode('upload'); setError(null); }}
            >
              <Upload size={14} /> 파일 업로드
            </button>
            <button
              type="button"
              className={`img-uploader-tab ${mode === 'url' ? 'img-uploader-tab-active' : ''}`}
              onClick={() => { setMode('url'); setError(null); }}
            >
              <Link size={14} /> URL 입력
            </button>
          </div>

          {mode === 'upload' ? (
            <div
              className={`img-uploader-drop ${dragOver ? 'img-uploader-drop-active' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <div className="img-uploader-progress">
                  <Loader2 size={24} className="img-uploader-spinner" />
                  <span>업로드 중...</span>
                </div>
              ) : (
                <>
                  <Upload size={32} className="img-uploader-icon" />
                  <p>클릭 또는 드래그하여 이미지 업로드</p>
                  <p className="img-uploader-hint">JPG, PNG, WebP, GIF, SVG</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = '';
                }}
              />
            </div>
          ) : (
            <div className="img-uploader-url">
              <input
                className={`admin-input${urlInput.trim() && !isValidUrl(urlInput.trim()) ? ' admin-input-invalid' : ''}`}
                value={urlInput}
                onChange={(e) => { setUrlInput(e.target.value); setError(null); }}
                placeholder="https://..."
                onKeyDown={(e) => e.key === 'Enter' && handleUrlConfirm()}
              />
              <button type="button" className="admin-btn admin-btn-primary" onClick={handleUrlConfirm} disabled={!urlInput.trim() || !isValidUrl(urlInput.trim())}>
                확인
              </button>
              {urlInput.trim() && !isValidUrl(urlInput.trim()) && (
                <p className="img-uploader-url-hint">http:// 또는 https://로 시작하는 URL을 입력하세요</p>
              )}
            </div>
          )}

          {error && (
            <div className="img-uploader-error">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
