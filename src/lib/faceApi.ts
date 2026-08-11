import * as faceapi from 'face-api.js';

const MODEL_URL = '/models';

let backendInit: Promise<void> | null = null;

// Prefer the WebGL backend (fast) but fall back to CPU when WebGL is
// unavailable (remote desktops, VMs, disabled hardware acceleration). Without
// this, detection silently fails even with a clear video feed.
async function ensureTfBackend(): Promise<void> {
  if (!backendInit) {
    backendInit = (async () => {
      const tf = faceapi.tf;
      try {
        await tf.ready();
        if (tf.getBackend() !== 'webgl') return;

        // Smoke-test that a WebGL context can actually be created. tfjs
        // registers the backend even when the browser cannot create a context,
        // so a tiny real tensor op is the only reliable check.
        const a = tf.tensor([1, 2, 3]);
        a.add(a).dataSync();
        a.dispose();
      } catch (error) {
        console.warn('WebGL unavailable, falling back to CPU backend:', error);
        try {
          await faceapi.tf.setBackend('cpu');
        } catch (err) {
          console.warn('CPU backend could not be enabled:', err);
        }
      }
    })();
  }
  return backendInit;
}

export async function loadFaceModels(): Promise<void> {
  await ensureTfBackend();
  await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
  await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
  await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
}

function isVideoReady(
  video: HTMLVideoElement | null | undefined
): video is HTMLVideoElement {
  return (
    !!video &&
    video.readyState >= 2 &&
    video.videoWidth > 0 &&
    video.videoHeight > 0 &&
    !video.paused
  );
}

// Runs a single detection pass and returns the 128-dim descriptor, or null if
// no face is present (or the stream is not yet decodable).
export async function detectFaceDescriptor(
  video: HTMLVideoElement | null | undefined,
  waitMs = 1500
): Promise<number[] | null> {
  if (!video) return null;

  const deadline = Date.now() + waitMs;
  while (!isVideoReady(video) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!isVideoReady(video)) return null;

  try {
    const detection = await faceapi
      .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
      .withFaceLandmarks()
      .withFaceDescriptor();
    return detection ? Array.from(detection.descriptor) : null;
  } catch (error) {
    console.error('Face detection error:', error);
    return null;
  }
}

// Runs one throwaway detection once the camera is live so tfjs compiles its
// kernels up front and the first real scan is fast.
export async function warmUpDetection(
  video: HTMLVideoElement | null | undefined
): Promise<void> {
  try {
    await detectFaceDescriptor(video);
  } catch {
    // best-effort only
  }
}
