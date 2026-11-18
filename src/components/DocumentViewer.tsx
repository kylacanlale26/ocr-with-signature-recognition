import { useEffect, useRef, useState } from 'react';
import type { MouseEvent, PointerEvent } from 'react';
import {
  Check,
  FileText,
  Image as ImageIcon,
  Maximize2,
  PenTool,
  RotateCcw,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { SignatureComposerModal } from './SignatureComposerModal';
import type { ComposedSignature } from './SignatureComposerModal';
import type { ExtractedSignature } from '../types/ocr';

interface DocumentViewerProps {
  previewUrl: string | null;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  signatures?: ExtractedSignature[];
  hasAppliedSignature?: boolean;
  onApplySignedImage?: (file: File, previewUrl: string) => void;
  onRevertSignature?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function DocumentViewer({
  previewUrl,
  fileName,
  mimeType,
  fileSizeBytes,
  signatures = [],
  hasAppliedSignature = false,
  onApplySignedImage,
  onRevertSignature,
}: DocumentViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [showSignatureBoxes, setShowSignatureBoxes] = useState(true);

  // Signature composer & interactive placement state
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [pendingSignature, setPendingSignature] = useState<ComposedSignature | null>(null);
  const [sigPos, setSigPos] = useState<{ xPct: number; yPct: number }>({ xPct: 68, yPct: 82 });
  const [sigWidthPct, setSigWidthPct] = useState<number>(26);
  const [isApplyingSig, setIsApplyingSig] = useState(false);

  const imageContainerRef = useRef<HTMLDivElement | null>(null);
  const baseImageRef = useRef<HTMLImageElement | null>(null);
  const draggingOverlayRef = useRef(false);

  useEffect(() => {
    setImageError(false);
    setPendingSignature(null);
  }, [previewUrl]);

  const isPdf = mimeType === 'application/pdf';
  const validSignatures = signatures.filter(
    (s) =>
      s.boundingBox &&
      s.boundingBox.xmax > s.boundingBox.xmin &&
      s.boundingBox.ymax > s.boundingBox.ymin,
  );

  const handleConfirmComposedSignature = (sig: ComposedSignature) => {
    setIsComposerOpen(false);
    setPendingSignature(sig);
    setSigPos({ xPct: 68, yPct: 82 });
    setSigWidthPct(26);
    setZoom(1);
    setRotation(0);
  };

  const updateOverlayFromClientPoint = (clientX: number, clientY: number) => {
    const container = imageContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const xPct = Math.max(6, Math.min(94, ((clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(6, Math.min(94, ((clientY - rect.top) / rect.height) * 100));
    setSigPos({ xPct, yPct });
  };

  const handleContainerClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!pendingSignature) return;
    updateOverlayFromClientPoint(e.clientX, e.clientY);
  };

  const handleOverlayPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!pendingSignature) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingOverlayRef.current = true;
  };

  const handleOverlayPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!draggingOverlayRef.current || !pendingSignature) return;
    updateOverlayFromClientPoint(e.clientX, e.clientY);
  };

  const handleOverlayPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!draggingOverlayRef.current) return;
    draggingOverlayRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
  };

  const handleBakeSignatureOntoDocument = async () => {
    if (!pendingSignature || !previewUrl || !onApplySignedImage) return;
    setIsApplyingSig(true);
    try {
      const [baseImg, sigImg] = await Promise.all([
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('Failed to load base document image.'));
          img.src = previewUrl;
        }),
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('Failed to load signature image.'));
          img.src = pendingSignature.dataUrl;
        }),
      ]);

      const w = baseImg.naturalWidth || baseImageRef.current?.naturalWidth || 1200;
      const h = baseImg.naturalHeight || baseImageRef.current?.naturalHeight || 1600;

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable.');

      ctx.drawImage(baseImg, 0, 0, w, h);

      const sigDrawW = (sigWidthPct / 100) * w;
      const aspect = sigImg.naturalHeight && sigImg.naturalWidth
        ? sigImg.naturalHeight / sigImg.naturalWidth
        : 0.35;
      const sigDrawH = sigDrawW * aspect;
      const drawX = Math.max(0, Math.min(w - sigDrawW, (sigPos.xPct / 100) * w - sigDrawW / 2));
      const drawY = Math.max(0, Math.min(h - sigDrawH, (sigPos.yPct / 100) * h - sigDrawH / 2));

      ctx.drawImage(sigImg, drawX, drawY, sigDrawW, sigDrawH);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png'),
      );
      if (!blob) throw new Error('Failed to export signed document image.');

      const baseName = fileName.replace(/\.[^.]+$/, '');
      const signedName = baseName.endsWith('_signed') ? `${baseName}.png` : `${baseName}_signed.png`;
      const signedFile = new File([blob], signedName, { type: 'image/png' });
      const signedUrl = URL.createObjectURL(blob);

      setPendingSignature(null);
      onApplySignedImage(signedFile, signedUrl);
    } finally {
      setIsApplyingSig(false);
    }
  };

  return (
    <>
      <div className="flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-900 truncate">
              {isPdf ? (
                <FileText className="w-4 h-4 text-slate-500 shrink-0" />
              ) : (
                <ImageIcon className="w-4 h-4 text-slate-500 shrink-0" />
              )}
              <span className="truncate">{fileName}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 tabular-nums">
              <span>{mimeType || 'Unknown format'}</span>
              <span aria-hidden="true">·</span>
              <span>{formatBytes(fileSizeBytes)}</span>
            </div>
          </div>

          {!isPdf && previewUrl && !imageError && (
            <div className="flex items-center gap-1 shrink-0 flex-wrap">
              {onApplySignedImage && !pendingSignature && (
                <button
                  type="button"
                  onClick={() => setIsComposerOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 mr-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap shrink-0"
                  title="Draw, type, or upload a signature onto this document"
                >
                  <PenTool className="w-3.5 h-3.5 text-blue-600" />
                  Include Signature
                </button>
              )}

              {hasAppliedSignature && onRevertSignature && !pendingSignature && (
                <button
                  type="button"
                  onClick={onRevertSignature}
                  className="inline-flex items-center gap-1 px-2 py-1.5 mr-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-md transition-colors whitespace-nowrap shrink-0"
                  title="Revert included signature"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Revert
                </button>
              )}

              {validSignatures.length > 0 && !pendingSignature && (
                <button
                  type="button"
                  onClick={() => setShowSignatureBoxes((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 mr-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    showSignatureBoxes
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 border border-transparent'
                  }`}
                  title="Toggle detected signature boxes"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  Detected ({validSignatures.length})
                </button>
              )}
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-blue-600"
                title="Zoom out"
                aria-label="Zoom out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono text-slate-600 tabular-nums w-11 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))))}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-blue-600"
                title="Zoom in"
                aria-label="Zoom in"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-blue-600"
                title="Rotate 90 degrees"
                aria-label="Rotate 90 degrees"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setRotation(0);
                }}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-blue-600"
                title="Reset view"
                aria-label="Reset view"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Interactive Signature Placement Bar */}
        {pendingSignature && (
          <div className="px-4 py-2.5 bg-blue-50/80 border-b border-blue-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs text-blue-950 flex-wrap">
              <span className="font-medium">
                Click or drag signature to position
              </span>
              <label className="inline-flex items-center gap-2 text-xs text-blue-900">
                <span>Size</span>
                <input
                  type="range"
                  min={12}
                  max={55}
                  value={sigWidthPct}
                  onChange={(e) => setSigWidthPct(Number(e.target.value))}
                  className="w-24 accent-blue-600"
                />
                <span className="font-mono tabular-nums w-8">{sigWidthPct}%</span>
              </label>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setPendingSignature(null)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
              <button
                type="button"
                disabled={isApplyingSig}
                onClick={() => void handleBakeSignatureOntoDocument()}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-md transition-colors whitespace-nowrap"
              >
                <Check className="w-3.5 h-3.5" />
                {isApplyingSig ? 'Applying...' : 'Apply Signature'}
              </button>
            </div>
          </div>
        )}

        <div className="relative bg-slate-100/80 min-h-[380px] max-h-[540px] overflow-auto flex items-center justify-center p-4">
          {!previewUrl ? (
            <div className="text-center py-12 px-6">
              <FileText className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-700">No document preview available</p>
              <p className="text-xs text-slate-500 mt-1">
                Upload a PDF, PNG, or JPEG file or select a sample document above.
              </p>
            </div>
          ) : isPdf ? (
            <div className="w-full h-[480px] bg-white border border-slate-200 rounded-lg overflow-hidden">
              <iframe
                src={previewUrl}
                title={`PDF preview of ${fileName}`}
                className="w-full h-full border-0"
              />
            </div>
          ) : imageError ? (
            <div className="flex flex-col items-center justify-center text-center py-12 px-6 bg-slate-50 border border-slate-200 rounded-lg w-full max-w-sm">
              <ImageIcon className="w-10 h-10 text-slate-400 mb-3" />
              <p className="text-sm font-medium text-slate-800">{fileName}</p>
              <p className="text-xs text-slate-500 mt-1">
                Image preview unavailable, but file data can still be processed.
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center min-w-full min-h-full">
              <div
                ref={imageContainerRef}
                onClick={handleContainerClick}
                className={`relative inline-block transition-transform duration-150 origin-center ${
                  pendingSignature ? 'cursor-crosshair' : ''
                }`}
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                }}
              >
                <img
                  ref={baseImageRef}
                  src={previewUrl}
                  alt={`Document scan preview: ${fileName}`}
                  referrerPolicy="no-referrer"
                  onError={() => setImageError(true)}
                  className="block w-auto h-auto max-w-full max-h-[480px] rounded shadow-sm select-none"
                />

                {!pendingSignature &&
                  showSignatureBoxes &&
                  validSignatures.map((sig) => (
                    <div
                      key={sig.id}
                      title={`Signature: ${sig.signerName}`}
                      style={{
                        top: `${sig.boundingBox.ymin / 10}%`,
                        left: `${sig.boundingBox.xmin / 10}%`,
                        width: `${(sig.boundingBox.xmax - sig.boundingBox.xmin) / 10}%`,
                        height: `${(sig.boundingBox.ymax - sig.boundingBox.ymin) / 10}%`,
                      }}
                      className="absolute border-2 border-blue-600 bg-blue-500/10 rounded-xs pointer-events-none"
                    />
                  ))}

                {pendingSignature && (
                  <div
                    onPointerDown={handleOverlayPointerDown}
                    onPointerMove={handleOverlayPointerMove}
                    onPointerUp={handleOverlayPointerUp}
                    onPointerCancel={handleOverlayPointerUp}
                    style={{
                      left: `${sigPos.xPct}%`,
                      top: `${sigPos.yPct}%`,
                      width: `${sigWidthPct}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    className="absolute border-2 border-dashed border-blue-600 bg-blue-50/30 rounded p-1 cursor-move touch-none select-none"
                  >
                    <img
                      src={pendingSignature.dataUrl}
                      alt={`Signature overlay for ${pendingSignature.signerName}`}
                      draggable={false}
                      className="w-full h-auto block pointer-events-none"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <SignatureComposerModal
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
        onConfirm={handleConfirmComposedSignature}
      />
    </>
  );
}
