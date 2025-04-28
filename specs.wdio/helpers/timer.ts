import chunk from '../../lib/utils/chunk_array';
import Session from './session';

type PlotyTrace = {
  x: number[];
  y: number[];
  name: string;
  type: 'scatter';
};

export default class Timer {
  timings = {};

  xAxisSteps = 20;

  constructor(private getCount: () => Promise<number>) {}

  async timeIt(label: string, fn: () => void) {
    if (!this.timings[label]) {
      this.timings[label] = [];
    }

    const factCount = this.getCount
      ? await this.getCount()
      : await Session.getFactCount();

    const startTime = new Date().getTime();
    await fn();
    const endTime = new Date().getTime();

    this.timings[label].push({
      runtime: endTime - startTime,
      factCount,
    });
  }

  getAverageDataForLabel(label: string): { runtime: number; factCount: number }[] {
    const timings = this.timings[label];
    const chunkedTimings = chunk<any>(timings, Math.floor(timings.length / this.xAxisSteps) || 1);

    return chunkedTimings.map((chunkedTiming) => {
      const runtimeSum = chunkedTiming.reduce((a, b) => a + b.runtime, 0);
      const factCountSum = chunkedTiming.reduce((a, b) => a + b.factCount, 0);
      return {
        runtime: Math.round(runtimeSum / chunkedTiming.length),
        factCount: factCountSum / chunkedTiming.length,
      };
    });
  }

  async getAverageRuntimeForLabel(label: string) {
    const chunkedAverages = this.getAverageDataForLabel(label);
    return chunkedAverages.reduce((a, b) => a + b.runtime, 0) / chunkedAverages.length;
  }

  async getPlotyTraceForLabel(label: string) {
    const trace: PlotyTrace = {
      name: label,
      x: [],
      y: [],
      type: 'scatter',
    };

    this.getAverageDataForLabel(label).forEach((record: { runtime: number; factCount: number }) => {
      trace.x.push(record.factCount);
      trace.y.push(record.runtime);
    });

    return trace;
  }
}
