import React, { useState, useEffect, useCallback } from 'react';
import { audioEngine } from './services/audioEngine';
import { Visualizer } from './components/Visualizer';
import { Controls } from './components/Controls';
import { AudioState } from './types';

function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [sensitivity, setSensitivity] = useState(1.0);
  const [isImmersive, setIsImmersive] = useState(false);
  
  // Audio Effect State
  const [reverbDecay, setReverbDecay] = useState(12);
  const [delayFeedback, setDelayFeedback] = useState(0.5);
  const [modulation, setModulation] = useState(0.5);

  const togglePlay = useCallback(async () => {
    if (isPlaying) {
      audioEngine.pause();
      setIsPlaying(false);
      setIsImmersive(false); // Reset to main menu immediately on pause
    } else {
      // Must be called on user interaction
      await audioEngine.play();
      // Wait a tick to ensure context is ready and analyser is attached
      setAnalyser(audioEngine.getAnalyser());
      
      // Sync initial state values
      audioEngine.setReverbDecay(reverbDecay);
      audioEngine.setDelayFeedback(delayFeedback);
      audioEngine.setModulation(modulation);
      
      setIsPlaying(true);
    }
  }, [isPlaying, reverbDecay, delayFeedback, modulation]);

  // Handle effect updates
  const handleReverbChange = (val: number) => {
    setReverbDecay(val);
    if (isPlaying) audioEngine.setReverbDecay(val);
  };

  const handleDelayChange = (val: number) => {
    setDelayFeedback(val);
    if (isPlaying) audioEngine.setDelayFeedback(val);
  };

  const handleModulationChange = (val: number) => {
    setModulation(val);
    if (isPlaying) audioEngine.setModulation(val);
  };

  // Handle immersive mode timer
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (isPlaying) {
      timeout = setTimeout(() => {
        setIsImmersive(true);
      }, 5000); // Extended to 5s to allow for adjustment
    }
    return () => clearTimeout(timeout);
  }, [isPlaying, sensitivity, reverbDecay, delayFeedback, modulation]); // Reset timer on interaction

  // Spacebar shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay]);

  return (
    <div className="relative w-full h-screen bg-slate-900 overflow-hidden flex items-center justify-center selection:bg-cyan-500/30">
      
      {/* Background Gradient Mesh (Visual Decoration) */}
      <div className={`absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 transition-opacity duration-[2000ms] ${isPlaying ? 'opacity-100' : 'opacity-80'}`} />
      
      <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none bg-[radial-gradient(circle_at_50%_50%,_rgba(56,189,248,0.1),_transparent_70%)]" />

      {/* Visualizer Layer */}
      <Visualizer analyser={analyser} isPlaying={isPlaying} sensitivity={sensitivity} />

      {/* UI Layer */}
      <Controls 
        isPlaying={isPlaying} 
        onToggle={togglePlay} 
        sensitivity={sensitivity}
        onSensitivityChange={setSensitivity}
        reverbDecay={reverbDecay}
        onReverbDecayChange={handleReverbChange}
        delayFeedback={delayFeedback}
        onDelayFeedbackChange={handleDelayChange}
        modulation={modulation}
        onModulationChange={handleModulationChange}
        isImmersive={isImmersive}
      />

    </div>
  );
}

export default App;