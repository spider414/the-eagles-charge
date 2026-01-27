import { useCallback } from "react";

// Sound effect types
type SoundType = "click" | "success" | "error" | "notification" | "toggle";

// Create audio context lazily to avoid autoplay restrictions
let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

// Sound configurations (frequency, duration, type)
const soundConfigs: Record<SoundType, { freq: number; duration: number; type: OscillatorType; gain: number }> = {
  click: { freq: 800, duration: 0.05, type: "sine", gain: 0.1 },
  success: { freq: 880, duration: 0.15, type: "sine", gain: 0.15 },
  error: { freq: 200, duration: 0.2, type: "square", gain: 0.1 },
  notification: { freq: 660, duration: 0.1, type: "sine", gain: 0.12 },
  toggle: { freq: 600, duration: 0.03, type: "sine", gain: 0.08 },
};

// Check if sound effects are enabled
const isSoundEnabled = (): boolean => {
  return localStorage.getItem("soundEffects") !== "false";
};

// Play a synthesized sound
const playSynthSound = (type: SoundType) => {
  if (!isSoundEnabled()) return;

  try {
    const ctx = getAudioContext();
    const config = soundConfigs[type];

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = config.type;
    oscillator.frequency.setValueAtTime(config.freq, ctx.currentTime);

    gainNode.gain.setValueAtTime(config.gain, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + config.duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + config.duration);

    // Play success sound as a chord for better effect
    if (type === "success") {
      const oscillator2 = ctx.createOscillator();
      const gainNode2 = ctx.createGain();
      oscillator2.type = "sine";
      oscillator2.frequency.setValueAtTime(1100, ctx.currentTime);
      gainNode2.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      oscillator2.connect(gainNode2);
      gainNode2.connect(ctx.destination);
      oscillator2.start(ctx.currentTime + 0.05);
      oscillator2.stop(ctx.currentTime + 0.25);
    }
  } catch (error) {
    console.error("Sound playback error:", error);
  }
};

export const useSoundEffects = () => {
  const playClick = useCallback(() => playSynthSound("click"), []);
  const playSuccess = useCallback(() => playSynthSound("success"), []);
  const playError = useCallback(() => playSynthSound("error"), []);
  const playNotification = useCallback(() => playSynthSound("notification"), []);
  const playToggle = useCallback(() => playSynthSound("toggle"), []);

  const isEnabled = useCallback(() => isSoundEnabled(), []);

  const testSound = useCallback(() => {
    // Play a quick demo sequence
    playSynthSound("click");
    setTimeout(() => playSynthSound("toggle"), 100);
    setTimeout(() => playSynthSound("success"), 200);
  }, []);

  return {
    playClick,
    playSuccess,
    playError,
    playNotification,
    playToggle,
    testSound,
    isEnabled,
  };
};

// Export for direct use without hook
export const playSound = playSynthSound;
