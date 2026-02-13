"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from "react";
import { startCamera, stopCamera } from "../services/cameraService";

export interface CameraLayerHandle {
  videoEl: HTMLVideoElement | null;
  stream: MediaStream | null;
}

interface Props {
  onReady?: (video: HTMLVideoElement) => void;
  mockMode?: boolean;
}

const CameraLayer = forwardRef<CameraLayerHandle, Props>(function CameraLayer(
  { onReady, mockMode },
  ref
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useImperativeHandle(ref, () => ({
    get videoEl() {
      return videoRef.current;
    },
    get stream() {
      return streamRef.current;
    },
  }));

  const initCamera = async () => {
    if (!videoRef.current || mockMode) {
      setStarting(false);
      return;
    }
    setError(null);
    setStarting(true);
    try {
      const stream = await startCamera(videoRef.current);
      streamRef.current = stream;
      onReady?.(videoRef.current);
    } catch (err: unknown) {
      const msg =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Camera permission denied. Please allow camera access."
          : "Could not access camera. Check permissions.";
      setError(msg);
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    initCamera();
    return () => {
      stopCamera(streamRef.current);
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mockMode]);

  if (mockMode) {
    return (
      <div className="relative w-full aspect-[3/4] bg-surface2 rounded-2xl overflow-hidden flex items-center justify-center border border-border">
        <div className="text-center px-6">
          <p className="text-xs text-muted mb-1 uppercase tracking-wider">Mock Mode</p>
          <p className="text-sm text-text2">
            Simulating pose detection without camera
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-[3/4] bg-black rounded-2xl overflow-hidden border border-border">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: "scaleX(-1)" }} // mirror for selfie
      />

      {starting && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-text/30 border-t-text rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-text2">Starting camera...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6">
          <div className="text-center">
            <svg className="w-10 h-10 mx-auto mb-3 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 01-2.25-2.25V7.5A2.25 2.25 0 014.5 5.25h7.5" />
              <line x1="3" y1="3" x2="21" y2="21" strokeWidth="1.5" />
            </svg>
            <p className="text-sm text-text2 mb-4">{error}</p>
            <button
              onClick={initCamera}
              className="px-4 py-2 text-xs bg-accent text-accent-fg rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* LIVE badge */}
      {!error && !starting && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[10px] font-medium text-white/90 uppercase tracking-wider">Live</span>
        </div>
      )}
    </div>
  );
});

export default CameraLayer;
