import { AnalysisResult, SignalMetrics } from "../types";

// --- DSP Utilities ---

const normalizeBuffer = (buffer: AudioBuffer): Float32Array => {
  const input = buffer.getChannelData(0);
  const output = new Float32Array(input.length);
  let maxPeak = 0;
  for (let i = 0; i < input.length; i++) {
    if (Math.abs(input[i]) > maxPeak) maxPeak = Math.abs(input[i]);
  }
  const scalar = maxPeak > 0 ? 0.95 / maxPeak : 1;
  for (let i = 0; i < input.length; i++) output[i] = input[i] * scalar;
  return output;
};

// Recursive Cooley-Tukey FFT
const fft = (inputReal: Float32Array, inputImag: Float32Array) => {
  const n = inputReal.length;
  if (n <= 1) return;
  const half = n / 2;
  const evenReal = new Float32Array(half);
  const evenImag = new Float32Array(half);
  const oddReal = new Float32Array(half);
  const oddImag = new Float32Array(half);

  for (let i = 0; i < half; i++) {
    evenReal[i] = inputReal[2 * i];
    evenImag[i] = inputImag[2 * i];
    oddReal[i] = inputReal[2 * i + 1];
    oddImag[i] = inputImag[2 * i + 1];
  }

  fft(evenReal, evenImag);
  fft(oddReal, oddImag);

  for (let k = 0; k < half; k++) {
    const angle = -2 * Math.PI * k / n;
    const cwReal = Math.cos(angle);
    const cwImag = Math.sin(angle);
    const termReal = cwReal * oddReal[k] - cwImag * oddImag[k];
    const termImag = cwReal * oddImag[k] + cwImag * oddReal[k];
    inputReal[k] = evenReal[k] + termReal;
    inputImag[k] = evenImag[k] + termImag;
    inputReal[k + half] = evenReal[k] - termReal;
    inputImag[k + half] = evenImag[k] - termImag;
  }
};

const getMagnitudeSpectrum = (real: Float32Array): Float32Array => {
  const n = real.length;
  const imag = new Float32Array(n).fill(0);
  // Hanning window
  for(let i=0; i<n; i++) {
     real[i] = real[i] * 0.5 * (1 - Math.cos((2*Math.PI*i)/(n-1)));
  }
  fft(real, imag);
  const mag = new Float32Array(n/2);
  for(let i=0; i<n/2; i++) mag[i] = Math.sqrt(real[i]*real[i] + imag[i]*imag[i]);
  return mag;
};

export const analyzeAudioSignal = async (audioFile: File): Promise<AnalysisResult> => {
  const arrayBuffer = await audioFile.arrayBuffer();
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 44100 });
  const rawBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  const data = normalizeBuffer(rawBuffer);
  const sampleRate = rawBuffer.sampleRate;

  // --- CONFIG ---
  const FFT_SIZE = 2048;
  const BIN_WIDTH = sampleRate / FFT_SIZE;
  const HOP_SIZE = 1024; // 50% overlap

  // Vectors for statistical analysis
  const frameRolloffs: number[] = [];
  const frameCentroids: number[] = [];
  const frameRMS: number[] = [];
  const frameFlatness: number[] = [];

  let minGlobalRMS = 1.0;

  // --- FRAME-BY-FRAME ANALYSIS ---
  for (let i = 0; i < data.length - FFT_SIZE; i += HOP_SIZE) {
    const chunk = data.slice(i, i + FFT_SIZE);
    
    // 1. RMS
    let sumSq = 0;
    for (let s of chunk) sumSq += s*s;
    const rms = Math.sqrt(sumSq / FFT_SIZE);
    frameRMS.push(rms);

    if (rms > 0.00001 && rms < minGlobalRMS) minGlobalRMS = rms;

    // Only process spectral features for active speech (Gate > -40dB)
    if (rms > 0.01) {
       const spectrum = getMagnitudeSpectrum(new Float32Array(chunk));
       
       // 2. Spectral Rolloff (Frequency below which 85% of energy distribution lies)
       let totalEnergy = 0;
       for(let mag of spectrum) totalEnergy += mag;
       
       let accumEnergy = 0;
       let rolloffBin = 0;
       const thresholdEnergy = 0.85 * totalEnergy;
       
       for(let j=0; j<spectrum.length; j++) {
         accumEnergy += spectrum[j];
         if (accumEnergy >= thresholdEnergy) {
           rolloffBin = j;
           break;
         }
       }
       frameRolloffs.push(rolloffBin * BIN_WIDTH);

       // 3. Spectral Centroid
       let weightedSum = 0;
       for(let j=0; j<spectrum.length; j++) weightedSum += j * spectrum[j];
       const centroid = (weightedSum / (totalEnergy + 0.0001)) * BIN_WIDTH;
       frameCentroids.push(centroid);

       // 4. Spectral Flatness (Geometric Mean / Arithmetic Mean)
       // AI tends to be peakier (lower flatness) in voiced segments
       let sumMag = 0;
       let prodMag = 0; // using log sum to avoid overflow
       let logSum = 0;
       for(let j=0; j<spectrum.length; j++) {
          const val = spectrum[j] + 1e-10;
          sumMag += val;
          logSum += Math.log(val);
       }
       const geoMean = Math.exp(logSum / spectrum.length);
       const ariMean = sumMag / spectrum.length;
       frameFlatness.push(geoMean / (ariMean + 1e-10));
    }
  }

  // --- STATISTICAL AGGREGATION ---

  // 1. Noise Floor Calculation
  const noiseFloorDb = 20 * Math.log10(minGlobalRMS + 1e-9);

  // 2. Bandwidth Consistency (Rolloff Variance)
  // Low variance in rolloff suggests a fixed brick-wall filter (AI).
  // High variance suggests natural phoneme variation (Human).
  const avgRolloff = frameRolloffs.reduce((a,b)=>a+b,0) / (frameRolloffs.length||1);
  const varRolloff = frameRolloffs.reduce((a,b)=>a + Math.pow(b-avgRolloff,2), 0) / (frameRolloffs.length||1);
  const stdRolloff = Math.sqrt(varRolloff);

  // 3. Spectral Centroid Stability
  const avgCentroid = frameCentroids.reduce((a,b)=>a+b,0) / (frameCentroids.length||1);

  // 4. Digital Silence Detection
  // Check if we have exact zero sequences in the raw data (not just low RMS)
  let zeroRunCount = 0;
  let maxZeroRun = 0;
  for(let i=0; i<data.length; i++) {
    if (data[i] === 0) {
      zeroRunCount++;
    } else {
      if(zeroRunCount > maxZeroRun) maxZeroRun = zeroRunCount;
      zeroRunCount = 0;
    }
  }
  const hasDigitalSilence = maxZeroRun > 1000; // > ~20ms of pure zeros

  // --- CLASSIFICATION SCORING ---
  
  let score = 0; // > 0 leans AI, < 0 leans Human
  const explanations: string[] = [];
  let primaryObs = "";

  // FACTOR 1: The "Cheap Mic" vs "AI" Matrix
  // Natural cheap mics have low bandwidth (<16kHz) BUT high noise (>-60dB).
  // AI has low bandwidth (<16kHz) AND low noise (<-70dB).
  
  if (avgRolloff < 17000) {
      if (noiseFloorDb < -75 || hasDigitalSilence) {
          score += 40; // Low Bandwidth + Clean = AI
          explanations.push("Signal is bandwidth-limited yet unnaturally clean.");
          primaryObs = "Bandwidth limited with synthetic silence.";
      } else {
          score -= 30; // Low Bandwidth + Noisy = Cheap Mic (Human)
          explanations.push("Bandwidth limitation likely due to hardware, matched with natural noise floor.");
      }
  } else {
      score -= 10; // High bandwidth usually implies modern recording or high-end generation
      explanations.push("Full spectral bandwidth detected.");
  }

  // FACTOR 2: Rolloff Rigidity
  // If the 85% energy point barely moves (stdDev < 150Hz), it's likely a fixed filter.
  // Human speech rolloff moves wildly (300Hz+) depending on the vowel/consonant.
  if (stdRolloff < 200) {
      score += 35;
      explanations.push("Spectral rolloff point is mathematically rigid.");
      if(!primaryObs) primaryObs = "Fixed-frequency low-pass filtering detected.";
  } else {
      score -= 20;
      explanations.push("Natural spectral variation observed over time.");
  }

  // FACTOR 3: Digital Artifacts
  if (hasDigitalSilence) {
      score += 25;
      explanations.push("Contains segments of absolute digital silence (Zero-fill).");
  }

  // FACTOR 4: Dynamic Flatness (reusing older logic but stricter)
  const rmsMean = frameRMS.reduce((a,b)=>a+b,0)/(frameRMS.length||1);
  const rmsVar = frameRMS.reduce((a,b)=>a+Math.pow(b-rmsMean,2),0)/(frameRMS.length||1);
  const rmsCV = Math.sqrt(rmsVar)/rmsMean;
  
  if (rmsCV < 0.4) {
      score += 15; // Compressed
      explanations.push("Low dynamic range consistent with normalized synthesis.");
  }

  // --- DECISION ---
  // Baseline bias: assume human (score starts 0). 
  // Need > 35 to flag as AI.
  const isAI = score > 35;
  
  // Confidence calculation
  let confidence = 60 + Math.min(39, Math.abs(score)); // 60% to 99%

  // Metrics for UI
  const regularity = Math.max(0, Math.min(100, (300 - stdRolloff) / 3)); // Map 300Hz dev to 0, 0Hz dev to 100
  const variation = Math.min(100, rmsCV * 100);

  return {
    classification: isAI ? 'AI-Generated Voice' : 'Human Voice',
    confidence: Math.round(confidence),
    explanation: explanations.slice(0, 2).join(" "),
    metrics: {
      noiseFloorDb: Math.round(noiseFloorDb),
      frequencyCutoffHz: Math.round(avgRolloff), // Displaying the 85% energy point
      harmonicRegularityScore: Math.round(regularity),
      energyVariationScore: Math.round(variation),
      breathingArtifactsDetected: noiseFloorDb > -70 && !hasDigitalSilence
    },
    keyObservation: primaryObs || (isAI ? "Statistical signal rigidity." : "Natural spectral variance.")
  };
};
