import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { EventEmitter } from 'events';

export interface RtlPowerEvent {
  timestamp: Date;
  centerFreq: number;
  startFreq: number;
  endFreq: number;
  sampleCount: number;
  samples: number[];
}

export type RtlNumberUnits = 'K' | 'M';
export type RtlNumber = `${number}${RtlNumberUnits}`;
export interface RtlPowerOptions {
  frequency?: number;
  binSize?: RtlNumber;
  gain?: number;
  crop?: number | `${number}%`;
  filterNumber?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  window?: 'hamming' | 'blackman' | 'blackman-harris' | 'hann-poisson' | 'bartlett' | 'youssef';
}

function getArguments(opts: RtlPowerOptions) {
  const params: string[] = [];
  const centerFreq = opts.frequency;
  if (!centerFreq) {
    throw new Error('Frequency is required');
  }

  const startFreq = centerFreq - 0.4e6;
  const stopFreq = centerFreq + 0.4e6;

  params.push('-f', `${startFreq}:${stopFreq}:${opts.binSize || '10K'}`);
  params.push('-g', `${opts.gain || 0}`);
  params.push('-c', `${opts.crop || '50%'}`);
  if (opts.window) {
    params.push('-w', opts.window);
  }
  if ('filterNumber' in opts) {
    params.push('-F', `${opts.filterNumber}`);
  }
  params.push('-i', '1');
  return params;
}

export class RtlPowerWrapper extends EventEmitter {
  private rtlPowerProcess: ChildProcessWithoutNullStreams | null = null;

  constructor(private options: RtlPowerOptions) {
    super();
  }

  get isRunning() { return !!this.rtlPowerProcess; }

  setFrequency(newFreq: number) {
    this.options.frequency = newFreq;
  }

  start() {
    if (this.rtlPowerProcess) {
      this.stop();
    }
    this.rtlPowerProcess = spawn('rtl_power', getArguments(this.options));
    const freq = this.options.frequency;

    this.rtlPowerProcess.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter((line) => line.trim());
      for (const line of lines) {
        if (line) {
          const [date, time, startFreq, stopFreq, binSize, sampleCount, ...samples] = line.split(', ');
          const floatSamples = samples.map((sample) => parseFloat(sample));
          // Date is e.g. 2023-04-28, Time is e.g. 12:34:56
          const timestamp = new Date(`${date} ${time}`);
          this.emit('data', <RtlPowerEvent>{
            timestamp,
            centerFreq: freq!,
            startFreq: parseInt(startFreq, 10),
            endFreq: parseInt(stopFreq, 10),
            binSize: parseFloat(binSize),
            sampleCount: parseInt(sampleCount, 10),
            samples: floatSamples,
          });
        }
      }
    });
    this.rtlPowerProcess.stderr.on('data', (data: Buffer) => {
      console.error(`(rtl_power): ` + data.toString());
    });

    this.rtlPowerProcess.on('close', () => {
      this.emit('close');
      this.rtlPowerProcess = null;
    });
  }

  stop() {
    this.rtlPowerProcess?.kill('SIGINT');
    this.rtlPowerProcess = null;
  }
}

export function roundToDecimals(num: number, decimals: number) {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

export function getNoiseFloor(data: number[]) {
  // Given an array of numbers (dBm) discard any outliers and return the average
  const sorted = data.sort((a, b) => a - b);
  // Determine the standard deviation
  const avg = sorted.reduce((acc, val) => acc + val, 0) / sorted.length;
  const stdDev = Math.sqrt(sorted.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / sorted.length);
  // Discard any values that are more than 1.5 standard deviations from the mean
  const filtered = sorted.filter((val) => Math.abs(val - avg) < 1.5 * stdDev);
  return filtered.reduce((acc, val) => acc + val, 0) / filtered.length;
}

export function displayData(data: RtlPowerEvent) {
  const middle = Math.floor(data.samples.length / 2);
  const avg = data.samples[middle];
  // Average everything except the middle three samples as the "noise floor"
  const noiseFloor = getNoiseFloor(data.samples.filter((_, i) => i !== middle - 1 && i !== middle && i !== middle + 1));
  console.log(`${data.timestamp.getTime()} ${data.centerFreq}MHz: ${roundToDecimals(Math.max(avg - noiseFloor, 0), 3)} dBm\t\t\t ${avg}`);
}

// If this script was called directly, run it
if (require.main === module) {
  const rtlPower = new RtlPowerWrapper({
    frequency: 146.52e6,
    gain: 50,
    crop: '50%',
    binSize: '10K',
    window: 'hann-poisson',
  });
  rtlPower.on('data', displayData);
  rtlPower.start();
}
