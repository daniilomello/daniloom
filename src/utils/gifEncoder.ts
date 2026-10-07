// Canvas-based Animated GIF Encoder (GIF89a with LZW compression)
// Allows exporting clips or canvas streams directly as animated GIF files.

export interface GifOptions {
  width?: number;
  height?: number;
  fps?: number; // e.g. 10 fps
  maxDuration?: number; // max seconds to encode to keep GIF size reasonable (e.g. 15s)
  quality?: number; // 1 (best) to 10
  onProgress?: (progress: number) => void;
}

// Simple Color Quantization & GIF Stream Encoder
export class SimpleGifEncoder {
  private width: number;
  private height: number;
  private delay: number; // in hundredths of a second
  private stream: number[] = [];

  constructor(width: number, height: number, delayHundredths: number) {
    this.width = width;
    this.height = height;
    this.delay = delayHundredths;
    this.writeHeader();
  }

  private writeHeader() {
    // Header "GIF89a"
    const header = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
    this.stream.push(...header);

    // Logical Screen Descriptor
    this.stream.push(this.width & 0xff, (this.width >> 8) & 0xff);
    this.stream.push(this.height & 0xff, (this.height >> 8) & 0xff);
    this.stream.push(0x70, 0, 0); // No global color table, 8-bit color depth

    // Netscape Application Extension (for looping)
    this.stream.push(
      0x21,
      0xff,
      0x0b,
      0x4e,
      0x45,
      0x54,
      0x53,
      0x43,
      0x41,
      0x50,
      0x45,
      0x32,
      0x2e,
      0x30, // NETSCAPE2.0
      0x03,
      0x01,
      0x00,
      0x00,
      0x00, // Loop infinitely
    );
  }

  public addFrame(imageData: ImageData) {
    const { width, height, data } = imageData;
    const pixels = width * height;

    // Build 256-color palette via uniform quantization
    const palette: number[] = [];
    const colorMap = new Map<number, number>();
    const indexStream: number[] = new Array(pixels);

    for (let i = 0; i < pixels; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];

      // Quantize 8-bit to 3-3-2 bits (256 colors)
      const qr = (r >> 5) & 0x07;
      const qg = (g >> 5) & 0x07;
      const qb = (b >> 6) & 0x03;
      const colorIndex = (qr << 5) | (qg << 2) | qb;

      indexStream[i] = colorIndex;
    }

    // Generate 256 color table (RGB)
    for (let i = 0; i < 256; i++) {
      const r = ((i >> 5) & 0x07) * 36;
      const g = ((i >> 2) & 0x07) * 36;
      const b = (i & 0x03) * 85;
      palette.push(r, g, b);
    }

    // Graphic Control Extension
    this.stream.push(
      0x21,
      0xf9,
      0x04,
      0x04,
      this.delay & 0xff,
      (this.delay >> 8) & 0xff,
      0,
      0,
    );

    // Image Descriptor
    this.stream.push(
      0x2c,
      0,
      0,
      0,
      0, // left, top
      width & 0xff,
      (width >> 8) & 0xff,
      height & 0xff,
      (height >> 8) & 0xff,
      0x87, // Local color table present, size = 256 (2^(7+1))
    );

    // Local Color Table (256 * 3 bytes)
    this.stream.push(...palette);

    // LZW Compression
    const minCodeSize = 8;
    this.stream.push(minCodeSize);
    this.writeLZW(indexStream, minCodeSize);
    this.stream.push(0); // Block terminator
  }

  private writeLZW(indices: number[], minCodeSize: number) {
    const clearCode = 1 << minCodeSize;
    const eofCode = clearCode + 1;

    let codeSize = minCodeSize + 1;
    let nextCode = eofCode + 1;

    let dictionary = new Map<string, number>();

    const resetDictionary = () => {
      dictionary.clear();
      for (let i = 0; i < clearCode; i++) {
        dictionary.set(String(i), i);
      }
      codeSize = minCodeSize + 1;
      nextCode = eofCode + 1;
    };

    resetDictionary();

    let byteBuffer = 0;
    let bitCount = 0;
    const outputBytes: number[] = [];

    const writeCode = (code: number) => {
      byteBuffer |= code << bitCount;
      bitCount += codeSize;
      while (bitCount >= 8) {
        outputBytes.push(byteBuffer & 0xff);
        byteBuffer >>= 8;
        bitCount -= 8;
      }
    };

    writeCode(clearCode);

    let prefix = String(indices[0]);

    for (let i = 1; i < indices.length; i++) {
      const k = indices[i];
      const prefixK = prefix + "," + k;

      if (dictionary.has(prefixK)) {
        prefix = prefixK;
      } else {
        writeCode(dictionary.get(prefix)!);

        if (nextCode < 4096) {
          dictionary.set(prefixK, nextCode++);
          if (nextCode === 1 << codeSize && codeSize < 12) {
            codeSize++;
          }
        } else {
          writeCode(clearCode);
          resetDictionary();
        }
        prefix = String(k);
      }
    }

    writeCode(dictionary.get(prefix)!);
    writeCode(eofCode);

    if (bitCount > 0) {
      outputBytes.push(byteBuffer & 0xff);
    }

    // Packetize into 255-byte blocks
    let offset = 0;
    while (offset < outputBytes.length) {
      const blockSize = Math.min(255, outputBytes.length - offset);
      this.stream.push(blockSize);
      for (let i = 0; i < blockSize; i++) {
        this.stream.push(outputBytes[offset + i]);
      }
      offset += blockSize;
    }
  }

  public finish(): Blob {
    this.stream.push(0x3b); // GIF Trailer
    const uint8Array = new Uint8Array(this.stream);
    return new Blob([uint8Array], { type: "image/gif" });
  }
}

/**
 * Converts a video blob or URL into an animated GIF Blob.
 */
export async function convertVideoToGif(
  videoUrl: string,
  options: GifOptions = {},
): Promise<Blob> {
  const fps = options.fps || 10;
  const targetWidth = options.width || 480;
  const maxDuration = options.maxDuration || 15; // Limit to 15s max for performance

  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.src = videoUrl;
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = async () => {
      try {
        const duration = Math.min(video.duration || 5, maxDuration);
        const aspect = (video.videoHeight || 9) / (video.videoWidth || 16);
        const targetHeight = options.height || Math.round(targetWidth * aspect);

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        if (!ctx) {
          reject(new Error("Could not create canvas 2D context"));
          return;
        }

        const delayHundredths = Math.round(100 / fps);
        const encoder = new SimpleGifEncoder(
          targetWidth,
          targetHeight,
          delayHundredths,
        );

        const totalFrames = Math.floor(duration * fps);
        const frameInterval = 1 / fps;

        for (let frame = 0; frame < totalFrames; frame++) {
          const currentTime = frame * frameInterval;
          video.currentTime = currentTime;

          await new Promise<void>((res) => {
            const onSeek = () => {
              video.removeEventListener("seeked", onSeek);
              res();
            };
            video.addEventListener("seeked", onSeek);
          });

          ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
          const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
          encoder.addFrame(imageData);

          if (options.onProgress) {
            options.onProgress(Math.round(((frame + 1) / totalFrames) * 100));
          }
        }

        const gifBlob = encoder.finish();
        resolve(gifBlob);
      } catch (err) {
        reject(err);
      }
    };

    video.onerror = () =>
      reject(new Error("Failed to load video for GIF conversion"));
  });
}
