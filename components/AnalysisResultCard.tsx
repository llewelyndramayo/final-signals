import React from 'react';
import { AnalysisResult } from '../types';
import { ShieldCheck, ShieldAlert, Activity, Volume2, Radio, Waves } from 'lucide-react';

interface Props {
  result: AnalysisResult;
}

const AnalysisResultCard: React.FC<Props> = ({ result }) => {
  const isHuman = result.classification === 'Human Voice';
  const scoreColor = isHuman ? 'text-green-400' : 'text-red-400';
  const borderColor = isHuman ? 'border-green-500/50' : 'border-red-500/50';
  const bgColor = isHuman ? 'bg-green-950/20' : 'bg-red-950/20';

  return (
    <div className={`w-full rounded-xl border ${borderColor} ${bgColor} p-6 mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-700 pb-4 mb-4">
        <div>
          <h3 className="text-slate-400 text-sm font-mono uppercase tracking-wider mb-1">Classification Result</h3>
          <div className="flex items-center gap-3">
            {isHuman ? <ShieldCheck className="w-8 h-8 text-green-400" /> : <ShieldAlert className="w-8 h-8 text-red-500" />}
            <h2 className={`text-3xl font-bold ${scoreColor}`}>{result.classification}</h2>
          </div>
        </div>
        <div className="text-right">
          <div className="text-slate-400 text-sm font-mono">Confidence Level</div>
          <div className="text-2xl font-bold text-white">{result.confidence}%</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
           <h4 className="text-blue-400 font-semibold mb-3 flex items-center gap-2">
             <Activity className="w-4 h-4" /> Signal Observations
           </h4>
           <p className="text-slate-300 text-sm leading-relaxed mb-4">
             {result.explanation}
           </p>
           <div className="bg-slate-800/50 p-3 rounded border-l-4 border-blue-500">
             <span className="text-xs text-blue-300 uppercase font-bold block mb-1">Key Indicator</span>
             <p className="text-sm text-white italic">"{result.keyObservation}"</p>
           </div>
        </div>

        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
          <h4 className="text-purple-400 font-semibold mb-3 flex items-center gap-2">
            <Waves className="w-4 h-4" /> Spectral Metrics
          </h4>
          <div className="space-y-4">
            
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400 flex items-center gap-2"><Volume2 className="w-3 h-3" /> Noise Floor (Est.)</span>
              <span className="font-mono text-white">{result.metrics.noiseFloorDb} dB</span>
            </div>
            
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400 flex items-center gap-2"><Radio className="w-3 h-3" /> Freq. Cutoff</span>
              <span className="font-mono text-white">{result.metrics.frequencyCutoffHz} Hz</span>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Harmonic Regularity</span>
                <span>{result.metrics.harmonicRegularityScore}/100</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2">
                <div 
                  className="bg-purple-500 h-2 rounded-full transition-all duration-1000" 
                  style={{ width: `${result.metrics.harmonicRegularityScore}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-slate-500 mt-1 text-right">Higher = More Artificial</p>
            </div>

            <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-800">
              <span className="text-slate-400">Breathing Artifacts?</span>
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${result.metrics.breathingArtifactsDetected ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                {result.metrics.breathingArtifactsDetected ? 'DETECTED' : 'ABSENT'}
              </span>
            </div>

          </div>
        </div>
      </div>

    </div>
  );
};

export default AnalysisResultCard;
