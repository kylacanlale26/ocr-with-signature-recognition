import { useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileCode2,
  FileSearch,
  HelpCircle,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { SignatureCropPreview } from './SignatureCropPreview';
import type { OcrDocumentResult, RuleStatus, VerificationVerdict } from '../types/ocr';

interface ResultInspectorProps {
  result: OcrDocumentResult | null;
  previewUrl?: string | null;
  isProcessing: boolean;
  error: string | null;
  onRetry?: () => void;
}

type InspectorTab = 'extracted' | 'verification' | 'raw' | 'json';

function getVerdictDisplay(status: VerificationVerdict) {
  switch (status) {
    case 'verified':
      return {
        label: 'Verified',
        icon: ShieldCheck,
        containerClass: 'bg-emerald-50/70 border-emerald-200 text-emerald-950',
        iconClass: 'text-emerald-600',
        statusTextClass: 'text-emerald-700',
      };
    case 'needs_review':
      return {
        label: 'Needs Review',
        icon: AlertTriangle,
        containerClass: 'bg-amber-50/70 border-amber-200 text-amber-950',
        iconClass: 'text-amber-600',
        statusTextClass: 'text-amber-700',
      };
    case 'flagged':
      return {
        label: 'Flagged',
        icon: ShieldAlert,
        containerClass: 'bg-red-50/70 border-red-200 text-red-950',
        iconClass: 'text-red-600',
        statusTextClass: 'text-red-700',
      };
  }
}

function getRuleStatusDisplay(status: RuleStatus) {
  switch (status) {
    case 'passed':
      return {
        label: 'Passed',
        icon: CheckCircle2,
        textClass: 'text-emerald-700',
      };
    case 'failed':
      return {
        label: 'Failed',
        icon: XCircle,
        textClass: 'text-red-700',
      };
    case 'inconclusive':
      return {
        label: 'Inconclusive',
        icon: HelpCircle,
        textClass: 'text-amber-700',
      };
  }
}

function formatSourceLabel(sourceType: string): string {
  switch (sourceType) {
    case 'handwritten':
      return 'Handwritten';
    case 'printed':
      return 'Printed';
    case 'stamp':
      return 'Ink Stamp';
    case 'signature':
      return 'Signature';
    default:
      return 'Inferred';
  }
}

function formatSignatureType(sigType: string): string {
  switch (sigType) {
    case 'handwritten_ink':
      return 'Handwritten Ink';
    case 'digital_signature':
      return 'Digital Signature';
    case 'initials':
      return 'Initials';
    case 'electronic_typed':
      return 'Electronic Typed';
    default:
      return sigType.replace(/_/g, ' ');
  }
}

export function ResultInspector({
  result,
  previewUrl,
  isProcessing,
  error,
  onRetry,
}: ResultInspectorProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('extracted');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [includeSignaturesInTxt, setIncludeSignaturesInTxt] = useState(true);

  const handleCopy = async (content: string, key: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // Clipboard blocked in restricted context
    }
  };

  const handleDownload = (content: string, fileName: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (isProcessing) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="space-y-2">
            <div className="h-5 w-48 bg-slate-200 rounded animate-pulse" />
            <div className="h-3.5 w-72 bg-slate-100 rounded animate-pulse" />
          </div>
          <div className="h-8 w-36 bg-slate-100 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="h-16 bg-slate-50 border border-slate-100 rounded-lg animate-pulse" />
          <div className="h-16 bg-slate-50 border border-slate-100 rounded-lg animate-pulse" />
          <div className="h-16 bg-slate-50 border border-slate-100 rounded-lg animate-pulse" />
        </div>
        <div className="space-y-2.5">
          <div className="h-10 bg-slate-50 rounded animate-pulse" />
          <div className="h-10 bg-slate-100/70 rounded animate-pulse" />
          <div className="h-10 bg-slate-50 rounded animate-pulse" />
          <div className="h-10 bg-slate-100/70 rounded animate-pulse" />
          <div className="h-10 bg-slate-50 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-red-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-slate-900">Document Processing Error</h3>
            <p className="text-sm text-slate-700 leading-relaxed">{error}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-2 px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Retry Request
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 flex flex-col items-center justify-center text-center min-h-[460px]">
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-4">
          <FileSearch className="w-6 h-6 text-slate-500" />
        </div>
        <h3 className="text-base font-semibold text-slate-900">Ready to Extract and Verify</h3>
        <p className="text-sm text-slate-600 max-w-md mt-2 leading-relaxed">
          Select a sample document or upload any PDF, PNG, or JPEG file. VeriDoc will transcribe printed and handwritten text, parse tables, and audit your verification rules.
        </p>
      </div>
    );
  }

  const verdict = getVerdictDisplay(result.verification.overallStatus);
  const VerdictIcon = verdict.icon;
  const formattedJson = JSON.stringify(result, null, 2);
  const signatures = result.extraction.signatures || [];
  const rawTranscriptWithSignatures = (() => {
    const base = result.extraction.rawText || '';
    if (!includeSignaturesInTxt || signatures.length === 0) {
      return base;
    }
    const sigLines = signatures.map((sig, idx) => {
      const datePart = sig.signedDate ? ` | Date: ${sig.signedDate}` : '';
      const rolePart = sig.roleOrLabel ? ` (${sig.roleOrLabel})` : '';
      return `${idx + 1}. ${sig.signerName}${rolePart} [${formatSignatureType(sig.signatureType)}${datePart} | Page ${sig.pageNumber} | Confidence ${Math.round(sig.confidence)}%]`;
    });
    return `${base ? `${base}\n\n` : ''}--- EXTRACTED SIGNATURES (${signatures.length}) ---\n${sigLines.join('\n')}`;
  })();

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
      {/* Top Result Summary & Segmented Tab Switcher */}
      <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-semibold text-slate-900 capitalize truncate">
              {result.documentClassification.documentType.replace(/_/g, ' ')}
            </h3>
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${verdict.statusTextClass}`}>
              <VerdictIcon className="w-3.5 h-3.5 shrink-0" />
              {verdict.label}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1 tabular-nums">
            <span>{result.requestId}</span>
            <span aria-hidden="true">·</span>
            <span>{result.durationMs} ms</span>
            <span aria-hidden="true">·</span>
            <span>Confidence {Math.round(result.verification.confidenceScore)}%</span>
            <span aria-hidden="true">·</span>
            <span>Legibility {Math.round(result.documentClassification.legibilityScore)}%</span>
            {result.documentClassification.containsHandwriting && (
              <>
                <span aria-hidden="true">·</span>
                <span>Handwriting Detected</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
          {(
            [
              { id: 'extracted', label: 'Extracted Data' },
              { id: 'verification', label: 'Verification Audit' },
              { id: 'raw', label: 'Raw Text' },
              { id: 'json', label: 'API JSON' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-5 space-y-6">
        {activeTab === 'extracted' && (
          <>
            {/* Summary & Document Signals */}
            <div className="space-y-3">
              <p className="text-sm text-slate-700 leading-relaxed">
                {result.documentClassification.summary}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 border-t border-slate-100 pt-3 tabular-nums">
                <span>
                  Languages: <strong className="font-medium text-slate-800">{result.documentClassification.languages.join(', ') || 'Unknown'}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Pages: <strong className="font-medium text-slate-800">{result.documentClassification.estimatedPages}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Signatures: <strong className="font-medium text-slate-800">{result.documentClassification.containsSignatures ? 'Present' : 'None'}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Stamps/Seals: <strong className="font-medium text-slate-800">{result.documentClassification.containsStamps ? 'Present' : 'None'}</strong>
                </span>
              </div>
            </div>

            {/* Handwriting Transcript Highlight (if present) */}
            {result.extraction.handwritingTranscript && (
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/70 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold text-slate-900">
                    Handwriting & Ink Transcription
                  </h4>
                  <button
                    type="button"
                    onClick={() => handleCopy(result.extraction.handwritingTranscript, 'handwriting')}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0"
                  >
                    {copiedKey === 'handwriting' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedKey === 'handwriting' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {result.extraction.handwritingTranscript}
                </pre>
              </div>
            )}

            {/* Extracted Signatures */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900">Extracted Signatures</h4>
                <span className="text-xs text-slate-500 tabular-nums">
                  {(result.extraction.signatures || []).length} detected
                </span>
              </div>

              {(!result.extraction.signatures || result.extraction.signatures.length === 0) ? (
                <p className="text-xs text-slate-500 py-4 border border-slate-200 rounded-lg text-center">
                  No handwritten or digital signatures detected in this document.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {result.extraction.signatures.map((sig, idx) => (
                    <div
                      key={sig.id || `sig-${idx}`}
                      className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/50 space-y-3"
                    >
                      <SignatureCropPreview
                        previewUrl={previewUrl}
                        mimeType={result.mimeType}
                        boundingBox={sig.boundingBox}
                        signerName={sig.signerName}
                        locationHint={sig.locationHint}
                        pageNumber={sig.pageNumber}
                      />

                      <div className="space-y-1 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900 truncate">
                            {sig.signerName}
                          </span>
                          <span className="font-mono tabular-nums text-slate-600 shrink-0">
                            {Math.round(sig.confidence)}%
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-slate-600">
                          <span>{sig.roleOrLabel || 'Signer'}</span>
                          <span aria-hidden="true">·</span>
                          <span>{formatSignatureType(sig.signatureType)}</span>
                          {sig.signedDate && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">{sig.signedDate}</span>
                            </>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-slate-500">
                          <span className="truncate">{sig.locationHint}</span>
                          <span
                            className={`font-medium shrink-0 ${
                              sig.matchesPrintedName === 'matched'
                                ? 'text-emerald-700'
                                : sig.matchesPrintedName === 'mismatch'
                                ? 'text-red-700'
                                : 'text-slate-500'
                            }`}
                          >
                            {sig.matchesPrintedName === 'matched'
                              ? 'Matches Printed Name'
                              : sig.matchesPrintedName === 'mismatch'
                              ? 'Name Mismatch'
                              : 'No Printed Reference'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Structured Key-Value Fields Table */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900">Structured Fields</h4>
                <span className="text-xs text-slate-500 tabular-nums">
                  {result.extraction.fields.length} fields extracted
                </span>
              </div>

              {result.extraction.fields.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 border border-slate-200 rounded-lg text-center">
                  No structured key-value fields detected in this document.
                </p>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
                        <th className="py-2.5 px-3.5">Field</th>
                        <th className="py-2.5 px-3.5">Extracted Value</th>
                        <th className="py-2.5 px-3.5">Origin</th>
                        <th className="py-2.5 px-3.5 text-right">Confidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {result.extraction.fields.map((field, index) => (
                        <tr key={`${field.key}-${index}`} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3.5 font-medium text-slate-700 align-top">
                            {field.key}
                          </td>
                          <td className="py-2.5 px-3.5 text-slate-900 font-mono align-top break-words max-w-[260px]">
                            {field.value}
                          </td>
                          <td className="py-2.5 px-3.5 text-slate-600 align-top whitespace-nowrap">
                            {formatSourceLabel(field.sourceType)}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-slate-700 align-top">
                            {Math.round(field.confidence)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Extracted Tables */}
            {result.extraction.tables.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-900">Extracted Tables</h4>
                {result.extraction.tables.map((table, tIdx) => (
                  <div key={`${table.title}-${tIdx}`} className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-800">
                      {table.title || `Table ${tIdx + 1}`}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 font-medium bg-white">
                            {table.headers.map((header, hIdx) => (
                              <th key={hIdx} className="py-2 px-3.5 whitespace-nowrap">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {table.rows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-slate-50/70">
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} className="py-2 px-3.5 text-slate-800 font-mono tabular-nums">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'verification' && (
          <>
            {/* Verdict Summary Box */}
            <div className={`border rounded-lg p-4 flex items-start gap-3 ${verdict.containerClass}`}>
              <VerdictIcon className={`w-5 h-5 shrink-0 mt-0.5 ${verdict.iconClass}`} />
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">
                    Verification Outcome: {verdict.label}
                  </span>
                  <span aria-hidden="true" className="opacity-50">·</span>
                  <span className="text-xs font-mono tabular-nums">
                    Confidence {Math.round(result.verification.confidenceScore)}%
                  </span>
                  <span aria-hidden="true" className="opacity-50">·</span>
                  <span className="text-xs tabular-nums">
                    {signatures.length > 0
                      ? `${signatures.length} signature${signatures.length > 1 ? 's' : ''} verified`
                      : 'No signatures detected'}
                  </span>
                </div>
                <p className="text-sm leading-relaxed opacity-90">
                  {result.verification.verdictSummary}
                </p>
              </div>
            </div>

            {/* Anomaly Flags */}
            {result.verification.anomalyFlags.length > 0 && (
              <div className="border border-red-200 bg-red-50/40 rounded-lg p-4 space-y-2">
                <h4 className="text-xs font-semibold text-red-900">
                  Detected Anomalies & Discrepancies
                </h4>
                <ul className="space-y-1.5 text-xs text-red-800 list-disc pl-4">
                  {result.verification.anomalyFlags.map((flag, i) => (
                    <li key={i}>{flag}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Verification Checks Table */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900">Audit & Rule Checks</h4>
                <span className="text-xs text-slate-500 tabular-nums">
                  {result.verification.checks.filter((c) => c.status === 'passed').length} of {result.verification.checks.length} passed
                </span>
              </div>

              <div className="border border-slate-200 rounded-lg divide-y divide-slate-200">
                {result.verification.checks.map((check, idx) => {
                  const statusMeta = getRuleStatusDisplay(check.status);
                  const StatusIcon = statusMeta.icon;
                  return (
                    <div key={idx} className="p-4 space-y-1.5">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 min-w-0">
                          <StatusIcon className={`w-4 h-4 shrink-0 ${statusMeta.textClass}`} />
                          <span className="text-sm font-medium text-slate-900 truncate">
                            {check.checkName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs shrink-0">
                          <span className="text-slate-500 capitalize">
                            {check.category.replace(/_/g, ' ')}
                          </span>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span className={`font-semibold ${statusMeta.textClass}`}>
                            {statusMeta.label}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed pl-6">
                        {check.detail}
                      </p>
                      {check.evidence && (
                        <p className="text-xs font-mono text-slate-500 pl-6">
                          Evidence: {check.evidence}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {activeTab === 'raw' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Verbatim OCR Transcript</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Full extracted text preserving reading order and document blocks.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none mr-1">
                  <input
                    type="checkbox"
                    checked={includeSignaturesInTxt}
                    onChange={(e) => setIncludeSignaturesInTxt(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                  />
                  Include signatures
                </label>
                <button
                  type="button"
                  onClick={() => handleCopy(rawTranscriptWithSignatures, 'raw')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  {copiedKey === 'raw' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === 'raw' ? 'Copied' : 'Copy Text'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleDownload(
                      rawTranscriptWithSignatures,
                      `${result.fileName.replace(/\.[^.]+$/, '')}_ocr.txt`,
                      'text/plain',
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download TXT
                </button>
              </div>
            </div>

            <pre className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed max-h-[420px] overflow-auto">
              {rawTranscriptWithSignatures || 'No text content extracted.'}
            </pre>

            {result.extraction.blocks.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-800">
                  Detected Layout Regions ({result.extraction.blocks.length})
                </h4>
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-[260px] overflow-auto">
                  {result.extraction.blocks.map((block) => (
                    <div key={block.id} className="px-3.5 py-2.5 flex items-start justify-between gap-4 text-xs">
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-slate-500 font-medium capitalize">
                          {block.blockType} · {Math.round(block.confidence)}% confidence
                        </div>
                        <div className="text-slate-900 font-mono whitespace-pre-wrap">
                          {block.text}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'json' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <FileCode2 className="w-4 h-4 text-slate-500" />
                <span>HTTP 200 JSON payload from POST /api/v1/ocr/process</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopy(formattedJson, 'json')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  {copiedKey === 'json' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === 'json' ? 'Copied' : 'Copy JSON'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleDownload(
                      formattedJson,
                      `${result.requestId}.json`,
                      'application/json',
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download JSON
                </button>
              </div>
            </div>
            <pre className="p-4 bg-slate-950 text-slate-100 rounded-lg text-xs font-mono overflow-auto max-h-[500px] leading-relaxed">
              {formattedJson}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
