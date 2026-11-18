import { useEffect, useState } from 'react';
import { Check, Copy, Play, RefreshCw, Terminal } from 'lucide-react';
import { SAMPLE_DOCUMENTS } from '../data/samples';

interface HealthPayload {
  status: string;
  service: string;
  model: string;
  supportedFormats: string[];
  maxFileSizeBytes: number;
  endpoints: Array<{
    method: string;
    path: string;
    description: string;
  }>;
}

type CodeLanguage = 'curl' | 'typescript' | 'python';
type PayloadFormat = 'multipart' | 'json';

export function ApiDocsView() {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('/api/v1/ocr/process');
  const [codeLang, setCodeLang] = useState<CodeLanguage>('curl');
  const [payloadFormat, setPayloadFormat] = useState<PayloadFormat>('multipart');
  const [copiedCode, setCopiedCode] = useState(false);

  // Live API Tester state
  const [testSampleId, setTestSampleId] = useState<string>(SAMPLE_DOCUMENTS[1].id);
  const [testRules, setTestRules] = useState<string>(
    SAMPLE_DOCUMENTS[1].defaultRules.join('\n'),
  );
  const [testIncludeSignatures, setTestIncludeSignatures] = useState<boolean>(true);
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<number | null>(null);
  const [testDurationMs, setTestDurationMs] = useState<number | null>(null);
  const [testResponse, setTestResponse] = useState<string>('');

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  const loadHealth = async () => {
    setHealthError(null);
    try {
      const res = await fetch('/api/v1/health');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as HealthPayload;
      setHealth(data);
    } catch (err) {
      setHealthError(err instanceof Error ? err.message : 'Unable to reach /api/v1/health');
    }
  };

  useEffect(() => {
    void loadHealth();
  }, []);

  const buildSnippet = (): string => {
    const endpointUrl = `${origin}${selectedEndpoint}`;
    if (codeLang === 'curl') {
      if (payloadFormat === 'multipart') {
        return `curl -X POST "${endpointUrl}" \\
  -F "file=@./invoice.pdf" \\
  -F "mode=extract_and_verify" \\
  -F "includeSignatures=true" \\
  -F 'verificationRules=["Verify total matches line items","Verify signature is present"]' \\
  -F 'customFields=["Invoice Number","Total Amount","Vendor Name"]'`;
      }
      return `BASE64_DOC=$(base64 -w 0 ./document.png)

curl -X POST "${endpointUrl}" \\
  -H "Content-Type: application/json" \\
  -d "{
    \\"fileName\\": \\"document.png\\",
    \\"mimeType\\": \\"image/png\\",
    \\"fileBase64\\": \\"$BASE64_DOC\\",
    \\"mode\\": \\"extract_and_verify\\",
    \\"includeSignatures\\": true,
    \\"verificationRules\\": [\\"Verify signature is present\\"]
  }"`;
    }

    if (codeLang === 'typescript') {
      if (payloadFormat === 'multipart') {
        return `const formData = new FormData();
formData.append("file", fileInput.files[0]); // PDF, PNG, JPEG, or WebP
formData.append("mode", "extract_and_verify");
formData.append("includeSignatures", "true");
formData.append("verificationRules", JSON.stringify([
  "Verify line items sum to subtotal",
  "Verify signature is present"
]));
formData.append("customFields", JSON.stringify([
  "Document ID",
  "Total Amount"
]));

const response = await fetch("${endpointUrl}", {
  method: "POST",
  body: formData,
});

const result = await response.json();
console.log(result.verification.overallStatus, result.extraction.signatures);`;
      }
      return `import fs from "node:fs";

const fileBase64 = fs.readFileSync("./handwritten_note.jpg").toString("base64");

const response = await fetch("${endpointUrl}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    fileName: "handwritten_note.jpg",
    mimeType: "image/jpeg",
    fileBase64,
    mode: "extract_and_verify",
    includeSignatures: true,
    verificationRules: ["Confirm legible date and physician signature"]
  }),
});

const result = await response.json();
console.log(result.extraction.handwritingTranscript, result.extraction.signatures);`;
    }

    // Python
    if (payloadFormat === 'multipart') {
      return `import json
import requests

url = "${endpointUrl}"
with open("document.pdf", "rb") as doc:
    files = {"file": ("document.pdf", doc, "application/pdf")}
    data = {
        "mode": "extract_and_verify",
        "includeSignatures": "true",
        "verificationRules": json.dumps([
            "Verify total matches subtotal plus tax",
            "Verify approval signature is present"
        ]),
    }
    resp = requests.post(url, files=files, data=data)

print(resp.status_code)
print(resp.json())`;
    }

    return `import base64
import requests

with open("scan.png", "rb") as f:
    encoded = base64.b64encode(f.read()).decode("utf-8")

resp = requests.post(
    "${endpointUrl}",
    json={
        "fileName": "scan.png",
        "mimeType": "image/png",
        "fileBase64": encoded,
        "mode": "extract_and_verify",
        "includeSignatures": True,
        "verificationRules": ["Verify document date and signature are present"],
    },
)
print(resp.json())`;
  };

  const snippet = buildSnippet();

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleSampleChange = (id: string) => {
    setTestSampleId(id);
    const preset = SAMPLE_DOCUMENTS.find((s) => s.id === id);
    if (preset) {
      setTestRules(preset.defaultRules.join('\n'));
    }
  };

  const handleRunLiveApiTest = async () => {
    const preset = SAMPLE_DOCUMENTS.find((s) => s.id === testSampleId) || SAMPLE_DOCUMENTS[0];
    setIsTesting(true);
    setTestStatus(null);
    setTestDurationMs(null);
    setTestResponse('');
    const started = performance.now();

    try {
      const imgResp = await fetch(preset.imageUrl);
      const blob = await imgResp.blob();
      const file = new File([blob], preset.fileName, { type: blob.type || 'image/jpeg' });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('verificationRules', testRules);
      formData.append('customFields', JSON.stringify(preset.defaultCustomFields));
      formData.append('includeSignatures', String(testIncludeSignatures));

      const submitResp = await fetch(`${selectedEndpoint}?async=true`, {
        method: 'POST',
        body: formData,
      });

      const submitPayload = await submitResp.json();
      if (!submitResp.ok || !submitPayload.jobId) {
        setTestStatus(submitResp.status);
        setTestDurationMs(Math.round(performance.now() - started));
        setTestResponse(JSON.stringify(submitPayload, null, 2));
        return;
      }

      const jobId = submitPayload.jobId as string;
      const deadline = Date.now() + 120_000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        const pollResp = await fetch(`/api/v1/ocr/jobs/${encodeURIComponent(jobId)}`);
        const pollPayload = await pollResp.json();

        if (!pollResp.ok) {
          setTestStatus(pollResp.status);
          setTestDurationMs(Math.round(performance.now() - started));
          setTestResponse(JSON.stringify(pollPayload, null, 2));
          return;
        }

        if (pollPayload.status === 'completed' && pollPayload.result) {
          setTestStatus(200);
          setTestDurationMs(Math.round(performance.now() - started));
          setTestResponse(JSON.stringify(pollPayload.result, null, 2));
          return;
        }

        if (pollPayload.status === 'failed') {
          setTestStatus(pollPayload.statusCode || 500);
          setTestDurationMs(Math.round(performance.now() - started));
          setTestResponse(
            JSON.stringify(
              {
                error: pollPayload.error,
                ...(pollPayload.hint ? { hint: pollPayload.hint } : {}),
              },
              null,
              2,
            ),
          );
          return;
        }
      }

      setTestStatus(504);
      setTestDurationMs(Math.round(performance.now() - started));
      setTestResponse(JSON.stringify({ error: 'Request timed out waiting for job completion.' }, null, 2));
    } catch (err) {
      setTestStatus(500);
      setTestDurationMs(Math.round(performance.now() - started));
      setTestResponse(
        JSON.stringify(
          { error: err instanceof Error ? err.message : 'Request failed' },
          null,
          2,
        ),
      );
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Service Capabilities Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-slate-900">
            REST API Endpoints & Schema Reference
          </h2>
          {health ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 tabular-nums">
              <span>Service: {health.service}</span>
              <span aria-hidden="true">·</span>
              <span>Formats: PDF, PNG, JPEG, WebP</span>
              <span aria-hidden="true">·</span>
              <span>Max payload: {Math.round(health.maxFileSizeBytes / (1024 * 1024))} MB</span>
              <span aria-hidden="true">·</span>
              <span>Accepts multipart/form-data & base64 JSON</span>
            </div>
          ) : healthError ? (
            <p className="text-xs text-red-600">Health check failed: {healthError}</p>
          ) : (
            <p className="text-xs text-slate-500">Checking endpoint availability...</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => void loadHealth()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Check Health
        </button>
      </div>

      {/* Two-Column API Explorer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Endpoint Selector & Code Generator */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70">
              <h3 className="text-sm font-semibold text-slate-900">Available Routes</h3>
            </div>
            <div className="divide-y divide-slate-200">
              {[
                {
                  method: 'POST',
                  path: '/api/v1/ocr/process',
                  description: 'Full OCR extraction, handwriting transcription, table parsing, and AI rule verification.',
                },
                {
                  method: 'POST',
                  path: '/api/v1/ocr/extract',
                  description: 'Focused verbatim OCR, structured key-value extraction, and layout region parsing.',
                },
                {
                  method: 'POST',
                  path: '/api/v1/ocr/verify',
                  description: 'Audit document integrity, math consistency, signatures, and custom verification rules.',
                },
                {
                  method: 'GET',
                  path: '/api/v1/ocr/history',
                  description: 'Retrieve recent session document scans and verification results.',
                },
              ].map((ep) => {
                const isSelected = selectedEndpoint === ep.path;
                const isPost = ep.method === 'POST';
                return (
                  <button
                    key={ep.path}
                    type="button"
                    disabled={!isPost}
                    onClick={() => isPost && setSelectedEndpoint(ep.path)}
                    className={`w-full text-left px-5 py-3.5 flex items-start justify-between gap-4 transition-colors ${
                      isSelected
                        ? 'bg-blue-50/50'
                        : isPost
                        ? 'hover:bg-slate-50'
                        : 'opacity-80 cursor-default'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2.5 font-mono text-xs">
                        <span
                          className={`font-semibold ${
                            ep.method === 'POST' ? 'text-blue-700' : 'text-emerald-700'
                          }`}
                        >
                          {ep.method}
                        </span>
                        <span className="text-slate-900 font-medium">{ep.path}</span>
                      </div>
                      <p className="text-xs text-slate-600">{ep.description}</p>
                    </div>
                    {isPost && (
                      <span
                        className={`text-xs font-medium shrink-0 ${
                          isSelected ? 'text-blue-700' : 'text-slate-400'
                        }`}
                      >
                        {isSelected ? 'Selected' : 'Select'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Code Snippet Box */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(
                  [
                    { id: 'curl', label: 'cURL' },
                    { id: 'typescript', label: 'TypeScript' },
                    { id: 'python', label: 'Python' },
                  ] as const
                ).map((lang) => (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => setCodeLang(lang.id)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      codeLang === lang.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setPayloadFormat('multipart')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      payloadFormat === 'multipart'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Multipart File
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayloadFormat('json')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      payloadFormat === 'json'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Base64 JSON
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => void handleCopySnippet()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  {copiedCode ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedCode ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <pre className="p-5 bg-slate-950 text-slate-100 text-xs font-mono overflow-x-auto leading-relaxed">
              {snippet}
            </pre>
          </div>
        </div>

        {/* Right: Live Endpoint Runner */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-slate-600" />
              <h3 className="text-sm font-semibold text-slate-900">Live Endpoint Tester</h3>
            </div>
            <span className="text-xs font-mono text-slate-500">{selectedEndpoint}</span>
          </div>

          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="api-test-sample" className="block text-xs font-medium text-slate-700">
                Test Document Input
              </label>
              <select
                id="api-test-sample"
                value={testSampleId}
                onChange={(e) => handleSampleChange(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              >
                {SAMPLE_DOCUMENTS.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title} ({doc.fileName})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="api-test-rules" className="block text-xs font-medium text-slate-700">
                Verification Rules (one per line)
              </label>
              <textarea
                id="api-test-rules"
                rows={4}
                value={testRules}
                onChange={(e) => setTestRules(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={testIncludeSignatures}
                onChange={(e) => setTestIncludeSignatures(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
              Include signature extraction & bounding boxes
            </label>

            <button
              type="button"
              disabled={isTesting}
              onClick={() => void handleRunLiveApiTest()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5" />
              {isTesting ? 'Calling Endpoint...' : `Send POST ${selectedEndpoint}`}
            </button>

            {(testStatus !== null || testResponse) && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs tabular-nums">
                  <span className="font-medium text-slate-700">
                    Response Status:{' '}
                    <span
                      className={`font-mono font-semibold ${
                        testStatus && testStatus < 300 ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      HTTP {testStatus}
                    </span>
                  </span>
                  {testDurationMs !== null && (
                    <span className="font-mono text-slate-500">{testDurationMs} ms</span>
                  )}
                </div>
                <pre className="p-3.5 bg-slate-950 text-slate-100 rounded-lg text-xs font-mono overflow-auto max-h-[300px] leading-relaxed">
                  {testResponse}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
