type SoundType = "start" | "stop";
type SoundPreset = "none" | "beep" | "click" | "chime";

let audioContext: AudioContext | null = null;

function getContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

export async function playSound(
  type: SoundType,
  preset: SoundPreset
): Promise<void> {
  if (preset === "none") return;

  try {
    const ctx = getContext();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    const now = ctx.currentTime;

    oscillator.addEventListener('ended', () => {
      oscillator.disconnect();
      gainNode.disconnect();
    });

    switch (`${type}/${preset}`) {
      case "start/beep":
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(880, now);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        oscillator.start(now);
        oscillator.stop(now + 0.1);
        break;

      case "stop/beep":
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(440, now);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        oscillator.start(now);
        oscillator.stop(now + 0.15);
        break;

      case "start/click":
        oscillator.type = "square";
        oscillator.frequency.setValueAtTime(1000, now);
        gainNode.gain.setValueAtTime(0.08, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        oscillator.start(now);
        oscillator.stop(now + 0.05);
        break;

      case "stop/click":
        oscillator.type = "square";
        oscillator.frequency.setValueAtTime(800, now);
        gainNode.gain.setValueAtTime(0.08, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        oscillator.start(now);
        oscillator.stop(now + 0.05);
        break;

      case "start/chime": {
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(523.25, now); // C5
        oscillator.frequency.linearRampToValueAtTime(659.25, now + 0.3); // E5
        gainNode.gain.setValueAtTime(0.12, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        oscillator.start(now);
        oscillator.stop(now + 0.3);
        break;
      }

      case "stop/chime": {
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(659.25, now); // E5
        oscillator.frequency.linearRampToValueAtTime(523.25, now + 0.3); // C5
        gainNode.gain.setValueAtTime(0.12, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        oscillator.start(now);
        oscillator.stop(now + 0.3);
        break;
      }
    }
  } catch {
    // Audio playback is best-effort, never block the app
  }
}

export type { SoundType, SoundPreset };
