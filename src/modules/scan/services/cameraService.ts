/**
 * Camera service: manages getUserMedia stream lifecycle.
 * Requests rear camera on mobile, any camera on desktop.
 */

export interface CameraConfig {
  width?: number;
  height?: number;
  facingMode?: "user" | "environment";
}

const DEFAULT_CONFIG: CameraConfig = {
  width: 720,
  height: 960,
  facingMode: "environment",
};

export async function startCamera(
  videoEl: HTMLVideoElement,
  config: CameraConfig = {}
): Promise<MediaStream> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const constraints: MediaStreamConstraints = {
    video: {
      width: { ideal: cfg.width },
      height: { ideal: cfg.height },
      facingMode: { ideal: cfg.facingMode },
    },
    audio: false,
  };

  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  videoEl.srcObject = stream;
  await videoEl.play();
  return stream;
}

export function stopCamera(stream: MediaStream | null) {
  if (!stream) return;
  stream.getTracks().forEach((t) => t.stop());
}
