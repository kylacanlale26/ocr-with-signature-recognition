import { useEffect, useState } from 'react';
import { Download, PenTool } from 'lucide-react';
import type { SignatureBoundingBox } from '../types/ocr';

interface SignatureCropPreviewProps {
  previewUrl: string | null | undefined;
  mimeType: string;
  boundingBox: SignatureBoundingBox;
  signerName: string;
  locationHint: string;
  pageNumber: number;
}

export function SignatureCropPreview({
  previewUrl,
  mimeType,
  boundingBox,
  signerName,
  locationHint,
  pageNumber,
}: SignatureCropPreviewProps) {
  const [croppedDataUrl, setCroppedDataUrl] = useState<string | null>(null);
  const isImage = mimeType.startsWith('image/');

  const hasValidBox =
    boundingBox &&
    Number.isFinite(boundingBox.xmin) &&
    Number.isFinite(boundingBox.ymin) &&
    Number.isFinite(boundingBox.xmax) &&
    Number.isFinite(boundingBox.ymax) &&
    boundingBox.xmax > boundingBox.xmin &&
    boundingBox.ymax > boundingBox.ymin;

  useEffect(() => {
    if (!previewUrl || !isImage || !hasValidBox) {
      setCroppedDataUrl(null);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (!w || !h) return;

      // Expand normalized 0..1000 box slightly (20 units) for clean stroke padding
      const pad = 16;
      const xmin = Math.max(0, boundingBox.xmin - pad);
      const ymin = Math.max(0, boundingBox.ymin - pad);
      const xmax = Math.min(1000, boundingBox.xmax + pad);
      const ymax = Math.min(1000, boundingBox.ymax + pad);

      const sx = Math.floor((xmin / 1000) * w);
      const sy = Math.floor((ymin / 1000) * h);
      const sw = Math.max(16, Math.ceil(((xmax - xmin) / 1000) * w));
      const sh = Math.max(16, Math.ceil(((ymax - ymin) / 1000) * h));

      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, sw, sh);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      try {
        setCroppedDataUrl(canvas.toDataURL('image/png'));
      } catch {
        setCroppedDataUrl(null);
      }
    };
    img.onerror = () => {
      if (!cancelled) setCroppedDataUrl(null);
    };
    img.src = previewUrl;

    return () => {
      cancelled = true;
    };
  }, [previewUrl, isImage, hasValidBox, boundingBox]);

  const handleDownloadCrop = () => {
    if (!croppedDataUrl) return;
    const safeName = signerName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
    const link = document.createElement('a');
    link.href = croppedDataUrl;
    link.download = `signature_${safeName || 'extracted'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!croppedDataUrl) {
    return (
      <div className="h-20 rounded-lg border border-slate-200 bg-slate-50 px-3 flex items-center justify-between gap-2 text-xs text-slate-500">
        <div className="flex items-center gap-2 min-w-0">
          <PenTool className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="truncate">
            Page {pageNumber} · {locationHint || 'Detected signature region'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="h-24 rounded-lg border border-slate-200 bg-white p-2 flex items-center justify-center overflow-hidden">
        <img
          src={croppedDataUrl}
          alt={`Extracted signature of ${signerName}`}
          referrerPolicy="no-referrer"
          className="max-h-full max-w-full object-contain"
        />
      </div>
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={handleDownloadCrop}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap"
        >
          <Download className="w-3 h-3" />
          Download Signature PNG
        </button>
      </div>
    </div>
  );
}
