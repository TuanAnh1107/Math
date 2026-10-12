import type { CSSProperties } from 'react';

export const motionTokens = {
  duration: { feedback: 160, detail: 260, scene: 380, reveal: 540 },
  easing: { settle: 'cubic-bezier(.16,1,.3,1)', cinematic: 'cubic-bezier(.22,.68,0,1)' },
  spring: { responseMs: 86, settleThreshold: 0.002 },
  depth: { perspective: 1000, tiltX: 1.5, tiltY: 2 },
  lighting: { radius: 340, strength: 0.16 },
} as const;

export const motionVariables = {
  '--motion-feedback': `${motionTokens.duration.feedback}ms`,
  '--motion-detail': `${motionTokens.duration.detail}ms`,
  '--motion-scene': `${motionTokens.duration.scene}ms`,
  '--motion-reveal': `${motionTokens.duration.reveal}ms`,
  '--motion-settle': motionTokens.easing.settle,
  '--motion-cinematic': motionTokens.easing.cinematic,
  '--motion-perspective': `${motionTokens.depth.perspective}px`,
  '--light-radius': `${motionTokens.lighting.radius}px`,
  '--light-strength': motionTokens.lighting.strength,
} as CSSProperties;

// Frame-rate independent damping. It settles instead of running an idle RAF loop.
export function settlePointer(current: number, target: number, elapsedMs: number) {
  return current + (target - current) * (1 - Math.exp(-Math.min(64, Math.max(0, elapsedMs)) / motionTokens.spring.responseMs));
}
