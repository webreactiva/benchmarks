export type Labels = Record<string, string>;

export interface CounterDefinition {
  name: string;
  help: string;
  labels?: string[];
}

export interface HistogramDefinition {
  name: string;
  help: string;
  buckets?: number[];
  labels?: string[];
}

interface Series {
  labels: Labels;
  value: number;
  buckets?: number[];
  counts?: number[];
  sum: number;
  count: number;
}

const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

/**
 * Registro de métricas mínimo compatible con el formato de texto de
 * Prometheus. Se evita una dependencia extra porque el servicio solo necesita
 * contadores y latencias.
 */
export class MetricsRegistry {
  private readonly definitions = new Map<
    string,
    { type: 'counter' | 'histogram'; help: string; buckets?: number[] }
  >();
  private readonly series = new Map<string, Series>();

  defineCounter(def: CounterDefinition): void {
    this.definitions.set(def.name, { type: 'counter', help: def.help });
  }

  defineHistogram(def: HistogramDefinition): void {
    const buckets = def.buckets ?? DEFAULT_BUCKETS;
    this.definitions.set(def.name, { type: 'histogram', help: def.help, buckets });
    this.ensureSeries(def.name, {});
  }

  increment(name: string, labels: Labels = {}, value = 1): void {
    const series = this.ensureSeries(name, labels);
    series.value += value;
  }

  observe(name: string, labels: Labels, value: number): void {
    const series = this.ensureSeries(name, labels);
    series.sum += value;
    series.count += 1;
    const buckets = series.buckets ?? DEFAULT_BUCKETS;
    for (let i = 0; i < buckets.length; i += 1) {
      if (value <= (buckets[i] as number)) {
        series.counts![i] = (series.counts![i] ?? 0) + 1;
      }
    }
  }

  render(): string {
    const lines: string[] = [];
    for (const [name, def] of this.definitions) {
      lines.push(`# HELP ${name} ${def.help}`);
      lines.push(`# TYPE ${name} ${def.type}`);
      const entries = [...this.series.entries()].filter(([key]) => key.startsWith(`${name}|`));
      for (const [, series] of entries) {
        const labelStr = formatLabels(series.labels);
        if (def.type === 'counter') {
          lines.push(`${name}${labelStr} ${series.value}`);
        } else {
          const buckets = series.buckets ?? def.buckets ?? DEFAULT_BUCKETS;
          for (let i = 0; i < buckets.length; i += 1) {
            lines.push(
              `${name}_bucket${formatLabels({ ...series.labels, le: String(buckets[i]) })} ${series.counts?.[i] ?? 0}`,
            );
          }
          lines.push(
            `${name}_bucket${formatLabels({ ...series.labels, le: '+Inf' })} ${series.count}`,
          );
          lines.push(`${name}_sum${labelStr} ${series.sum}`);
          lines.push(`${name}_count${labelStr} ${series.count}`);
        }
      }
    }
    return `${lines.join('\n')}\n`;
  }

  private ensureSeries(name: string, labels: Labels): Series {
    const key = `${name}|${JSON.stringify(labels)}`;
    let series = this.series.get(key);
    if (!series) {
      const buckets = this.definitions.get(name)?.buckets;
      series = {
        labels,
        value: 0,
        buckets,
        counts: buckets ? new Array(buckets.length).fill(0) : undefined,
        sum: 0,
        count: 0,
      };
      this.series.set(key, series);
    } else if (!series.buckets && this.definitions.get(name)?.buckets) {
      const buckets = this.definitions.get(name)?.buckets ?? DEFAULT_BUCKETS;
      series.buckets = buckets;
      series.counts = new Array(buckets.length).fill(0);
    }
    return series;
  }
}

function formatLabels(labels: Labels): string {
  const entries = Object.entries(labels).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return '';
  const body = entries
    .map(([key, value]) => `${key}="${String(value).replace(/"/g, '\\"')}"`)
    .join(',');
  return `{${body}}`;
}
