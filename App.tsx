import React, { useState, useRef } from 'react';
import { Upload, Mic, Play, Pause, Activity, Cpu, Info, FileAudio } from 'lucide-react';
import Spectrogram from './components/Spectrogram';
import AnalysisResultCard from './components/AnalysisResultCard';
import { AudioState, AnalysisResult } from './types';
// CHANGED: Imported from local analysisService instead of geminiService
import { analyzeAudioSignal } from './services/analysisService';
import { APP_TITLE } from './constants';

const App: React.FC = () => {
  const [audioState, setAudioState] = useState<AudioState>({
    file: null,
    url: null,
    isPlaying: false,
    isRecording: false,
    duration: 0,
    currentTime: 0
  });

  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAudioState(prev => ({ ...prev, file, url, isPlaying: false }));
      setAnalysisResult(null);
      setError(null);
    }
  };

  const togglePlayback = () => {
    if (!audioState.url) return;
    setAudioState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
  };

  const handleAnalysis = async () => {
    if (!audioState.file) return;
    
    setIsAnalyzing(true);
    setError(null);
    
    try {
      // Local deterministic analysis
      const result = await analyzeAudioSignal(audioState.file);
      setAnalysisResult(result);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Analysis failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Mock recording functionality
  const startRecording = async () => {
     alert("Microphone recording requires secure context and implementation complexity outside this scope. Please use file upload.");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500/30">
      
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-500/20">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">{APP_TITLE}</h1>
              <p className="text-xs text-slate-400 font-mono">DISCRETE-TIME SIGNAL ANALYSIS SYSTEM</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-sm text-slate-400">
             <span className="flex items-center gap-1"><Cpu className="w-4 h-4" /> Local DSP Engine v2.0</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        
        {/* Intro / Logic Explanation */}
        <section className="mb-8 p-4 bg-slate-900/40 rounded-lg border border-slate-800/60">
           <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-2 font-mono">Methodology</h2>
           <p className="text-slate-400 text-sm leading-relaxed max-w-3xl">
             This system applies client-side Digital Signal Processing (DSP) to the input waveform. 
             It calculates energy variance (RMS), Zero-Crossing Rate (ZCR) consistency, and spectral density 
             to identify statistical anomalies common in synthetic speech synthesis, without using external AI models.
           </p>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Controls */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Input Card */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-xl">
              <h3 className="text-lg font-semibold mb-4 text-white flex items-center gap-2">
                <FileAudio className="w-5 h-5 text-blue-400" /> Signal Input
              </h3>
              
              <div className="space-y-4">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-24 border-2 border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-blue-500 hover:text-blue-400 hover:bg-slate-800/50 transition-all group"
                >
                  <Upload className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-medium">Upload .WAV / .MP3</span>
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept="audio/*" 
                  className="hidden" 
                />

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-800"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-slate-900 px-2 text-slate-500">Or</span>
                  </div>
                </div>

                <button 
                  onClick={startRecording}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors"
                >
                  <Mic className="w-4 h-4" /> Record Voice
                </button>
              </div>

              {audioState.file && (
                <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded text-sm text-blue-200 flex items-center justify-between">
                  <span className="truncate max-w-[150px]">{audioState.file.name}</span>
                  <span className="text-xs font-mono opacity-70">{(audioState.file.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-xl">
               <h3 className="text-lg font-semibold mb-4 text-white">Process</h3>
               
               <div className="flex gap-2 mb-4">
                 <button 
                    onClick={togglePlayback}
                    disabled={!audioState.url}
                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded flex items-center justify-center gap-2 transition-colors"
                 >
                    {audioState.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {audioState.isPlaying ? 'Stop' : 'Play'}
                 </button>
               </div>

               <button 
                  onClick={handleAnalysis}
                  disabled={!audioState.file || isAnalyzing}
                  className={`w-full py-3 rounded-lg font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2
                    ${!audioState.file 
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                      : isAnalyzing 
                        ? 'bg-blue-600/50 cursor-wait'
                        : 'bg-blue-600 hover:bg-blue-500 hover:shadow-blue-500/25'
                    }`}
               >
                 {isAnalyzing ? (
                   <>
                     <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                       <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                       <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                     </svg>
                     Calculating FFT...
                   </>
                 ) : (
                   <>
                     <Activity className="w-5 h-5" /> Execute Signal Analysis
                   </>
                 )}
               </button>
               
               {error && (
                 <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 text-red-300 text-xs rounded">
                   Error: {error}
                 </div>
               )}
            </div>

          </div>

          {/* Right Column: Visualization & Results */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* Visualizer */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-1 shadow-2xl">
              <Spectrogram 
                audioUrl={audioState.url} 
                isPlaying={audioState.isPlaying} 
                onEnded={() => setAudioState(p => ({ ...p, isPlaying: false }))}
              />
            </div>

            {/* Results */}
            {analysisResult ? (
              <AnalysisResultCard result={analysisResult} />
            ) : (
              <div className="flex-1 bg-slate-900/50 border border-slate-800/50 border-dashed rounded-xl flex items-center justify-center p-12 text-slate-600">
                <div className="text-center">
                   <Activity className="w-12 h-12 mx-auto mb-3 opacity-20" />
                   <p className="text-sm font-mono">Awaiting spectral data for classification...</p>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>

    </div>
  );
};

export default App;
