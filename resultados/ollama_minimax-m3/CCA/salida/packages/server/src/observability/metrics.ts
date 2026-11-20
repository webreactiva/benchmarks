export type Labels = Record<string, string | number>;

interface HistogramSeries {
  readonly buckets: number[];
  readonly counts: number[];
  sum: number;
  count: number;
}

const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

/**
 * Minimal Prometheus compatible metrics registry.
 *
 * Implemented in-house (instead of pulling a client library) to keep the
 * dependency surface of the service minimal; the exposition format is the
 * standard text format, so it can be scraped by Prometheus/Grafana as is.
 */
export class MetricsRegistry {
  private readonly counters = new Map<string, { labels: Labels; value: number }>();
  private readonly gauges = new Map<string, { labels: Labels; value: number }>();
  private readonly histograms = new Map<string, HistogramSeries>();

  private key(name: string, labels: Labels): string {
    const entries = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
    return `${name}{${entries.map(([k, v]) => `${k}="${String(v)}"`).join(',')}}`;
  }

  increment(name: string, labels: Labels = {}, delta = 1): void {
    const key = this.key(name, labels);
    const current = this.counters.get(key);
    if (current) {
      current.value += delta;
      return;
    }
    this.counters.set(key, { labels, value: delta });
  }

  setGauge(name: string, labels: Labels = {}, value = 0): void {
    this.gauges.set(this.key(name, labels), { labels, value });
  }

  observe(name: string, labels: Labels = {}, seconds = 0, buckets = DEFAULT_BUCKETS): void {
    const key = this.key(name, labels);
    let series = this.histograms.get(key);
    if (!series) {
      series = { buckets, counts: new Array(buckets.length).fill(0), sum: 0, count: 0 };
      this.histograms.set(key, series);
    }
    for (let index = 0; index < series.buckets.length; index += 1) {
      const bound = series.buckets[index];
      if (bound !== undefined && seconds <= bound) {
        series.counts[index] = (series.counts[index] ?? 0) + 1;
      }
    }
    series.sum += seconds;
    series.count += 1;
  }

  render(): string {
    const lines: string[] = [];

    for (const [key, entry] of this.counters) {
      const name = key.split('{')[0] ?? key;
      const labels = this.renderLabels(entry.labels);
      lines.push(`${name}${labels} ${entry.value}`);
    }

    for (const [key, entry] of this.gauges) {
      const name = key.split('{')[0] ?? key;
      const labels = this.renderLabels(entry.labels);
      lines.push(`${name}${labels} ${entry.value}`);
    }

    for (const [key, series] of this.histograms) {
      const name = key.split('{')[0] ?? key;
      const baseLabels = this.parseLabels(key);
      for (let index = 0; index < series.buckets.length; index += 1) {
        const bound = series.buckets[index] ?? 0;
        const labels = this.renderLabels({ ...baseLabels, le: String(bound) });
        lines.push(`${name}_bucket${labels} ${series.counts[index] ?? 0}`);
      }
      const infLabels = this.renderLabels({ ...baseLabels, le: '+Inf' });
      lines.push(`${name}_bucket${infLabels} ${series.count}`);
      lines.push(`${name}_sum${this.renderLabels(baseLabels)} ${series.sum}`);
      lines.push(`${name}_count${this.renderLabels(baseLabels)} ${series.count}`);
    }

    return `${lines.join('\n')}\n`;
  }

  private renderLabels(labels: Labels): string {
    const entries = Object.entries(labels).filter(([, value]) => value !== undefined);
    if (entries.length === 0) return '';
    return `{${entries.map(([k, v]) => `${k}="${String(v)}"`).join(',')}}`;
  }

  private parseLabels(key: string): Labels {
    const start = key.indexOf('{');
    const end = key.lastIndexOf('}');
    if (start === -1 || end === -1) return {};
    const body = key.slice(start + 1, end);
    if (body.trim() === '') return {};
    const labels: Labels = {};
    for (const part of body.split(',')) {
      const [rawKey, rawValue] = part.split('=');
      if (!rawKey || !rawValue) continue;
      labels[rawKey] = rawValue.replace(/^"|"$/g, '');
    }
    return labels;
  }
}

export const metricsRegistry = new MetricsRegistry();

export const CART_METRICS = {
  operations: 'cart_operations_total',
  conflicts: 'cart_conflicts_total',
  operationDuration: 'cart_operation_duration_seconds',
  eventsPublished: 'cart_events_published_total',
} as const;

export const HTTP_METRICS = {
  requests: 'http_requests_total',
  duration: 'http_request_duration_seconds',
  inFlight: 'http_requests_in_flight',
} as const;
