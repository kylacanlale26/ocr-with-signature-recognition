import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import {
  BookOpen,
  FileCheck2,
  History,
  Menu,
  Play,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { ApiDocsView } from './components/ApiDocsView';
import { DocumentViewer } from './components/DocumentViewer';
import { LedgerView } from './components/LedgerView';
import { ResultInspector } from './components/ResultInspector';
import { SAMPLE_DOCUMENTS } from './data/samples';
import type {
  LedgerEntry,
  OcrDocumentResult,
  ProcessingMode,
  SampleDocumentPreset,
} from './types/ocr';

type WorkspaceView = 'workbench' | 'api' | 'ledger';

const ACCEPTED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

export default function App() {
  const [activeView, setActiveView] = useState<WorkspaceView>('workbench');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Active Document Input State
  const [selectedSample, setSelectedSample] = useState<SampleDocumentPreset | null>(
    SAMPLE_DOCUMENTS[0],
  );
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(SAMPLE_DOCUMENTS[0].imageUrl);
  const [fileName, setFileName] = useState<string>(SAMPLE_DOCUMENTS[0].fileName);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [fileSizeBytes, setFileSizeBytes] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);

  // Processing Config
  const [mode, setMode] = useState<ProcessingMode>('extract_and_verify');
  const [includeSignatures, setIncludeSignatures] = useState<boolean>(true);
  const [verificationRules, setVerificationRules] = useState<string[]>(
    SAMPLE_DOCUMENTS[0].defaultRules,
  );
  const [newRuleDraft, setNewRuleDraft] = useState<string>('');
  const [customFieldsInput, setCustomFieldsInput] = useState<string>(
    SAMPLE_DOCUMENTS[0].defaultCustomFields.join(', '),
  );
  const [languageHint, setLanguageHint] = useState<string>('');

  // Signed Document Snapshot (for Revert)
  const [hasAppliedSignature, setHasAppliedSignature] = useState(false);
  const unsignedSnapshotRef = useRef<{
    selectedSample: SampleDocumentPreset | null;
    uploadedFile: File | null;
    previewUrl: string | null;
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
  } | null>(null);

  // Processing Output State
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OcrDocumentResult | null>(null);

  // Ledger History & Session Previews
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [isLedgerLoading, setIsLedgerLoading] = useState(false);
  const previewCacheRef = useRef<Map<string, string>>(new Map());

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const revokeObjectUrl = () => {
    if (objectUrlRef.current) {
      const isCached = Array.from(previewCacheRef.current.values()).includes(objectUrlRef.current);
      if (!isCached) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      objectUrlRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      previewCacheRef.current.forEach((url) => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, []);

  // Load sample image byte size on selection for accurate metadata display
  useEffect(() => {
    if (!selectedSample || uploadedFile) return;
    let cancelled = false;
    fetch(selectedSample.imageUrl)
      .then((r) => r.blob())
      .then((blob) => {
        if (!cancelled) {
          setFileSizeBytes(blob.size);
          setMimeType(blob.type || 'image/jpeg');
        }
      })
      .catch(() => {
        // Keep fallback metadata
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSample, uploadedFile]);

  const fetchLedger = useCallback(async () => {
    setIsLedgerLoading(true);
    try {
      const resp = await fetch('/api/v1/ocr/history');
      if (resp.ok) {
        const data = (await resp.json()) as { entries: LedgerEntry[] };
        setLedgerEntries(data.entries || []);
      }
    } catch {
      // Ignore transient ledger fetch failure
    } finally {
      setIsLedgerLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLedger();
  }, [fetchLedger]);

  const handleSelectSample = (sample: SampleDocumentPreset) => {
    revokeObjectUrl();
    unsignedSnapshotRef.current = null;
    setHasAppliedSignature(false);
    setUploadedFile(null);
    setSelectedSample(sample);
    setPreviewUrl(sample.imageUrl);
    setFileName(sample.fileName);
    setMimeType('image/jpeg');
    setVerificationRules(sample.defaultRules);
    setCustomFieldsInput(sample.defaultCustomFields.join(', '));
    setError(null);
    setResult(null);
  };

  const applyUploadedFile = (file: File) => {
    const lowerName = file.name.toLowerCase();
    const validExt =
      lowerName.endsWith('.pdf') ||
      lowerName.endsWith('.png') ||
      lowerName.endsWith('.jpg') ||
      lowerName.endsWith('.jpeg') ||
      lowerName.endsWith('.webp');

    if (!ACCEPTED_MIME_TYPES.has(file.type) && !validExt) {
      setError('Unsupported file type. Please upload a PDF, PNG, JPEG, or WebP document.');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError('File size exceeds the 20 MB maximum limit.');
      return;
    }

    revokeObjectUrl();
    unsignedSnapshotRef.current = null;
    setHasAppliedSignature(false);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;

    const resolvedMime =
      file.type ||
      (lowerName.endsWith('.pdf')
        ? 'application/pdf'
        : lowerName.endsWith('.png')
        ? 'image/png'
        : lowerName.endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg');

    setSelectedSample(null);
    setUploadedFile(file);
    setPreviewUrl(url);
    setFileName(file.name);
    setMimeType(resolvedMime);
    setFileSizeBytes(file.size);
    setError(null);
    setResult(null);
  };

  const handleApplySignedImage = (signedFile: File, signedPreviewUrl: string) => {
    if (!hasAppliedSignature) {
      unsignedSnapshotRef.current = {
        selectedSample,
        uploadedFile,
        previewUrl,
        fileName,
        mimeType,
        fileSizeBytes,
      };
    } else {
      revokeObjectUrl();
    }

    objectUrlRef.current = signedPreviewUrl;
    setSelectedSample(null);
    setUploadedFile(signedFile);
    setPreviewUrl(signedPreviewUrl);
    setFileName(signedFile.name);
    setMimeType(signedFile.type || 'image/png');
    setFileSizeBytes(signedFile.size);
    setHasAppliedSignature(true);
    setError(null);
    setResult(null);
  };

  const handleRevertSignature = () => {
    const snap = unsignedSnapshotRef.current;
    if (!snap) return;
    revokeObjectUrl();
    setSelectedSample(snap.selectedSample);
    setUploadedFile(snap.uploadedFile);
    setPreviewUrl(snap.previewUrl);
    setFileName(snap.fileName);
    setMimeType(snap.mimeType);
    setFileSizeBytes(snap.fileSizeBytes);
    if (snap.previewUrl && snap.previewUrl.startsWith('blob:')) {
      objectUrlRef.current = snap.previewUrl;
    }
    unsignedSnapshotRef.current = null;
    setHasAppliedSignature(false);
    setError(null);
    setResult(null);
  };

  const handleAddRule = () => {
    const trimmed = newRuleDraft.trim();
    if (!trimmed) return;
    setVerificationRules((prev) => [...prev, trimmed]);
    setNewRuleDraft('');
  };

  const handleRemoveRule = (index: number) => {
    setVerificationRules((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      applyUploadedFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      applyUploadedFile(file);
    }
  };

  const handleProcessDocument = async () => {
    if (!uploadedFile && !selectedSample) {
      setError('Please upload a document or select a sample before processing.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      let fileToSend: File;
      if (uploadedFile) {
        fileToSend = uploadedFile;
      } else if (selectedSample) {
        const resp = await fetch(selectedSample.imageUrl);
        if (!resp.ok) {
          throw new Error('Failed to load sample document bytes.');
        }
        const blob = await resp.blob();
        fileToSend = new File([blob], selectedSample.fileName, {
          type: blob.type || 'image/jpeg',
        });
      } else {
        throw new Error('No document selected.');
      }

      const customFields = customFieldsInput
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean);

      const formData = new FormData();
      formData.append('file', fileToSend);
      formData.append('mode', mode);
      formData.append('includeSignatures', String(includeSignatures));
      formData.append(
        'verificationRules',
        JSON.stringify(verificationRules.map((r) => r.trim()).filter(Boolean)),
      );
      formData.append('customFields', JSON.stringify(customFields));
      if (languageHint.trim()) {
        formData.append('language', languageHint.trim());
      }

      const submitResp = await fetch('/api/v1/ocr/jobs', {
        method: 'POST',
        body: formData,
      });

      const submitPayload = await submitResp.json();
      if (!submitResp.ok) {
        const msg = submitPayload.hint
          ? `${submitPayload.error} ${submitPayload.hint}`
          : submitPayload.error || `Request failed with HTTP ${submitResp.status}`;
        throw new Error(msg);
      }

      const jobId = submitPayload.jobId as string;
      const maxWaitMs = 120_000;
      const startedAt = Date.now();
      let consecutiveNetworkErrors = 0;

      while (Date.now() - startedAt < maxWaitMs) {
        await new Promise((resolve) => setTimeout(resolve, 800));

        let pollResp: Response;
        try {
          pollResp = await fetch(`/api/v1/ocr/jobs/${encodeURIComponent(jobId)}`);
          consecutiveNetworkErrors = 0;
        } catch (netErr) {
          consecutiveNetworkErrors += 1;
          if (consecutiveNetworkErrors >= 4) {
            throw netErr;
          }
          continue;
        }

        const jobData = await pollResp.json();
        if (!pollResp.ok) {
          throw new Error(jobData.error || `Job status check failed (HTTP ${pollResp.status})`);
        }

        if (jobData.status === 'completed' && jobData.result) {
          const ocrResult = jobData.result as OcrDocumentResult;
          if (previewUrl) {
            previewCacheRef.current.set(ocrResult.requestId, previewUrl);
          }
          setResult(ocrResult);
          void fetchLedger();
          return;
        }

        if (jobData.status === 'failed') {
          const msg = jobData.hint
            ? `${jobData.error} ${jobData.hint}`
            : jobData.error || 'Document OCR and verification failed.';
          throw new Error(msg);
        }
      }

      throw new Error('Document processing exceeded the 2-minute timeout window. Please try again.');
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'Unexpected processing error.';
      if (rawMessage === 'Failed to fetch') {
        setError('Unable to reach the OCR server. Please confirm the app is running and retry.');
      } else {
        setError(rawMessage);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInspectLedgerEntry = (entryResult: OcrDocumentResult) => {
    revokeObjectUrl();
    unsignedSnapshotRef.current = null;
    setHasAppliedSignature(false);
    setUploadedFile(null);
    setSelectedSample(null);
    const cachedPreview =
      previewCacheRef.current.get(entryResult.requestId) ||
      SAMPLE_DOCUMENTS.find((s) => s.fileName === entryResult.fileName)?.imageUrl ||
      null;
    setPreviewUrl(cachedPreview);
    setFileName(entryResult.fileName);
    setMimeType(entryResult.mimeType);
    setFileSizeBytes(entryResult.fileSizeBytes);
    setResult(entryResult);
    setError(null);
    setActiveView('workbench');
  };

  const handleClearLedger = async () => {
    try {
      await fetch('/api/v1/ocr/history', { method: 'DELETE' });
      setLedgerEntries([]);
    } catch {
      // Ignore error
    }
  };

  const breadcrumbLabel =
    activeView === 'workbench'
      ? 'Document Workbench'
      : activeView === 'api'
      ? 'API Reference'
      : 'Request Ledger';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Sidebar (256px) */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-150 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div>
          {/* Brand Zone (single line wordmark) */}
          <div className="h-14 px-5 border-b border-slate-200 flex items-center justify-between">
            <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
              VeriDoc
            </span>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-1.5 text-slate-500 hover:text-slate-900 lg:hidden"
              aria-label="Close navigation"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Primary Navigation */}
          <nav className="p-3 space-y-1">
            <button
              type="button"
              onClick={() => {
                setActiveView('workbench');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                activeView === 'workbench'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileCheck2 className="w-4 h-4 shrink-0" />
              Document Workbench
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveView('api');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                activeView === 'api'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              API Reference
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveView('ledger');
                setMobileMenuOpen(false);
                void fetchLedger();
              }}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                activeView === 'ledger'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <History className="w-4 h-4 shrink-0" />
                Request Ledger
              </span>
              <span
                className={`text-xs font-mono tabular-nums ${
                  activeView === 'ledger' ? 'text-slate-300' : 'text-slate-400'
                }`}
              >
                {ledgerEntries.length}
              </span>
            </button>
          </nav>
        </div>

        {/* Supported Capabilities Footer Info */}
        <div className="p-4 border-t border-slate-200 space-y-2 text-xs text-slate-500">
          <div className="font-semibold text-slate-700">Supported Formats</div>
          <div className="space-y-1 leading-relaxed">
            <div>PDF documents (.pdf)</div>
            <div>Images (.png, .jpg, .jpeg, .webp)</div>
            <div>Handwritten notes & signatures</div>
            <div className="font-mono tabular-nums text-slate-400 pt-1">Max upload: 20 MB</div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb on left, Primary action on right */}
        <header className="sticky top-0 z-20 h-14 bg-white border-b border-slate-200 px-5 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-2 text-slate-600 hover:text-slate-900 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0 truncate">
              <span className="text-slate-400">Workspace</span>
              <span className="text-slate-300">/</span>
              <span className="font-medium text-slate-900 truncate">{breadcrumbLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {activeView === 'workbench' ? (
              <button
                type="button"
                disabled={isProcessing || (!uploadedFile && !selectedSample)}
                onClick={() => void handleProcessDocument()}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Play className="w-3.5 h-3.5" />
                {isProcessing ? 'Processing...' : 'Run OCR & Verify'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveView('workbench')}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Open Workbench
              </button>
            )}
          </div>
        </header>

        {/* Viewport Container */}
        <main className="flex-1 p-5 lg:p-6 max-w-[1440px] w-full mx-auto">
          {activeView === 'workbench' && (
            <div className="space-y-6">
              {/* Sample & Upload Bar */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                {/* Dropzone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  className={`lg:col-span-4 border rounded-xl p-4 flex items-center gap-3.5 cursor-pointer transition-colors ${
                    isDragging
                      ? 'border-blue-600 bg-blue-50/70'
                      : 'border-dashed border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/60'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <Upload className="w-5 h-5 text-slate-700" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">
                      Upload PDF, PNG, or JPEG
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 truncate">
                      {uploadedFile ? `Active: ${uploadedFile.name}` : 'Drop file here or click to browse'}
                    </div>
                  </div>
                </div>

                {/* 3 One-Click Sample Document Cards */}
                <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {SAMPLE_DOCUMENTS.map((sample) => {
                    const isActive = !uploadedFile && selectedSample?.id === sample.id;
                    return (
                      <button
                        key={sample.id}
                        type="button"
                        onClick={() => handleSelectSample(sample)}
                        className={`text-left p-3.5 rounded-xl border transition-colors flex flex-col justify-between ${
                          isActive
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-900 border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                        }`}
                      >
                        <div className="space-y-1">
                          <div
                            className={`text-xs ${
                              isActive ? 'text-slate-300' : 'text-slate-500'
                            }`}
                          >
                            {sample.category} · {sample.formatLabel}
                          </div>
                          <div className="text-sm font-semibold leading-snug">
                            {sample.title}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2-Column Main Workbench Split */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                {/* Left Column: Document Viewer + Verification Rules & Mode Config */}
                <div className="xl:col-span-5 space-y-5">
                  <DocumentViewer
                    previewUrl={previewUrl}
                    fileName={fileName}
                    mimeType={mimeType}
                    fileSizeBytes={fileSizeBytes}
                    signatures={result?.extraction.signatures}
                    hasAppliedSignature={hasAppliedSignature}
                    onApplySignedImage={handleApplySignedImage}
                    onRevertSignature={handleRevertSignature}
                  />

                  {/* Extraction & Verification Config */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-slate-900">
                        Processing Mode & Rules
                      </h3>
                      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                        {(
                          [
                            { id: 'extract_and_verify', label: 'Extract & Verify' },
                            { id: 'ocr_only', label: 'OCR Only' },
                            { id: 'verify_only', label: 'Verify Only' },
                          ] as const
                        ).map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setMode(m.id)}
                            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                              mode === m.id
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Signature Extraction & Verification Toggle */}
                    <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
                      <label
                        htmlFor="include-signatures-toggle"
                        className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none"
                      >
                        <input
                          id="include-signatures-toggle"
                          type="checkbox"
                          checked={includeSignatures}
                          onChange={(e) => setIncludeSignatures(e.target.checked)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                        />
                        Include signature extraction & verification
                      </label>
                      <span className="text-xs text-slate-400">
                        {includeSignatures ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>

                    {/* Verification Rules */}
                    <div className="space-y-2 pt-3 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-700">
                          Verification Rules
                        </span>
                        <span className="text-xs text-slate-400 tabular-nums">
                          {verificationRules.length} active
                        </span>
                      </div>

                      {verificationRules.length > 0 && (
                        <div className="space-y-1.5">
                          {verificationRules.map((rule, idx) => (
                            <div
                              key={`${idx}-${rule}`}
                              className="flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                            >
                              <span className="truncate">{rule}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveRule(idx)}
                                className="p-0.5 text-slate-400 hover:text-red-600 shrink-0"
                                aria-label="Remove verification rule"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newRuleDraft}
                          onChange={(e) => setNewRuleDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddRule();
                            }
                          }}
                          placeholder="Add rule (e.g. Verify signature and date are present)"
                          className="flex-1 min-w-0 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
                        />
                        <button
                          type="button"
                          onClick={handleAddRule}
                          disabled={!newRuleDraft.trim()}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Rule
                        </button>
                      </div>
                    </div>

                    {/* Target Fields & Language Hint */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                      <div className="space-y-1">
                        <label
                          htmlFor="target-fields-input"
                          className="block text-xs font-medium text-slate-700"
                        >
                          Priority Fields (comma-separated)
                        </label>
                        <input
                          id="target-fields-input"
                          type="text"
                          value={customFieldsInput}
                          onChange={(e) => setCustomFieldsInput(e.target.value)}
                          placeholder="Invoice Number, Total, Date"
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
                        />
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor="language-hint-input"
                          className="block text-xs font-medium text-slate-700"
                        >
                          Language Hint (optional)
                        </label>
                        <input
                          id="language-hint-input"
                          type="text"
                          value={languageHint}
                          onChange={(e) => setLanguageHint(e.target.value)}
                          placeholder="Auto-detect"
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Extracted OCR + Verification Inspector */}
                <div className="xl:col-span-7">
                  <ResultInspector
                    result={result}
                    previewUrl={previewUrl}
                    isProcessing={isProcessing}
                    error={error}
                    onRetry={() => void handleProcessDocument()}
                  />
                </div>
              </div>
            </div>
          )}

          {activeView === 'api' && <ApiDocsView />}

          {activeView === 'ledger' && (
            <LedgerView
              entries={ledgerEntries}
              isLoading={isLedgerLoading}
              onSelectResult={handleInspectLedgerEntry}
              onClearHistory={() => void handleClearLedger()}
              onGoToWorkbench={() => setActiveView('workbench')}
            />
          )}
        </main>
      </div>
    </div>
  );
}
