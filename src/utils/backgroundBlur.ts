import { SelfieSegmentation, Results } from "@mediapipe/selfie_segmentation";

let selfieSegmentationInstance: SelfieSegmentation | null = null;
let isInitializing = false;
let isReady = false;

// Offscreen canvases for processing
let maskCanvas: HTMLCanvasElement | null = null;
let maskCtx: CanvasRenderingContext2D | null = null;

let processedCanvas: HTMLCanvasElement | null = null;
let processedCtx: CanvasRenderingContext2D | null = null;

let isProcessing = false;
let lastProcessedTime = 0;

/**
 * Initialize MediaPipe Selfie Segmentation model
 */
export function initSelfieSegmentation(): Promise<boolean> {
  if (isReady && selfieSegmentationInstance) return Promise.resolve(true);
  if (isInitializing) {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (isReady) {
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 100);
    });
  }

  isInitializing = true;

  return new Promise((resolve) => {
    try {
      const instance = new SelfieSegmentation({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
      });

      instance.setOptions({
        modelSelection: 1, // 1 for landscape/desktop camera view
        selfieMode: false,
      });

      instance.onResults(onSelfieSegmentationResults);

      selfieSegmentationInstance = instance;

      // Initialize offscreen canvases
      if (!maskCanvas) {
        maskCanvas = document.createElement("canvas");
        maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
      }
      if (!processedCanvas) {
        processedCanvas = document.createElement("canvas");
        processedCtx = processedCanvas.getContext("2d", {
          willReadFrequently: true,
        });
      }

      // Send a dummy frame to warm up the model
      const dummyCanvas = document.createElement("canvas");
      dummyCanvas.width = 160;
      dummyCanvas.height = 120;

      instance
        .send({ image: dummyCanvas })
        .then(() => {
          isReady = true;
          isInitializing = false;
          resolve(true);
        })
        .catch((err) => {
          console.warn("SelfieSegmentation warm up failed, falling back:", err);
          isReady = false;
          isInitializing = false;
          resolve(false);
        });
    } catch (err) {
      console.error("Failed to initialize SelfieSegmentation:", err);
      isInitializing = false;
      isReady = false;
      resolve(false);
    }
  });
}

let currentBlurAmount = 12;

function onSelfieSegmentationResults(results: Results) {
  isProcessing = false;
  if (!results || !results.image || !results.segmentationMask) return;

  const img = results.image as unknown as {
    width?: number;
    videoWidth?: number;
    height?: number;
    videoHeight?: number;
  };
  const width = img.width || img.videoWidth || 640;
  const height = img.height || img.videoHeight || 480;

  if (width === 0 || height === 0) return;

  // Prepare canvases
  if (!processedCanvas) {
    processedCanvas = document.createElement("canvas");
    processedCtx = processedCanvas.getContext("2d");
  }
  if (!maskCanvas) {
    maskCanvas = document.createElement("canvas");
    maskCtx = maskCanvas.getContext("2d");
  }

  if (processedCanvas.width !== width || processedCanvas.height !== height) {
    processedCanvas.width = width;
    processedCanvas.height = height;
  }
  if (maskCanvas.width !== width || maskCanvas.height !== height) {
    maskCanvas.width = width;
    maskCanvas.height = height;
  }

  if (!processedCtx || !maskCtx) return;

  // 1. Draw blurred background on processedCanvas
  processedCtx.save();
  processedCtx.clearRect(0, 0, width, height);
  processedCtx.filter = `blur(${currentBlurAmount}px)`;
  processedCtx.drawImage(results.image, 0, 0, width, height);
  processedCtx.filter = "none";

  // 2. Prepare cut-out sharp person in maskCanvas
  maskCtx.save();
  maskCtx.clearRect(0, 0, width, height);
  // Draw the segmentation mask (white where person is, black where background is)
  maskCtx.drawImage(results.segmentationMask, 0, 0, width, height);

  // Keep video pixels ONLY where segmentation mask is opaque
  maskCtx.globalCompositeOperation = "source-in";
  maskCtx.drawImage(results.image, 0, 0, width, height);
  maskCtx.restore();

  // 3. Composite sharp person over blurred background
  processedCtx.drawImage(maskCanvas, 0, 0, width, height);
  processedCtx.restore();

  lastProcessedTime = Date.now();
}

/**
 * Process a video frame for background blur.
 * Returns a Canvas or Video element ready for rendering.
 */
export function processVideoBackgroundBlur(
  video: HTMLVideoElement,
  blurAmount: number = 12,
): HTMLCanvasElement | HTMLVideoElement {
  if (!video || video.readyState < 2) {
    return video;
  }

  currentBlurAmount = blurAmount;

  // Trigger init if not ready
  if (!isReady && !isInitializing) {
    initSelfieSegmentation();
  }

  // If segmentation model is ready and not busy, send frame for processing
  if (isReady && selfieSegmentationInstance && !isProcessing) {
    // Limit processing rate to ~30fps to avoid overloading CPU
    const now = Date.now();
    if (now - lastProcessedTime > 30) {
      isProcessing = true;
      try {
        selfieSegmentationInstance.send({ image: video }).catch(() => {
          isProcessing = false;
        });
      } catch {
        isProcessing = false;
      }
    }
  }

  // If we have a freshly processed canvas, return it!
  if (
    processedCanvas &&
    processedCanvas.width > 0 &&
    Date.now() - lastProcessedTime < 1000
  ) {
    return processedCanvas;
  }

  // Fallback to raw video if segmentation is loading or unavailable
  return video;
}

/**
 * Check if the background blur processor is ready
 */
export function isBackgroundBlurReady(): boolean {
  return isReady;
}
