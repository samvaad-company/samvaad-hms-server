"use client";

/**
 * Client-side audio conditioning for the consultation scribe.
 *
 * Browsers record `audio/webm; codecs=opus`, but Sarvam's speech-to-text API
 * expects WAV/MP3, and its synchronous endpoint caps each clip at ~30s. This
 * module decodes the recording, downmixes to 16 kHz mono, and slices it into
 * WAV chunks that Sarvam accepts — so full multi-minute consultations transcribe
 * reliably instead of silently falling back to the demo transcript.
 */

const TARGET_RATE = 16000;

/** Encode mono Float32 PCM samples as a 16-bit PCM WAV blob. */
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM subchunk size
  view.setUint16(20, 1, true); // audio format = PCM
  view.setUint16(22, 1, true); // channels = mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([view], { type: "audio/wav" });
}

/** Decode any recorded blob to a 16 kHz mono Float32 PCM track. */
async function decodeToMono16k(blob: Blob): Promise<Float32Array> {
  const AudioCtx: typeof AudioContext =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new AudioCtx();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  } finally {
    void ctx.close();
  }

  const length = Math.max(1, Math.ceil(decoded.duration * TARGET_RATE));
  const offline = new OfflineAudioContext(1, length, TARGET_RATE);
  const src = offline.createBufferSource();
  src.buffer = decoded; // multi-channel source down-mixes into the mono context
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0).slice();
}

export interface WavConversion {
  chunks: Blob[];
  durationSec: number;
  /** True when we could not decode/convert and are handing back the raw blob. */
  raw: boolean;
}

/**
 * Convert a recorded blob into ≤maxSec WAV chunks (16 kHz mono).
 * On any failure, returns the original blob untouched so the server can still try.
 */
export async function toWavChunks(blob: Blob, maxSec = 28): Promise<WavConversion> {
  try {
    const samples = await decodeToMono16k(blob);
    const durationSec = Math.round(samples.length / TARGET_RATE);
    const chunkLen = maxSec * TARGET_RATE;
    if (samples.length <= chunkLen) {
      return { chunks: [encodeWav(samples, TARGET_RATE)], durationSec, raw: false };
    }
    const chunks: Blob[] = [];
    for (let start = 0; start < samples.length; start += chunkLen) {
      const slice = samples.subarray(start, Math.min(start + chunkLen, samples.length));
      chunks.push(encodeWav(slice, TARGET_RATE));
    }
    return { chunks, durationSec, raw: false };
  } catch {
    return { chunks: [blob], durationSec: 0, raw: true };
  }
}
