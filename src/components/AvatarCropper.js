"use client";

/*
 * AvatarCropper
 *
 * A modal that lets the user drag + zoom a photo to fit a circular crop,
 * then returns a cropped Blob ready for Supabase upload.
 *
 * Props:
 *   imageSrc  (string)   — object URL of the selected file
 *   onConfirm (blob)     — called with the cropped Blob (JPEG)
 *   onCancel  ()         — called when the user dismisses without cropping
 */

import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";

// Converts crop area + source image URL into a JPEG Blob via canvas
async function cropImageToBlob(imageSrc, pixelCrop) {
  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", reject);
    image.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  const size = Math.min(pixelCrop.width, pixelCrop.height, 800); // max 800×800
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.drawImage(
    img,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    size,
    size
  );

  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.92);
  });
}

export default function AvatarCropper({ imageSrc, onConfirm, onCancel }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [processing, setProcessing] = useState(false);

  const onCropComplete = useCallback((_, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function handleConfirm() {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    try {
      const blob = await cropImageToBlob(imageSrc, croppedAreaPixels);
      onConfirm(blob);
    } finally {
      setProcessing(false);
    }
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="rounded-2xl border flex flex-col overflow-hidden"
        style={{
          borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
          background: "var(--midnight)",
          width: "min(92vw, 480px)",
          maxHeight: "92vh",
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center justify-between border-b"
          style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
        >
          <div>
            <div className="font-semibold text-white">Crop photo</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
              Drag to reposition · Pinch or scroll to zoom
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-white/40 hover:text-white/80 text-xl leading-none transition"
          >
            ✕
          </button>
        </div>

        {/* Cropper area */}
        <div className="relative bg-black" style={{ height: 340 }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            style={{
              containerStyle: { background: "#000" },
              cropAreaStyle: {
                border: "2px solid var(--gold)",
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
              },
            }}
          />
        </div>

        {/* Zoom slider */}
        <div
          className="px-5 py-4 border-t"
          style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: "var(--muted)" }}>Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-yellow-400 cursor-pointer"
            />
          </div>
        </div>

        {/* Actions */}
        <div
          className="px-5 py-4 flex items-center justify-end gap-3 border-t"
          style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
        >
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2 rounded-full border text-sm transition hover:border-white/40"
            style={{
              borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
              color: "rgba(255,255,255,0.6)",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={processing}
            className="px-6 py-2 rounded-full font-semibold text-sm transition hover:brightness-110"
            style={{
              background: "var(--gold)",
              color: "#0b0f1a",
              opacity: processing ? 0.7 : 1,
            }}
          >
            {processing ? "Cropping…" : "Use photo"}
          </button>
        </div>
      </div>
    </div>
  );
}
