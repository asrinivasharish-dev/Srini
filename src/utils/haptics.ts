/**
 * Mobile Haptics & Sound Feedback for Android UX
 */

let audioCtx: AudioContext | null = null;

export function triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' = 'light') {
  // 1. Android Web Vibration API
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      switch (type) {
        case 'light':
          navigator.vibrate(10);
          break;
        case 'medium':
          navigator.vibrate(25);
          break;
        case 'heavy':
          navigator.vibrate(45);
          break;
        case 'success':
          navigator.vibrate([15, 50, 25]);
          break;
        case 'warning':
          navigator.vibrate([40, 40, 40]);
          break;
      }
    } catch {
      // ignore
    }
  }

  // 2. Subtle Audio click synthesized with Web Audio
  try {
    if (!audioCtx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }

    if (audioCtx && audioCtx.state === 'running') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      const freq = type === 'success' ? 587 : type === 'heavy' ? 180 : 340;
      const duration = type === 'success' ? 0.08 : 0.03;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    }
  } catch {
    // audio context muted/restricted
  }
}
