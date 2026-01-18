export enum AudioState {
  SUSPENDED = 'SUSPENDED',
  RUNNING = 'RUNNING',
  CLOSED = 'CLOSED',
  INITIAL = 'INITIAL'
}

export interface VisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  sensitivity: number;
}

export interface DroneLayerConfig {
  baseFreq: number;
  type: OscillatorType;
  detuneRange: number;
  panSpeed: number; // Hz
  filterSpeed: number; // Hz
  gainMax: number;
}