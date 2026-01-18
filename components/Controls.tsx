import React from 'react';

interface ControlsProps {
  isPlaying: boolean;
  onToggle: () => void;
  sensitivity: number;
  onSensitivityChange: (val: number) => void;
  
  reverbDecay: number;
  onReverbDecayChange: (val: number) => void;
  
  delayFeedback: number;
  onDelayFeedbackChange: (val: number) => void;

  modulation: number;
  onModulationChange: (val: number) => void;

  isImmersive: boolean;
}

export const Controls: React.FC<ControlsProps> = ({ 
  isPlaying, 
  onToggle, 
  sensitivity, 
  onSensitivityChange, 
  reverbDecay,
  onReverbDecayChange,
  delayFeedback,
  onDelayFeedbackChange,
  modulation,
  onModulationChange,
  isImmersive 
}) => {
  return (
    <>
      {/* CENTER CONTROLS (Main Menu) */}
      <div 
        className={`z-10 flex flex-col items-center justify-center space-y-6 absolute inset-0 transition-all duration-1000 ${
          isImmersive ? 'opacity-0 pointer-events-none scale-110' : 'opacity-100 scale-100'
        }`}
      >
          <h1 className={`text-4xl md:text-6xl font-thin tracking-[0.2em] text-white transition-opacity duration-1000 ${isPlaying ? 'opacity-40' : 'opacity-90'}`}>
              AETHER DRIFT
          </h1>
          
          <button
              onClick={onToggle}
              className="group relative flex items-center justify-center w-24 h-24 rounded-full border border-slate-600 bg-slate-900/50 backdrop-blur-sm transition-all duration-500 hover:border-slate-400 hover:scale-105 active:scale-95 focus:outline-none mb-4"
              aria-label={isPlaying ? "Pause" : "Play"}
          >
              <div className={`absolute inset-0 rounded-full bg-slate-100 opacity-0 transition-opacity duration-500 group-hover:opacity-5`}></div>
              {isPlaying ? (
                  <div className="flex space-x-2">
                      <div className="w-1.5 h-8 bg-slate-200 rounded-sm shadow-[0_0_10px_rgba(255,255,255,0.5)]"></div>
                      <div className="w-1.5 h-8 bg-slate-200 rounded-sm shadow-[0_0_10px_rgba(255,255,255,0.5)]"></div>
                  </div>
              ) : (
                  <div className="ml-1 w-0 h-0 border-t-[12px] border-t-transparent border-l-[20px] border-l-slate-200 border-b-[12px] border-b-transparent shadow-[0_0_10px_rgba(255,255,255,0.5)]"></div>
              )}
          </button>

          {/* Controls Group */}
          <div className={`flex flex-col items-center space-y-4 transition-all duration-700 ${isPlaying ? 'opacity-60 hover:opacity-100' : 'opacity-0'}`}>
               
               {/* Sensitivity */}
               <div className="flex flex-col items-center space-y-1">
                   <label htmlFor="sensitivity" className="text-slate-500 text-[10px] tracking-widest uppercase">Visual Sensitivity</label>
                   <input 
                      id="sensitivity"
                      type="range" 
                      min="0.1" 
                      max="3.0" 
                      step="0.1" 
                      value={sensitivity} 
                      onChange={(e) => onSensitivityChange(parseFloat(e.target.value))}
                      className="w-48 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-slate-300 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:hover:bg-white focus:outline-none"
                   />
               </div>

               {/* Reverb Decay */}
               <div className="flex flex-col items-center space-y-1">
                   <label htmlFor="reverb" className="text-slate-500 text-[10px] tracking-widest uppercase">Reverb Space ({reverbDecay}s)</label>
                   <input 
                      id="reverb"
                      type="range" 
                      min="1" 
                      max="20" 
                      step="1" 
                      value={reverbDecay} 
                      onChange={(e) => onReverbDecayChange(parseFloat(e.target.value))}
                      className="w-48 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-slate-300 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:hover:bg-white focus:outline-none"
                   />
               </div>

               {/* Delay Feedback */}
               <div className="flex flex-col items-center space-y-1">
                   <label htmlFor="delay" className="text-slate-500 text-[10px] tracking-widest uppercase">Echo Feedback ({Math.round(delayFeedback * 100)}%)</label>
                   <input 
                      id="delay"
                      type="range" 
                      min="0" 
                      max="0.9" 
                      step="0.05" 
                      value={delayFeedback} 
                      onChange={(e) => onDelayFeedbackChange(parseFloat(e.target.value))}
                      className="w-48 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-slate-300 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:hover:bg-white focus:outline-none"
                   />
               </div>

               {/* Modulation Depth */}
               <div className="flex flex-col items-center space-y-1">
                   <label htmlFor="modulation" className="text-slate-500 text-[10px] tracking-widest uppercase">Texture Motion ({Math.round(modulation * 100)}%)</label>
                   <input 
                      id="modulation"
                      type="range" 
                      min="0" 
                      max="2.0" 
                      step="0.1" 
                      value={modulation} 
                      onChange={(e) => onModulationChange(parseFloat(e.target.value))}
                      className="w-48 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-slate-300 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:hover:bg-white focus:outline-none"
                   />
               </div>

          </div>

          <p className={`text-slate-400 font-light text-sm tracking-widest transition-opacity duration-700 ${isPlaying ? 'opacity-0' : 'opacity-60'}`}>
              IMMERSIVE SOUNDSCAPE
          </p>
      </div>

      {/* IMMERSIVE MODE CONTROLS (Corners) */}
      <div className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ${isImmersive ? 'opacity-100' : 'opacity-0'}`}>
        
        {/* Top Left: Play/Pause */}
        <div className="absolute top-8 left-8 pointer-events-auto">
            <button
              onClick={onToggle}
              className="flex items-center justify-center w-12 h-12 rounded-full border border-slate-700 bg-slate-900/30 backdrop-blur-md text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
            >
               {isPlaying ? (
                  <div className="flex space-x-1">
                      <div className="w-1 h-4 bg-current rounded-sm"></div>
                      <div className="w-1 h-4 bg-current rounded-sm"></div>
                  </div>
              ) : (
                  <div className="ml-0.5 w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-current border-b-[6px] border-b-transparent"></div>
              )}
            </button>
        </div>

        {/* Top Right: Title */}
        <div className="absolute top-10 right-8">
            <h2 className="text-white/50 text-xs tracking-[0.3em] font-light uppercase">
                Aether Drift
            </h2>
        </div>

      </div>
    </>
  );
};