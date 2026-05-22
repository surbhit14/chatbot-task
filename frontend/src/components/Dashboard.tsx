import { Fragment, useEffect, useState } from 'react';
import {
  getMetricsLatency,
  getMetricsThroughput,
  getMetricsErrors,
  listInferenceLogs,
  InferenceLog,
  LatencyMetrics,
  ThroughputBucket,
  ErrorRow,
} from '../api/client';
import { MODELS } from '../constants/models';

function fmt(ms: number | null): string {
  if (ms === null) return '—';
  return `${Math.round(ms)}ms`;
}

function LatencyPanel() {
  const [rows, setRows] = useState<(LatencyMetrics & { modelLabel: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const results = await Promise.allSettled(
        MODELS.map((m) =>
          getMetricsLatency({ provider: m.provider, model: m.value }).then((r) => ({
            ...r,
            modelLabel: m.label,
          }))
        )
      );
      const fulfilled = results
        .filter((r): r is PromiseFulfilledResult<LatencyMetrics & { modelLabel: string }> => r.status === 'fulfilled')
        .map((r) => r.value)
        .filter((r) => r.sample_count > 0);
      setRows(fulfilled);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Latency (p50 / p95 / p99)</h2>
      {loading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-gray-400">No data yet — send some messages first.</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-100">
              <th className="pb-2 font-medium">Model</th>
              <th className="pb-2 font-medium text-right">p50</th>
              <th className="pb-2 font-medium text-right">p95</th>
              <th className="pb-2 font-medium text-right">p99</th>
              <th className="pb-2 font-medium text-right">Samples</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.provider}-${r.model}`} className="border-b border-gray-50 last:border-0">
                <td className="py-2 text-gray-700">{r.modelLabel}</td>
                <td className="py-2 text-right text-green-600 font-mono">{fmt(r.p50_ms)}</td>
                <td className="py-2 text-right text-yellow-600 font-mono">{fmt(r.p95_ms)}</td>
                <td className="py-2 text-right text-red-500 font-mono">{fmt(r.p99_ms)}</td>
                <td className="py-2 text-right text-gray-400">{r.sample_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function ThroughputPanel() {
  const [buckets, setBuckets] = useState<ThroughputBucket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMetricsThroughput({ granularity: 'hour' })
      .then((d) => { setBuckets(d.buckets); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const max = Math.max(...buckets.map((b) => Number(b.request_count)), 1);

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Throughput (requests / hour)</h2>
      {loading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : buckets.length === 0 ? (
        <p className="text-xs text-gray-400">No data yet.</p>
      ) : (
        <div className="space-y-1">
          {buckets.slice(-24).map((b) => {
            const pct = Math.max(4, (Number(b.request_count) / max) * 100);
            const label = new Date(b.timestamp).toLocaleString(undefined, {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            });
            return (
              <div key={b.timestamp} className="flex items-center gap-2 text-xs">
                <span className="w-36 shrink-0 text-gray-400 text-right">{label}</span>
                <div className="flex-1 bg-gray-100 rounded">
                  <div
                    className="bg-blue-400 rounded h-4 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-8 text-right text-gray-600 font-mono">{b.request_count}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ErrorsPanel() {
  const [rows, setRows] = useState<ErrorRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMetricsErrors()
      .then((d) => { setRows(d.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Errors by Model</h2>
      {loading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-gray-400">No errors recorded.</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-100">
              <th className="pb-2 font-medium">Provider</th>
              <th className="pb-2 font-medium">Model</th>
              <th className="pb-2 font-medium">Error code</th>
              <th className="pb-2 font-medium text-right">Count</th>
              <th className="pb-2 font-medium text-right">Rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-gray-50 last:border-0">
                <td className="py-2 text-gray-700">{r.provider}</td>
                <td className="py-2 text-gray-500">{r.model}</td>
                <td className="py-2 font-mono text-red-500">{r.error_code ?? '—'}</td>
                <td className="py-2 text-right text-gray-700">{r.count}</td>
                <td className="py-2 text-right text-red-500">{r.error_rate_pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function statusBadge(status: InferenceLog['status']) {
  const base = 'px-1.5 py-0.5 rounded text-xs font-medium';
  if (status === 'success') return <span className={`${base} bg-green-50 text-green-700`}>success</span>;
  if (status === 'error') return <span className={`${base} bg-red-50 text-red-600`}>error</span>;
  return <span className={`${base} bg-gray-100 text-gray-500`}>cancelled</span>;
}

function LogsPanel() {
  const [logs, setLogs] = useState<InferenceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    listInferenceLogs({ limit: 50 })
      .then((d) => { setLogs(d.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function shortId(id: string | null) {
    return id ? id.slice(0, 8) + '…' : '—';
  }

  function fmtTs(ts: string | null) {
    if (!ts) return '—';
    return new Date(ts).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Recent Inference Logs</h2>
      {loading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : logs.length === 0 ? (
        <p className="text-xs text-gray-400">No logs yet — send some messages first.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[900px]">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="pb-2 font-medium">Started</th>
                <th className="pb-2 font-medium">Model</th>
                <th className="pb-2 font-medium">Provider</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium text-right">Latency</th>
                <th className="pb-2 font-medium text-right">TTFB</th>
                <th className="pb-2 font-medium text-right">Tokens (in/out/tot)</th>
                <th className="pb-2 font-medium">Conv ID</th>
                <th className="pb-2 font-medium">Error</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <Fragment key={log.id}>
                  <tr
                    className="border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                  >
                    <td className="py-2 text-gray-500 whitespace-nowrap">{fmtTs(log.started_at)}</td>
                    <td className="py-2 text-gray-700 font-mono max-w-[160px] truncate">{log.model}</td>
                    <td className="py-2 text-gray-500">{log.provider}</td>
                    <td className="py-2">{statusBadge(log.status)}</td>
                    <td className="py-2 text-right font-mono text-gray-700">
                      {log.latency_ms != null ? `${log.latency_ms}ms` : '—'}
                    </td>
                    <td className="py-2 text-right font-mono text-gray-500">
                      {log.ttfb_ms != null ? `${log.ttfb_ms}ms` : '—'}
                    </td>
                    <td className="py-2 text-right font-mono text-gray-600">
                      {log.prompt_tokens ?? '—'} / {log.completion_tokens ?? '—'} / {log.total_tokens ?? '—'}
                    </td>
                    <td className="py-2 text-gray-400 font-mono" title={log.conversation_id ?? ''}>
                      {shortId(log.conversation_id)}
                    </td>
                    <td className="py-2 text-red-500 font-mono max-w-[120px] truncate">
                      {log.error_code ?? ''}
                    </td>
                  </tr>
                  {expanded === log.id && (
                    <tr className="bg-gray-50">
                      <td colSpan={9} className="px-2 py-3">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="text-gray-400 mb-1 font-medium">Input preview</p>
                            <p className="text-gray-700 font-mono whitespace-pre-wrap break-all bg-white border border-gray-100 rounded p-2 max-h-32 overflow-y-auto">
                              {log.input_preview ?? '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 mb-1 font-medium">Output preview</p>
                            <p className="text-gray-700 font-mono whitespace-pre-wrap break-all bg-white border border-gray-100 rounded p-2 max-h-32 overflow-y-auto">
                              {log.output_preview ?? '—'}
                            </p>
                          </div>
                          {log.error_message && (
                            <div className="col-span-2">
                              <p className="text-gray-400 mb-1 font-medium">Error message</p>
                              <p className="text-red-600 font-mono bg-red-50 border border-red-100 rounded p-2">
                                {log.error_message}
                              </p>
                            </div>
                          )}
                          <div>
                            <span className="text-gray-400">Log ID: </span>
                            <span className="font-mono text-gray-600">{log.id}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Ended: </span>
                            <span className="font-mono text-gray-600">{fmtTs(log.ended_at)}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function Dashboard() {
  return (
    <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
      <h1 className="text-base font-semibold text-gray-800 mb-4">Observability Dashboard</h1>
      <div className="space-y-4 max-w-5xl">
        <LatencyPanel />
        <ThroughputPanel />
        <ErrorsPanel />
        <LogsPanel />
      </div>
    </div>
  );
}
