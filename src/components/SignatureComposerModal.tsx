import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, PointerEvent } from 'react';
import { Eraser, PenTool, Type as TypeIcon, Upload, X } from 'lucide-react';

export interface ComposedSignature {
  dataUrl: string;
  signerName: string;
}

interface SignatureComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (signature: ComposedSignature) => void;
}

type ComposerMode = 'draw' | 'type' | 'upload';

const INK_COLORS = [
  { id: 'blue', label: 'Blue Ink', hex: '#1e3a8a' },
  { id: 'black', label: 'Black Ink', hex: '#0f172a' },
] as const;

function trimCanvasToDataUrl(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 8) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  const pad = 12;
  const sx = Math.max(0, minX - pad);
  const sy = Math.max(0, minY - pad);
  const sw = Math.min(width - sx, maxX - minX + 1 + pad * 2);
  const sh = Math.min(height - sy, maxY - minY + 1 + pad * 2);

  const out = document.createElement('canvas');
  out.width = sw;
  out.height = sh;
  const outCtx = out.getContext('2d');
  if (!outCtx) return null;
  outCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return out.toDataURL('image/png');
}

export function SignatureComposerModal({
  isOpen,
  onClose,
  onConfirm,
}: SignatureComposerModalProps) {
  const [mode, setMode] = useState<ComposerMode>('draw');
  const [inkHex, setInkHex] = useState<string>(INK_COLORS[0].hex);
  const [signerName, setSignerName] = useState<string>('');
  const [hasDrawn, setHasDrawn] = useState(false);

  // Typed mode state
  const [typedText, setTypedText] = useState<string>('');
  const [typedDate, setTypedDate] = useState<string>(() => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${mm}/${dd}/${now.getFullYear()}`;
  });
  const [includeDateUnderTyped, setIncludeDateUnderTyped] = useState(false);

  // Upload mode state
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const [removeWhiteBg, setRemoveWhiteBg] = useState(true);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setUploadError(null);
  }, [isOpen]);

  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const getCanvasPoint = (e: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const point = getCanvasPoint(e);
    isDrawingRef.current = true;
    lastPointRef.current = point;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = inkHex;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 1.8, 0, Math.PI * 2);
      ctx.fill();
      setHasDrawn(true);
    }
  };

  const handlePointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !lastPointRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const next = getCanvasPoint(e);
    ctx.strokeStyle = inkHex;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
    lastPointRef.current = next;
    setHasDrawn(true);
  };

  const handlePointerUp = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPointRef.current = null;
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture already released
    }
  };

  const handleUploadChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a PNG, JPEG, or WebP signature image.');
      return;
    }
    setUploadError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setUploadedPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const buildTypedSignatureDataUrl = (): string | null => {
    const text = typedText.trim();
    if (!text) return null;

    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = includeDateUnderTyped && typedDate.trim() ? 200 : 150;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = inkHex;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.font = 'italic 54px "Georgia", "Times New Roman", serif';
    ctx.fillText(text, canvas.width / 2, 72);

    if (includeDateUnderTyped && typedDate.trim()) {
      ctx.font = '500 22px "JetBrains Mono", monospace';
      ctx.fillText(`Date: ${typedDate.trim()}`, canvas.width / 2, 146);
    }

    return trimCanvasToDataUrl(canvas);
  };

  const buildUploadedSignatureDataUrl = async (): Promise<string | null> => {
    if (!uploadedPreview) return null;
    if (!removeWhiteBg) return uploadedPreview;

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 400;
        canvas.height = img.naturalHeight || 160;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(uploadedPreview);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i];
          const g = d[i + 1];
          const b = d[i + 2];
          if (r > 225 && g > 225 && b > 225) {
            d[i + 3] = 0;
          }
        }
        ctx.putImageData(imgData, 0, 0);
        resolve(trimCanvasToDataUrl(canvas) || canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(uploadedPreview);
      img.src = uploadedPreview;
    });
  };

  const handleConfirm = async () => {
    if (mode === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const trimmed = trimCanvasToDataUrl(canvas);
      if (!trimmed) return;
      onConfirm({
        dataUrl: trimmed,
        signerName: signerName.trim() || 'Authorized Signer',
      });
      return;
    }

    if (mode === 'type') {
      const dataUrl = buildTypedSignatureDataUrl();
      if (!dataUrl) return;
      onConfirm({
        dataUrl,
        signerName: signerName.trim() || typedText.trim(),
      });
      return;
    }

    const uploadedUrl = await buildUploadedSignatureDataUrl();
    if (!uploadedUrl) return;
    onConfirm({
      dataUrl: uploadedUrl,
      signerName: signerName.trim() || 'Uploaded Signature',
    });
  };

  if (!isOpen) return null;

  const canConfirm =
    (mode === 'draw' && hasDrawn) ||
    (mode === 'type' && typedText.trim().length > 0) ||
    (mode === 'upload' && Boolean(uploadedPreview));

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signature-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg overflow-hidden shadow-lg">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PenTool className="w-4 h-4 text-blue-600" />
            <h3 id="signature-modal-title" className="text-sm font-semibold text-slate-900">
              Include Signature on Document
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
            aria-label="Close signature dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Mode Tabs */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'draw', label: 'Draw', icon: PenTool },
                  { id: 'type', label: 'Type', icon: TypeIcon },
                  { id: 'upload', label: 'Upload Image', icon: Upload },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setMode(tab.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      mode === tab.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {mode !== 'upload' && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">Ink:</span>
                {INK_COLORS.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => setInkHex(color.hex)}
                    className={`px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${
                      inkHex === color.hex
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {color.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {mode === 'draw' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Sign inside the pad below using mouse or touch</span>
                <button
                  type="button"
                  onClick={handleClearCanvas}
                  className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  Clear
                </button>
              </div>
              <div className="relative border border-slate-200 rounded-lg bg-slate-50/50 overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={520}
                  height={180}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  className="w-full h-40 touch-none cursor-crosshair block"
                />
                <div className="pointer-events-none absolute inset-x-6 bottom-7 border-b border-dashed border-slate-300" />
              </div>
            </div>
          )}

          {mode === 'type' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="typed-sig-name" className="block text-xs font-medium text-slate-700">
                    Full Name / Signature Text
                  </label>
                  <input
                    id="typed-sig-name"
                    type="text"
                    value={typedText}
                    onChange={(e) => setTypedText(e.target.value)}
                    placeholder="e.g. Dr. Sarah Bennett"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="typed-sig-date" className="block text-xs font-medium text-slate-700">
                    Date Stamp (optional)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="typed-sig-date"
                      type="text"
                      value={typedDate}
                      disabled={!includeDateUnderTyped}
                      onChange={(e) => setTypedDate(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:border-blue-600"
                    />
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 whitespace-nowrap shrink-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeDateUnderTyped}
                        onChange={(e) => setIncludeDateUnderTyped(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                      />
                      Include
                    </label>
                  </div>
                </div>
              </div>

              <div className="h-28 border border-slate-200 rounded-lg bg-slate-50/50 flex flex-col items-center justify-center px-4 text-center">
                {typedText.trim() ? (
                  <>
                    <span
                      className="text-3xl italic font-serif tracking-wide"
                      style={{ color: inkHex }}
                    >
                      {typedText}
                    </span>
                    {includeDateUnderTyped && typedDate.trim() && (
                      <span className="text-xs font-mono mt-1" style={{ color: inkHex }}>
                        Date: {typedDate}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-slate-400">
                    Signature preview will appear here
                  </span>
                )}
              </div>
            </div>
          )}

          {mode === 'upload' && (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleUploadChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border border-dashed border-slate-300 hover:border-slate-400 rounded-lg p-5 flex flex-col items-center justify-center gap-1.5 text-xs text-slate-600 bg-slate-50/50 transition-colors"
              >
                <Upload className="w-5 h-5 text-slate-500" />
                <span className="font-medium text-slate-800">
                  Click to upload signature image (PNG, JPEG, WebP)
                </span>
              </button>

              {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}

              {uploadedPreview && (
                <div className="space-y-2">
                  <div className="h-24 border border-slate-200 rounded-lg bg-white p-2 flex items-center justify-center overflow-hidden">
                    <img
                      src={uploadedPreview}
                      alt="Uploaded signature preview"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={removeWhiteBg}
                      onChange={(e) => setRemoveWhiteBg(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                    />
                    Make light paper background transparent
                  </label>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1 pt-2 border-t border-slate-100">
            <label htmlFor="signer-label-input" className="block text-xs font-medium text-slate-700">
              Signer Name / Role Label (optional)
            </label>
            <input
              id="signer-label-input"
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="e.g. Approved By — Jordan Blake"
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50/60 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => void handleConfirm()}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 rounded-lg transition-colors"
          >
            Place on Document
          </button>
        </div>
      </div>
    </div>
  );
}
