import { useState, useRef, useCallback } from 'react';
import { uploadImage } from '../../../lib/upload';
import { Upload, Link, X, Loader2, AlertCircle } from 'lucide-react';

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  folder?: string;
}

export function ImageUploader({ value, onChange, folder = 'general' }: ImageUploaderProps) {
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드할 수 있습니다');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const url = await uploadImage(file, folder);
      onChange(url);
    } catch (err: any) {
      const msg = err?.message ?? '업로드에 실패했습니다';
      console.error('Upload error:', msg);
      setError(msg);
    } finally {
      setUploading(false);
    }
  }, [folder, onChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleUrlConfirm = useCallback(() => {
    if (urlInput.trim()) {
      onChange(urlInput.trim());
      setUrlInput('');
    }
  }, [urlInput, onChange]);

  const handleClear = useCallback(() => {
    onChange('');
  }, [onChange]);

  return (
    <div className="img-uploader">
      {value ? (
        <div className="img-uploader-preview">
          <img src={value} alt="미리보기" className="img-uploader-img" />
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
                className="admin-input"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://..."
                onKeyDown={(e) => e.key === 'Enter' && handleUrlConfirm()}
              />
              <button type="button" className="admin-btn admin-btn-primary" onClick={handleUrlConfirm} disabled={!urlInput.trim()}>
                확인
              </button>
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
