"use client";

import React, { useEffect, useRef, useState } from "react";

const VERTEX_SHADER_SOURCE = `
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER_SOURCE = `
  precision mediump float;
  varying vec2 vUv;
  uniform float u_time;
  uniform float u_load; // 0.0 to 1.0 animation uniform

  // Simple pseudo-random hash function
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    // Generate a slow-motion horizontal wave traveling from left to right
    float wave = sin(vUv.x * 2.2 - u_time * 0.33) * 0.045;
    
    // Stable gradient factor calculation (gradient covers 94% height)
    float limit = 0.94;
    float stableFactor = clamp((vUv.y + wave) / limit, 0.0, 1.0);
    
    // Symmetric sides peak curve: 0.0 at center (0.5), rises to 1.0 at sides (0.0 and 1.0)
    float sidesPeak = 4.0 * (vUv.x - 0.5) * (vUv.x - 0.5);
    
    // Symmetric rising wave coordinate: sidesPeak offset makes the left and right sides stay low/black longer,
    // meaning the center part of the gradient rises vertically first and spreads outwards to the sides
    float riseCoord = vUv.y + 0.26 * sidesPeak + wave;
    
    // Animating threshold from -0.22 (completely black) to 1.33 (fully loaded stable gradient)
    float threshold = u_load * 1.55 - 0.22;
    
    // transition = 1.0 (pure black), transition = 0.0 (fully active gradient colors)
    float transition = smoothstep(threshold - 0.15, threshold, riseCoord);
    
    // Blend between stable gradient and pure black based on the rising transition line
    float factor = mix(stableFactor, 1.0, transition);
    
    // Colors: Gemini-inspired vertical gradient
    // 1. Light Sky Blue (Bottom)
    vec3 lightBlue = vec3(0.0, 0.72, 1.0); // #00b8e8
    // 2. Rich Dark Blue (Middle)
    vec3 darkBlue = vec3(0.015, 0.07, 0.52); // #041285 (Vibrant Dark Blue)
    // 3. Deep Indigo Transition
    vec3 deepIndigo = vec3(0.01, 0.02, 0.12); // #03051f
    // 4. Pure Black (Top)
    vec3 black = vec3(0.02, 0.02, 0.04); // #05050a
    
    vec3 color = black;
    
    // Smooth 3-stage vertical gradient transition
    if (factor < 0.46) {
      // Transition from light blue to dark blue (covers bottom 46% of the gradient)
      float t = smoothstep(0.0, 0.46, factor);
      color = mix(lightBlue, darkBlue, t);
    } else if (factor < 0.82) {
      // Transition from dark blue to deep indigo (covers middle region up to 82%)
      float t = smoothstep(0.46, 0.82, factor);
      color = mix(darkBlue, deepIndigo, t);
    } else {
      // Transition from deep indigo to black (fades to black at the very top 6% of screen)
      float t = smoothstep(0.82, 1.0, factor);
      color = mix(deepIndigo, black, t);
    }
    
    // Noise grain texture (0.11 intensity) - active over the whole screen from the start
    float timeStep = floor(u_time * 15.0);
    vec2 grainSeed = vUv + vec2(hash(vec2(timeStep, 1.1)), hash(vec2(timeStep, 2.2)));
    float grainVal = hash(grainSeed);
    float grain = (grainVal - 0.5) * 0.11;
    
    // Apply grain (is applied even when factor is 1.0, producing grain on black base)
    color += vec3(grain);
    
    // Clamp to valid range
    color = clamp(color, 0.0, 1.0);
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

export default function GradientBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl");
    if (!gl) {
      console.warn("WebGL not supported");
      return;
    }

    // Shader compiler helper
    const compileShader = (source: string, type: number): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compile error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compileShader(VERTEX_SHADER_SOURCE, gl.VERTEX_SHADER);
    const fs = compileShader(FRAGMENT_SHADER_SOURCE, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    // Quad position buffer
    const vertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLoc = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    const timeLoc = gl.getUniformLocation(program, "u_time");
    const loadLoc = gl.getUniformLocation(program, "u_load");

    // Handling window resize
    const resize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    window.addEventListener("resize", resize);
    resize();

    let animationFrameId: number;
    const startTime = performance.now();

    const render = () => {
      const elapsed = (performance.now() - startTime) / 1000.0;
      gl.uniform1f(timeLoc, elapsed);

      // Animate u_load from 0.0 to 1.0 over 3.0 seconds using ease-out cubic
      const duration = 3.0;
      const t = Math.min(elapsed / duration, 1.0);
      const loadVal = 1.0 - Math.pow(1.0 - t, 3.0); // easeOutCubic
      gl.uniform1f(loadLoc, loadVal);

      gl.clearColor(0.02, 0.02, 0.04, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
    };
  }, [mounted]);

  return (
    <>
      {/* === DARK BASE BACKGROUND === */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          backgroundColor: "#05050a",
        }}
      />

      {/* === WEBGL CANVAS LAYER — always static, colors animate internally === */}
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 1,
          display: "block",
          pointerEvents: "none",
        }}
      />

      {/* === SECONDARY NOISY SHIMMERING OVERLAY === */}
      <div
        style={{
          position: "fixed",
          inset: "-5%",
          width: "110%",
          height: "110%",
          zIndex: 2,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        <svg
          style={{
            width: "100%",
            height: "100%",
            opacity: 0.035, // Static noise texture active from 1st frame
            animation: "noiseAnimation 0.22s steps(4) infinite",
          }}
        >
          <filter id="noiseFilter">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.85"
              numOctaves="3"
              stitchTiles="stitch"
            />
          </filter>
          <rect width="100%" height="100%" filter="url(#noiseFilter)" />
        </svg>
      </div>

      <style>{`
        @keyframes noiseAnimation {
          0%   { transform: translate(0px, 0px); }
          10%  { transform: translate(-8px, 8px); }
          20%  { transform: translate(4px, -4px); }
          30%  { transform: translate(-4px, 4px); }
          40%  { transform: translate(8px, -8px); }
          50%  { transform: translate(-8px, 4px); }
          60%  { transform: translate(4px, 8px); }
          70%  { transform: translate(-4px, -4px); }
          80%  { transform: translate(8px, 4px); }
          90%  { transform: translate(-4px, -8px); }
          100% { transform: translate(0px, 0px); }
        }
      `}</style>
    </>
  );
}
