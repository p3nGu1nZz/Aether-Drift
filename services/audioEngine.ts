import { DroneLayerConfig } from '../types';

// Constants
const BASE_ROOT = 65.41; // C2
const CHORD_MULTIPLIERS = [1, 1.3333, 1.5, 1.6666, 0.8333]; // I, IV, V, vi (inv), vi (low)
const LFO_WAVEFORMS: OscillatorType[] = ['sine', 'triangle', 'square', 'sawtooth'];

// Helper to get random number in range
const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;

// Ratios for drone layers relative to root
// Adjusted for softer, warmer textures (less bright sawtooths)
const LAYER_RATIOS = [
  { ratio: 1.0, type: 'sine', detune: 2, pan: 0.05, gain: 0.6 }, // Fundamental
  { ratio: 1.01, type: 'sine', detune: 3, pan: 0.07, gain: 0.4 }, // Detuned Fund
  { ratio: 1.5, type: 'triangle', detune: 5, pan: 0.03, gain: 0.15 }, // Fifth
  { ratio: 2.0, type: 'sine', detune: 4, pan: 0.04, gain: 0.2 }, // Octave
  { ratio: 3.0, type: 'triangle', detune: 10, pan: 0.02, gain: 0.08 }, // Octave+Fifth (Twelfth) - changed to triangle for warmth
  { ratio: 2.25, type: 'sine', detune: 8, pan: 0.06, gain: 0.08 }, // Ninth
  { ratio: 0.5, type: 'square', detune: 12, pan: 0.04, gain: 0.03 }, // Sub-octave Square for thickness/texture
];

class MorphingLFO {
  ctx: AudioContext;
  output: GainNode;
  
  private oscA: OscillatorNode;
  private gainA: GainNode;
  
  private oscB: OscillatorNode;
  private gainB: GainNode;
  
  private activeOsc: 'A' | 'B' = 'A';
  private currentFreq: number;

  constructor(ctx: AudioContext, startFreq: number, startType: OscillatorType) {
     this.ctx = ctx;
     this.currentFreq = startFreq;
     
     this.output = ctx.createGain();
     // Output gain is 1, handled by connection destination
     this.output.gain.value = 1;

     // Setup A
     this.oscA = ctx.createOscillator();
     this.oscA.frequency.value = startFreq;
     this.oscA.type = startType;
     this.gainA = ctx.createGain();
     this.gainA.gain.value = 1;
     this.oscA.connect(this.gainA).connect(this.output);
     this.oscA.start();
     
     // Setup B
     this.oscB = ctx.createOscillator();
     this.oscB.frequency.value = startFreq; 
     this.oscB.type = startType;
     this.gainB = ctx.createGain();
     this.gainB.gain.value = 0;
     this.oscB.connect(this.gainB).connect(this.output);
     this.oscB.start();
  }

  transition(targetFreq: number, targetType: OscillatorType, duration: number) {
      const t = this.ctx.currentTime;
      
      const activeOsc = this.activeOsc === 'A' ? this.oscA : this.oscB;
      const activeGain = this.activeOsc === 'A' ? this.gainA : this.gainB;
      
      const nextOsc = this.activeOsc === 'A' ? this.oscB : this.oscA;
      const nextGain = this.activeOsc === 'A' ? this.gainB : this.gainA;

      // Frequency Ramp (Exponential)
      // Cancel any scheduled changes to avoid conflicts
      activeOsc.frequency.cancelScheduledValues(t);
      activeOsc.frequency.setValueAtTime(this.currentFreq, t);
      // Ensure target is safe for exponential ramp
      const safeTarget = Math.max(0.001, targetFreq);
      activeOsc.frequency.exponentialRampToValueAtTime(safeTarget, t + duration);

      // Check Waveform Change
      if (activeOsc.type !== targetType) {
          // Prepare next oscillator
          nextOsc.type = targetType;
          
          // Match frequency trajectory
          nextOsc.frequency.cancelScheduledValues(t);
          nextOsc.frequency.setValueAtTime(this.currentFreq, t);
          nextOsc.frequency.exponentialRampToValueAtTime(safeTarget, t + duration);
          
          // Crossfade Gains
          activeGain.gain.cancelScheduledValues(t);
          activeGain.gain.setValueAtTime(1, t);
          activeGain.gain.linearRampToValueAtTime(0, t + duration);
          
          nextGain.gain.cancelScheduledValues(t);
          nextGain.gain.setValueAtTime(0, t);
          nextGain.gain.linearRampToValueAtTime(1, t + duration);
          
          this.activeOsc = this.activeOsc === 'A' ? 'B' : 'A';
      } else {
           // Ensure the inactive one is silent
           nextGain.gain.cancelScheduledValues(t);
           nextGain.gain.setValueAtTime(0, t);
      }
      
      this.currentFreq = safeTarget;
  }
  
  stop() {
      const t = this.ctx.currentTime;
      this.gainA.gain.cancelScheduledValues(t);
      this.gainB.gain.cancelScheduledValues(t);
      this.gainA.gain.setTargetAtTime(0, t, 0.5);
      this.gainB.gain.setTargetAtTime(0, t, 0.5);
      
      setTimeout(() => {
          this.oscA.stop();
          this.oscB.stop();
          this.oscA.disconnect();
          this.oscB.disconnect();
          this.gainA.disconnect();
          this.gainB.disconnect();
          this.output.disconnect();
      }, 1000);
  }
}

class DroneLayer {
  private osc: OscillatorNode;
  private panNode: StereoPannerNode;
  private gainNode: GainNode; // Main envelope
  private tremoloGain: GainNode; // LFO modulation
  private filterNode: BiquadFilterNode;
  
  // Modulation Sources
  private lfoPan: OscillatorNode;
  private panModGain: GainNode;
  
  private lfoDetune: OscillatorNode;
  private detuneModGain: GainNode;

  // Replaced with MorphingLFO
  private lfoFilter: MorphingLFO;
  private filterModGain: GainNode;

  private lfoAmp: MorphingLFO;
  private ampModGain: GainNode;
  
  // Stored for frequency updates
  private currentRatio: number;
  private ctx: AudioContext;

  // Base depths for scaling
  private baseFilterDepth: number;
  private baseAmpDepth: number;
  private baseDetuneDepth: number;
  private basePanDepth: number;

  constructor(ctx: AudioContext, destination: AudioNode, config: any, rootFreq: number) {
    this.ctx = ctx;
    this.currentRatio = config.ratio;

    // Nodes
    this.osc = ctx.createOscillator();
    this.panNode = ctx.createStereoPanner();
    this.gainNode = ctx.createGain();
    this.tremoloGain = ctx.createGain(); // New Tremolo Node
    this.filterNode = ctx.createBiquadFilter();

    // Config
    this.osc.type = config.type as OscillatorType;
    this.osc.frequency.value = rootFreq * config.ratio;
    this.osc.detune.value = randomRange(-config.detune, config.detune);

    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.value = (rootFreq * config.ratio) * 4; 
    this.filterNode.Q.value = 0.5;

    this.gainNode.gain.value = 0; // Start silent (Envelope)
    this.tremoloGain.gain.value = 1.0; // Pass through

    // --- 1. Pan Modulation ---
    this.lfoPan = ctx.createOscillator();
    this.lfoPan.frequency.value = config.pan; // Use config speed
    this.lfoPan.type = 'sine'; // Keep pan smooth usually
    
    this.panModGain = ctx.createGain();
    this.basePanDepth = 0.9;
    this.panModGain.gain.value = this.basePanDepth;
    this.lfoPan.connect(this.panModGain).connect(this.panNode.pan);

    // --- 2. Detune Modulation (Chorus/Drift) ---
    this.lfoDetune = ctx.createOscillator();
    this.lfoDetune.frequency.value = randomRange(0.05, 0.25); 
    this.lfoDetune.type = this.getRandomWaveform();
    
    this.detuneModGain = ctx.createGain();
    this.baseDetuneDepth = randomRange(5, 15);
    this.detuneModGain.gain.value = this.baseDetuneDepth;
    this.lfoDetune.connect(this.detuneModGain).connect(this.osc.detune);

    // --- 3. Filter Frequency Modulation (Complex Texture) ---
    // Use MorphingLFO
    const filterLfoFreq = randomRange(0.05, 0.5);
    const filterLfoType = this.getRandomWaveform();
    this.lfoFilter = new MorphingLFO(ctx, filterLfoFreq, filterLfoType);

    this.filterModGain = ctx.createGain();
    this.baseFilterDepth = randomRange(50, 200);
    this.filterModGain.gain.value = this.baseFilterDepth;
    this.lfoFilter.output.connect(this.filterModGain).connect(this.filterNode.frequency);

    // --- 4. Amplitude Modulation (Tremolo/Pulse) ---
    // Use MorphingLFO
    const ampLfoFreq = randomRange(0.1, 3.0);
    const ampLfoType = Math.random() > 0.3 ? (Math.random() > 0.5 ? 'sine' : 'triangle') : this.getRandomWaveform();
    this.lfoAmp = new MorphingLFO(ctx, ampLfoFreq, ampLfoType);

    this.ampModGain = ctx.createGain();
    this.baseAmpDepth = 0.25; // Keep it subtle max
    this.ampModGain.gain.value = this.baseAmpDepth;
    this.lfoAmp.output.connect(this.ampModGain).connect(this.tremoloGain.gain);


    // Chain: Osc -> Filter -> Gain(Env) -> Tremolo -> Panner -> Dest
    this.osc.connect(this.filterNode);
    this.filterNode.connect(this.gainNode);
    this.gainNode.connect(this.tremoloGain);
    this.tremoloGain.connect(this.panNode);
    this.panNode.connect(destination);

    // Start Oscillators
    this.osc.start();
    this.lfoPan.start();
    this.lfoDetune.start();
    // MorphingLFOs start automatically in constructor
  }

  private getRandomWaveform(): OscillatorType {
      return LFO_WAVEFORMS[Math.floor(Math.random() * LFO_WAVEFORMS.length)];
  }

  setGain(val: number, time: number) {
    this.gainNode.gain.setTargetAtTime(val, time, 4); 
  }

  // New method to scale modulation depth dynamically
  setModulationDepth(depth: number, time: number) {
      // depth is 0.0 to 1.0 (or higher)
      this.filterModGain.gain.setTargetAtTime(this.baseFilterDepth * depth, time, 0.5);
      this.ampModGain.gain.setTargetAtTime(this.baseAmpDepth * depth, time, 0.5);
      this.detuneModGain.gain.setTargetAtTime(this.baseDetuneDepth * depth, time, 0.5);
  }

  updateFrequency(newRoot: number, duration: number) {
    const target = newRoot * this.currentRatio;
    this.osc.frequency.exponentialRampToValueAtTime(target, this.ctx.currentTime + duration);
    this.filterNode.frequency.exponentialRampToValueAtTime(target * 4, this.ctx.currentTime + duration);
  }

  // Called periodically to evolve LFOs
  evolve(duration: number) {
    // Evolve Filter LFO
    if (Math.random() > 0.4) {
        const newFreq = randomRange(0.05, 0.8);
        const newType = this.getRandomWaveform();
        this.lfoFilter.transition(newFreq, newType, duration);
    }
    
    // Evolve Amp LFO
    if (Math.random() > 0.4) {
        const newFreq = randomRange(0.1, 4.0);
        // Bias towards smoother types for Amp
        const newType = Math.random() > 0.3 ? (Math.random() > 0.5 ? 'sine' : 'triangle') : this.getRandomWaveform();
        this.lfoAmp.transition(newFreq, newType, duration);
    }
  }

  stop() {
    const t = this.ctx.currentTime;
    this.gainNode.gain.cancelScheduledValues(t);
    this.gainNode.gain.setTargetAtTime(0, t, 1);
    
    setTimeout(() => {
      this.osc.stop();
      this.lfoPan.stop();
      this.lfoDetune.stop();
      
      this.lfoFilter.stop();
      this.lfoAmp.stop();

      this.osc.disconnect();
      this.lfoPan.disconnect();
      this.lfoDetune.disconnect();
      
      this.panModGain.disconnect();
      this.detuneModGain.disconnect();
      this.filterModGain.disconnect();
      this.ampModGain.disconnect();
      
      this.gainNode.disconnect();
      this.tremoloGain.disconnect();
      this.panNode.disconnect();
      this.filterNode.disconnect();
    }, 4000);
  }
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  
  // Effects
  private compressor: DynamicsCompressorNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private fxBus: GainNode | null = null;

  // Background Noise
  private noiseNode: AudioBufferSourceNode | null = null;
  private noiseGain: GainNode | null = null;

  private layers: DroneLayer[] = [];
  
  // State
  private isPlaying = false;
  private currentRoot = BASE_ROOT;
  private chordIntervalId: any = null;
  private arpTimeoutId: any = null;
  private evolutionIntervalId: any = null;

  // Init
  public init() {
    if (this.ctx) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
    if (!this.ctx) return;

    // Master Chain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.6; // Slightly lower to prevent clipping with chords

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 10;
    this.compressor.ratio.value = 8;
    this.compressor.attack.value = 0.05;
    this.compressor.release.value = 0.5;
    
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.9;

    // FX Bus (Sends to Reverb/Delay)
    this.fxBus = this.ctx.createGain();
    this.fxBus.gain.value = 1.0;

    // Delay Setup (Long, dubby delays)
    this.delayNode = this.ctx.createDelay(10.0);
    this.delayNode.delayTime.value = 1.5; 
    this.delayFeedback = this.ctx.createGain();
    this.delayFeedback.gain.value = 0.5;

    // Filter the delay repeats so they get darker
    const delayFilter = this.ctx.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.value = 2000;
    delayFilter.Q.value = 0.5;

    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(delayFilter);
    delayFilter.connect(this.delayNode);

    // Reverb Setup (Massive Space)
    this.reverbNode = this.ctx.createConvolver();
    // 12 seconds duration, 4 seconds decay for massive ambient wash
    const impulse = this.createImpulse(12, 4); 
    if (impulse) this.reverbNode.buffer = impulse;

    // Routing
    const reverbGain = this.ctx.createGain();
    reverbGain.gain.value = 0.6; // Wet

    const delayGain = this.ctx.createGain();
    delayGain.gain.value = 0.3;

    // Connect FX Chain
    this.fxBus.connect(this.delayNode);
    this.delayNode.connect(delayGain); // Delay Out
    delayGain.connect(this.masterGain);

    this.fxBus.connect(this.reverbNode);
    this.delayNode.connect(this.reverbNode); // Delay feeds reverb for diffusion
    this.reverbNode.connect(reverbGain); // Reverb Out
    reverbGain.connect(this.masterGain);

    this.masterGain.connect(this.compressor);
    this.compressor.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  private createImpulse(duration: number, decay: number): AudioBuffer | null {
    if (!this.ctx) return null;
    const rate = this.ctx.sampleRate;
    const length = rate * duration;
    const impulse = this.ctx.createBuffer(2, length, rate);
    for (let c = 0; c < 2; c++) {
      const chan = impulse.getChannelData(c);
      for (let i = 0; i < length; i++) {
        const n = length - i;
        const env = Math.pow(n / length, decay);
        chan[i] = (Math.random() * 2 - 1) * env;
      }
    }
    return impulse;
  }

  // --- Controls ---

  public setDelayFeedback(amount: number) {
    if (this.delayFeedback) {
        // Clamp between 0 and 0.95 to prevent runaway feedback
        this.delayFeedback.gain.setTargetAtTime(Math.min(amount, 0.95), this.ctx?.currentTime || 0, 0.1);
    }
  }

  public setReverbDecay(seconds: number) {
    if (this.reverbNode && this.ctx) {
        const impulse = this.createImpulse(seconds, 4);
        if (impulse) {
            this.reverbNode.buffer = impulse;
        }
    }
  }

  public setModulation(amount: number) {
      // Amount 0 to 1 (or 2.0 for extreme)
      if (this.ctx && this.layers.length > 0) {
          const t = this.ctx.currentTime;
          this.layers.forEach(l => l.setModulationDepth(amount, t));
      }
  }

  private startBackgroundNoise() {
    if (!this.ctx || !this.fxBus) return;
    
    // Create subtle colored noise for organic texture
    const bufferSize = this.ctx.sampleRate * 4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Pink noise approximation
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        data[i] *= 0.11; // Compensate gain
        b6 = white * 0.115926;
    }

    this.noiseNode = this.ctx.createBufferSource();
    this.noiseNode.buffer = buffer;
    this.noiseNode.loop = true;

    this.noiseGain = this.ctx.createGain();
    this.noiseGain.gain.value = 0.04; // Very subtle bed

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 300; // Deep rumble
    
    this.noiseNode.connect(noiseFilter).connect(this.noiseGain).connect(this.fxBus);
    this.noiseNode.start();
  }

  public async play() {
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    if (this.isPlaying) return;
    this.isPlaying = true;

    // Start Layers
    if (this.layers.length === 0) {
      this.layers = LAYER_RATIOS.map(config => 
        new DroneLayer(this.ctx!, this.fxBus!, config, this.currentRoot)
      );
    }

    // Start Texture
    this.startBackgroundNoise();

    // Fade In
    const now = this.ctx.currentTime;
    this.layers.forEach((l, i) => l.setGain(LAYER_RATIOS[i].gain, now));

    // Start Procedural Logic
    this.scheduleChordChanges();
    this.scheduleArp();
    this.scheduleLFOEvolution(); // Start evolving LFOs
  }

  public pause() {
    if (!this.ctx || !this.isPlaying) return;
    this.isPlaying = false;

    // Stop Loops
    if (this.chordIntervalId) clearInterval(this.chordIntervalId);
    if (this.arpTimeoutId) clearTimeout(this.arpTimeoutId);
    if (this.evolutionIntervalId) clearTimeout(this.evolutionIntervalId);

    // Stop Noise
    if (this.noiseGain) {
        this.noiseGain.gain.setTargetAtTime(0, this.ctx.currentTime, 1);
        setTimeout(() => {
            this.noiseNode?.stop();
            this.noiseNode?.disconnect();
            this.noiseGain?.disconnect();
        }, 1500);
    }

    // Fade Out Layers
    const now = this.ctx.currentTime;
    this.layers.forEach(l => l.setGain(0, now));
    
    // Cleanup layers after fade
    setTimeout(() => {
        if (!this.isPlaying) { 
            this.layers.forEach(l => l.stop());
            this.layers = [];
        }
    }, 4500);
  }

  // --- Procedural Generation Logic ---

  private scheduleChordChanges() {
    const duration = randomRange(15000, 25000); // Slower chord changes
    
    this.chordIntervalId = setTimeout(() => {
        if (!this.isPlaying) return;

        const mult = CHORD_MULTIPLIERS[Math.floor(Math.random() * CHORD_MULTIPLIERS.length)];
        const newRoot = BASE_ROOT * mult;
        
        if (this.ctx) {
            const transitionTime = randomRange(6, 12); // Very slow glide
            this.layers.forEach(l => l.updateFrequency(newRoot, transitionTime));
            this.currentRoot = newRoot;
        }

        this.scheduleChordChanges(); 
    }, duration);
  }
  
  private scheduleLFOEvolution() {
      // Updates LFOs every 10-15 seconds
      const duration = randomRange(10000, 15000);
      
      this.evolutionIntervalId = setTimeout(() => {
          if (!this.isPlaying) return;
          
          if (this.ctx) {
              const rampDuration = randomRange(4, 8); // Slow morph over 4-8s
              this.layers.forEach(l => l.evolve(rampDuration));
          }
          
          this.scheduleLFOEvolution();
      }, duration);
  }

  private scheduleArp() {
    // Slower interval because notes are much longer now
    const interval = randomRange(6000, 12000);

    this.arpTimeoutId = setTimeout(() => {
        if (!this.isPlaying || !this.ctx) return;
        this.playChordSwell();
        this.scheduleArp(); 
    }, interval);
  }

  private playChordSwell() {
    if (!this.ctx || !this.fxBus) return;

    // Define harmonic series multipliers for lush chords
    const chordIntervals = [1, 1.25, 1.5, 2, 3, 4, 6]; // Root, Maj3, 5th, Octave...
    
    // Pick 3 random distinct intervals to form a cluster/chord
    const selectedIntervals: number[] = [];
    while (selectedIntervals.length < 3) {
        const idx = Math.floor(Math.random() * chordIntervals.length);
        const val = chordIntervals[idx];
        if (!selectedIntervals.includes(val)) selectedIntervals.push(val);
    }

    // Common timing for the chord swell
    const t = this.ctx.currentTime;
    const attack = randomRange(4, 8);
    const sustain = randomRange(8, 14);
    const release = randomRange(8, 12);
    const totalDur = attack + sustain + release;

    // Play each note in the chord
    selectedIntervals.forEach(interval => {
        if (!this.ctx || !this.fxBus) return;

        const freq = this.currentRoot * interval;
        
        // --- Voice Structure: Dual Oscillator (Detuned) ---
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const voiceGain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        const panner = this.ctx.createStereoPanner();

        // Waveforms - Mix sine and triangle for body without harshness
        osc1.type = 'sine';
        osc2.type = 'triangle';

        // Frequency & Detune
        osc1.frequency.value = freq;
        // Subtle detune for organic phasing
        osc2.frequency.value = freq * (1 + randomRange(0.002, 0.005)); 

        // Filter Setup
        filter.type = 'lowpass';
        filter.Q.value = 1;

        // Panning
        panner.pan.value = randomRange(-0.7, 0.7);

        // Connections
        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(voiceGain);
        voiceGain.connect(panner);
        panner.connect(this.fxBus);

        // --- Envelopes (The "Swell") ---

        // 1. Amplitude Envelope
        voiceGain.gain.setValueAtTime(0, t);
        // Swell in slowly
        voiceGain.gain.linearRampToValueAtTime(0.15, t + attack); 
        // Hold (slight movement optional, but static is fine for drone)
        voiceGain.gain.setValueAtTime(0.15, t + attack + sustain);
        // Fade out
        voiceGain.gain.exponentialRampToValueAtTime(0.001, t + totalDur);

        // 2. Filter Envelope (Timbral Swell)
        // Start closed
        filter.frequency.setValueAtTime(freq * 1.5, t);
        // Open up during attack/sustain
        filter.frequency.exponentialRampToValueAtTime(freq * 6, t + attack + (sustain/2));
        // Close down during release
        filter.frequency.exponentialRampToValueAtTime(freq, t + totalDur);

        // Start/Stop
        osc1.start(t);
        osc2.start(t);
        osc1.stop(t + totalDur + 2);
        osc2.stop(t + totalDur + 2);

        // Cleanup
        setTimeout(() => {
            osc1.disconnect();
            osc2.disconnect();
            voiceGain.disconnect();
            filter.disconnect();
            panner.disconnect();
        }, (totalDur + 2) * 1000);
    });
  }

  public getAnalyser() {
    return this.analyser;
  }
}

export const audioEngine = new AudioEngine();