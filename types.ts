export enum AudioSource {
  UPLOAD = 'UPLOAD',
  MICROPHONE = 'MICROPHONE'
}

export interface SignalMetrics {
  noiseFloorDb: number;
  frequencyCutoffHz: number;
  harmonicRegularityScore: number; // 0-100
  energyVariationScore: number; // 0-100
  breathingArtifactsDetected: boolean;
}

export interface AnalysisResult {
  classification: 'Human Voice' | 'AI-Generated Voice';
  confidence: number;
  explanation: string;
  metrics: SignalMetrics;
  keyObservation: string;
}

export interface AudioState {
  file: File | null;
  url: string | null;
  isPlaying: boolean;
  isRecording: boolean;
  duration: number;
  currentTime: number;
}
