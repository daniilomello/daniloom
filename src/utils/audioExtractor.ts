/**
 * Utility to extract pure audio from a video/audio Blob in the browser
 * and convert it to a lightweight 16kHz Mono WAV Blob.
 * This drastically reduces upload payload size (from hundreds of MBs to ~1-5MB)
 * preventing 413 Payload Too Large errors and speeding up transcription.
 */
export async function extractAudioFromBlob(videoBlob: Blob): Promise<Blob> {
  // If blob is already small (< 5MB) and is pure audio, return as-is
  if (videoBlob.type.startsWith("audio/") && videoBlob.size < 5 * 1024 * 1024) {
    return videoBlob;
  }

  try {
    const arrayBuffer = await videoBlob.arrayBuffer();
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) {
      return videoBlob;
    }

    const audioCtx = new AudioCtx({ sampleRate: 16000 });
    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    } catch (decodeErr) {
      console.warn(
        "AudioContext decodeAudioData failed, returning original video blob:",
        decodeErr,
      );
      await audioCtx.close();
      return videoBlob;
    }

    const length = audioBuffer.length;
    const sampleRate = 16000;
    const numOfChan = 1;
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);

    const writeString = (v: DataView, offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        v.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    /* RIFF identifier */
    writeString(view, 0, "RIFF");
    /* RIFF chunk length */
    view.setUint32(4, 36 + length * 2, true);
    /* RIFF type */
    writeString(view, 8, "WAVE");
    /* format chunk identifier */
    writeString(view, 12, "fmt ");
    /* format chunk length */
    view.setUint32(16, 16, true);
    /* sample format (raw PCM) */
    view.setUint16(20, 1, true);
    /* channel count (mono) */
    view.setUint16(22, numOfChan, true);
    /* sample rate */
    view.setUint32(24, sampleRate, true);
    /* byte rate */
    view.setUint32(28, sampleRate * 2, true);
    /* block align */
    view.setUint16(32, numOfChan * 2, true);
    /* bits per sample */
    view.setUint16(34, 16, true);
    /* data chunk identifier */
    writeString(view, 36, "data");
    /* data chunk length */
    view.setUint32(40, length * 2, true);

    const channels = [];
    for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
      channels.push(audioBuffer.getChannelData(c));
    }

    let offset = 44;
    for (let i = 0; i < length; i++) {
      let sample = 0;
      for (let c = 0; c < channels.length; c++) {
        sample += channels[c][i];
      }
      sample = sample / channels.length;
      sample = Math.max(-1, Math.min(1, sample));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, sample, true);
      offset += 2;
    }

    await audioCtx.close();
    return new Blob([buffer], { type: "audio/wav" });
  } catch (err) {
    console.warn(
      "Failed to extract audio from video blob, proceeding with original blob:",
      err,
    );
    return videoBlob;
  }
}
