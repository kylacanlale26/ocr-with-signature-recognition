import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type { LedgerEntry, OcrDocumentResult, VerificationVerdict } from '../types/ocr';

interface LedgerViewProps {
  entries: LedgerEntry[];
  isLoading: boolean;
  onSelectResult: (result: OcrDocumentResult) => void;
  onClearHistory: () => void;
  onGoToWorkbench: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return isoString;
  }
}

function VerdictLabel({ status }: { status: VerificationVerdict }) {
  if (status === 'verified') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
        Verified
      </span>
    );
  }
  if (status === 'needs_review') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        Needs Review
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700">
      <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
      Flagged
    </span>
  );
}

export function LedgerView({
  entries,
  isLoading,
  onSelectResult,
  onClearHistory,
  onGoToWorkbench,
}: LedgerViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | VerificationVerdict>('all');

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return entries.filter((entry) => {
      if (statusFilter !== 'all' && entry.overallStatus !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        entry.fileName.toLowerCase().includes(q) ||
        entry.documentType.toLowerCase().includes(q) ||
        entry.requestId.toLowerCase().includes(q) ||
        entry.mimeType.toLowerCase().includes(q) ||
        (entry.result.extraction.signatures || []).some((sig) =>
          sig.signerName.toLowerCase().includes(q),
        )
      );
    });
  }, [entries, searchQuery, statusFilter]);

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        <div className="h-9 bg-slate-100 rounded-lg animate-pulse w-64" />
        <div className="h-11 bg-slate-50 rounded animate-pulse" />
        <div className="h-11 bg-slate-100/60 rounded animate-pulse" />
        <div className="h-11 bg-slate-50 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by file name, type, or request ID..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'verified', label: 'Verified' },
                { id: 'needs_review', label: 'Needs Review' },
                { id: 'flagged', label: 'Flagged' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {entries.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-red-700 bg-white border border-slate-200 hover:border-red-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Ledger
            </button>
          )}
        </div>
      </div>

      {/* Data Table or Empty State */}
      {entries.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <h3 className="text-base font-semibold text-slate-900">No Processed Documents Yet</h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto mt-1.5">
            Every document processed via the Workbench or REST API endpoints appears in this session ledger with verification verdicts and latency metrics.
          </p>
          <button
            type="button"
            onClick={onGoToWorkbench}
            className="mt-5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap"
          >
            Process First Document
          </button>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <p className="text-sm font-medium text-slate-800">No matching documents found</p>
          <p className="text-xs text-slate-500 mt-1">
            Adjust your search query or status filter.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4">Document</th>
                  <th className="py-3 px-4">Classification</th>
                  <th className="py-3 px-4">Format & Size</th>
                  <th className="py-3 px-4">Verification</th>
                  <th className="py-3 px-4 text-right">Confidence</th>
                  <th className="py-3 px-4 text-right">Latency</th>
                  <th className="py-3 px-4 text-right">Processed</th>
                  <th className="py-3 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredEntries.map((entry) => (
                  <tr
                    key={entry.requestId}
                    onClick={() => onSelectResult(entry.result)}
                    className="hover:bg-slate-50/90 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{entry.fileName}</div>
                      <div className="font-mono text-slate-500 mt-0.5">{entry.requestId}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 capitalize">
                      <div>{entry.documentType.replace(/_/g, ' ')}</div>
                      {(() => {
                        const sigCount =
                          entry.signatureCount ??
                          entry.result.extraction.signatures?.length ??
                          0;
                        const parts: string[] = [];
                        if (sigCount > 0) {
                          parts.push(`${sigCount} signature${sigCount > 1 ? 's' : ''}`);
                        }
                        if (entry.containsHandwriting) {
                          parts.push('Handwriting');
                        }
                        return parts.length > 0 ? (
                          <div className="text-slate-500 normal-case">
                            {parts.join(' · ')}
                          </div>
                        ) : null;
                      })()}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono tabular-nums">
                      {entry.mimeType} · {formatBytes(entry.fileSizeBytes)}
                    </td>
                    <td className="py-3 px-4">
                      <VerdictLabel status={entry.overallStatus} />
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800">
                      {Math.round(entry.confidenceScore)}%
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                      {entry.durationMs} ms
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500">
                      {formatTime(entry.processedAt)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="inline-flex items-center gap-1 text-blue-600 font-medium">
                        Open
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
