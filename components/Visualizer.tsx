import React, { useEffect, useRef } from 'react';
import { VisualizerProps } from '../types';

export const Visualizer: React.FC<VisualizerProps> = ({ analyser, isPlaying, sensitivity }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  // Store history of frequency data for the 3D effect
  const historyRef = useRef<Uint8Array[]>([]);
  // Use a ref for sensitivity to avoid restarting the animation loop on change
  const sensitivityRef = useRef(sensitivity);

  useEffect(() => {
    sensitivityRef.current = sensitivity;
  }, [sensitivity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    // Visualizer Configuration
    const HISTORY_SIZE = 60; 
    const FILL_COLOR = '#0f172a'; // Match background (Slate 900)
    
    // Allocate data array once
    let dataArray: Uint8Array;

    const draw = () => {
      // 1. Update Data
      if (analyser && isPlaying) {
        if (!dataArray || dataArray.length !== analyser.frequencyBinCount) {
            dataArray = new Uint8Array(analyser.frequencyBinCount);
        }
        analyser.getByteFrequencyData(dataArray);
        
        // Add copy to history (Newest at index 0)
        historyRef.current.unshift(new Uint8Array(dataArray));
        
        // Trim history
        if (historyRef.current.length > HISTORY_SIZE) {
          historyRef.current.pop();
        }
      }

      // 2. Clear Canvas
      ctx.fillStyle = FILL_COLOR;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 3. Draw Waterfall
      // Render from Back (oldest) to Front (newest) so front lines cover back lines
      const centerX = canvas.width / 2;
      const startY = canvas.height * 0.75; 
      
      // Increased scaling factor from 1.5 to 3.5 to make it very wide and immersive
      const sliceWidthBase = canvas.width * 3.5; 
      const verticalSpacing = canvas.height * 0.015; 
      const perspectiveShrink = 0.985; 

      // Time factor for organic movement
      const time = performance.now() / 1000;
      // Gentle breathing effect on the overall scale
      const breath = 1 + Math.sin(time * 0.5) * 0.05;

      for (let i = historyRef.current.length - 1; i >= 0; i--) {
        const data = historyRef.current[i];
        
        // Calculate perspective variables
        const scale = Math.pow(perspectiveShrink, i);
        // Move lines up as they go back (i increases)
        const yBase = startY - (i * verticalSpacing * scale); 
        
        // Organic Drift: Sine wave offset based on time and depth (i)
        // Creates a slow, snake-like swaying motion
        const drift = Math.sin(time * 0.3 + i * 0.05) * (canvas.width * 0.04);
        
        const sliceWidth = sliceWidthBase * scale;
        const xStart = centerX - (sliceWidth / 2) + drift;
        
        ctx.beginPath();
        ctx.moveTo(xStart, yBase);

        // Draw frequency data points
        const sliceCount = 256; 
        const dataMaxIndex = Math.floor(data.length * 0.85);
        const step = dataMaxIndex / sliceCount;

        for (let j = 0; j <= sliceCount; j++) {
            const dataIndex = Math.floor(j * step);
            const value = data[dataIndex] || 0;
            
            // X position
            const x = xStart + (j / sliceCount) * sliceWidth;
            
            // Y position
            // Scale amplitude by perspective, screen height, SENSITIVITY, and BREATH
            const amp = (value / 255.0) * (canvas.height * 0.3) * scale * sensitivityRef.current * breath;
            const y = yBase - amp;

            ctx.lineTo(x, y);
        }
        
        // Close path for filling (Occlusion)
        const bottomOffset = canvas.height * 0.5; 
        ctx.lineTo(xStart + sliceWidth, yBase);
        ctx.lineTo(xStart + sliceWidth, yBase + bottomOffset);
        ctx.lineTo(xStart, yBase + bottomOffset);
        ctx.closePath();

        // Fill (matches background to hide lines behind)
        ctx.fillStyle = FILL_COLOR;
        ctx.fill();

        // Stroke (The visible line)
        // Fade out older lines slightly
        const opacity = 1 - (i / (HISTORY_SIZE * 1.5));
        ctx.lineWidth = 1.5 * scale;
        
        // Dynamic Color: Drift between Cyan/Teal/Blue (Hue 160-200)
        // Adjust lightness based on amplitude for a "glowing" effect on loud peaks
        const hue = 180 + Math.sin(time * 0.1 + i * 0.02) * 20;
        ctx.strokeStyle = `hsla(${hue}, 80%, 60%, ${opacity})`; 
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [analyser, isPlaying]); 

  return <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" />;
};