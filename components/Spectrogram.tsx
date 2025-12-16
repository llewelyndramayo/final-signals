import React, { useEffect, useRef, useState } from 'react';

interface SpectrogramProps {
  audioUrl: string | null;
  isPlaying: boolean;
  onEnded: () => void;
}

const Spectrogram: React.FC<SpectrogramProps> = ({ audioUrl, isPlaying, onEnded }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const startTimeRef = useRef<number>(0);
  
  // To simulate the "scrolling" spectrogram effect
  const spectrogramDataRef = useRef<Uint8Array[]>([]); 

  useEffect(() => {
    if (audioUrl) {
      loadAudio(audioUrl);
    }
    return () => {
      stopAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl]);

  useEffect(() => {
    if (isPlaying && audioBufferRef.current) {
      playAudio();
    } else {
      pauseAudio();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  const loadAudio = async (url: string) => {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      audioBufferRef.current = audioBuffer;
      spectrogramDataRef.current = []; // Reset spectrogram history
    } catch (e) {
      console.error("Error loading audio:", e);
    }
  };

  const playAudio = () => {
    if (!audioContextRef.current || !audioBufferRef.current) return;
    
    // Cleanup previous source
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current.disconnect();
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBufferRef.current;
    
    const analyser = audioContextRef.current.createAnalyser();
    analyser.fftSize = 2048; // Resolution of frequency
    analyserRef.current = analyser;

    source.connect(analyser);
    analyser.connect(audioContextRef.current.destination);
    
    source.onended = () => {
       onEnded();
       if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };

    source.start(0, startTimeRef.current % audioBufferRef.current.duration);
    sourceRef.current = source;
    
    draw();
  };

  const pauseAudio = () => {
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    // Note: We aren't perfectly tracking pause time for resume in this simplified demo, 
    // it usually restarts or we'd need more complex state. 
    // For this demo, we assume simple toggle playback.
  };

  const stopAudio = () => {
    pauseAudio();
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    audioBufferRef.current = null;
    spectrogramDataRef.current = [];
  };

  const draw = () => {
    if (!canvasRef.current || !analyserRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;
    
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    analyserRef.current.getByteFrequencyData(dataArray);

    // 1. Draw Background
    ctx.fillStyle = '#0f172a'; // Slate 900
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Store data for spectrogram history
    // We only keep last N frames where N is width of canvas
    spectrogramDataRef.current.push(new Uint8Array(dataArray));
    if (spectrogramDataRef.current.length > WIDTH) {
      spectrogramDataRef.current.shift();
    }

    // 2. Draw Spectrogram (Waterfall)
    // We draw columns from right to left or left to right. 
    // Let's draw latest at right.
    const specHeight = HEIGHT * 0.7;
    const waveHeight = HEIGHT * 0.3;
    
    // Draw grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.beginPath();
    for(let i=0; i<WIDTH; i+=50) { ctx.moveTo(i, 0); ctx.lineTo(i, specHeight); }
    for(let i=0; i<specHeight; i+=20) { ctx.moveTo(0, i); ctx.lineTo(WIDTH, i); }
    ctx.stroke();

    const imgData = ctx.createImageData(WIDTH, specHeight);
    
    // Fill ImageData
    for (let x = 0; x < spectrogramDataRef.current.length; x++) {
       const spectrum = spectrogramDataRef.current[x];
       // We map Y axis to frequency bins. 
       // We usually want log scale but linear is faster for demo.
       for (let y = 0; y < specHeight; y++) {
         // Map y pixel to frequency bin index
         // Flip y so low freq is at bottom of spec area
         const binIndex = Math.floor((1 - (y / specHeight)) * (bufferLength / 2)); 
         
         const value = spectrum[binIndex]; // 0 - 255
         
         // Heatmap coloring
         const cellIndex = (y * WIDTH + x) * 4;
         
         // Simple Heatmap: Blue -> Green -> Red
         imgData.data[cellIndex] = value;     // R
         imgData.data[cellIndex + 1] = value > 100 ? value : 0; // G
         imgData.data[cellIndex + 2] = 255 - value; // B
         imgData.data[cellIndex + 3] = 255;   // Alpha
       }
    }
    // Put spectrogram at the top
    ctx.putImageData(imgData, WIDTH - spectrogramDataRef.current.length, 0);

    // 3. Draw Instantaneous Frequency Line (bottom section)
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#22d3ee'; // Cyan
    ctx.beginPath();

    const sliceWidth = WIDTH * 1.0 / bufferLength;
    let x = 0;

    for(let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = v * (waveHeight/2) + specHeight; // Offset to bottom area

      if(i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth * 2; // Stretch a bit
    }
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.fillText("Frequency Domain (Spectrogram)", 10, 20);
    ctx.fillText("Instantaneous FFT", 10, specHeight + 20);

    animationRef.current = requestAnimationFrame(draw);
  };

  return (
    <div ref={containerRef} className="w-full h-64 bg-slate-900 rounded-lg overflow-hidden border border-slate-700 shadow-inner relative">
       <canvas 
        ref={canvasRef} 
        width={containerRef.current?.offsetWidth || 800} 
        height={256}
        className="w-full h-full"
       />
       {!isPlaying && (
         <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <span className="text-slate-300 font-mono text-sm">Visualizer Paused</span>
         </div>
       )}
    </div>
  );
};

export default Spectrogram;
