"use client";

import * as React from "react";
import { Camera, RefreshCcw, Upload, Zap } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { loadPreferences } from "@/lib/preferences";

type CameraDevice = {
  id: string;
  label: string;
};

type ScanEngine = "native" | "zxing";

type ZxingBundle = {
  BrowserMultiFormatReader: any;
  DecodeHintType: any;
  BarcodeFormat: any;
};

const BARCODE_DETECTOR_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"];

export function BarcodeScanner({
  onDetected
}: {
  onDetected: (barcode: string) => void;
}) {
  const [active, setActive] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [cameras, setCameras] = React.useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = React.useState<string | null>(null);
  const [scannerAutoStart, setScannerAutoStart] = React.useState(false);
  const [vibrateOnDetect, setVibrateOnDetect] = React.useState(true);
  const [scanSoundEnabled, setScanSoundEnabled] = React.useState(false);
  const [engine, setEngine] = React.useState<ScanEngine>("zxing");

  const containerId = React.useId().replaceAll(":", "");

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const nativeStreamRef = React.useRef<MediaStream | null>(null);
  const detectorRef = React.useRef<any | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const zxingReaderRef = React.useRef<any | null>(null);
  const zxingControlsRef = React.useRef<any | null>(null);
  const zxingBundleRef = React.useRef<ZxingBundle | null>(null);
  const lastDetectedRef = React.useRef<string>("");
  const lastDetectedAtRef = React.useRef<number>(0);

  const getBackCamera = React.useCallback((list: CameraDevice[]) => {
    const back = list.find((cam) => /back|rear|arriere|environment/i.test(cam.label));
    return back ?? list[0] ?? null;
  }, []);

  const loadZxing = React.useCallback(async () => {
    if (zxingBundleRef.current) return zxingBundleRef.current;
    const browser = await import("@zxing/browser");
    const core = await import("@zxing/library");
    zxingBundleRef.current = {
      BrowserMultiFormatReader: browser.BrowserMultiFormatReader,
      DecodeHintType: core.DecodeHintType,
      BarcodeFormat: core.BarcodeFormat
    };
    return zxingBundleRef.current;
  }, []);

  const notifyDetected = React.useCallback(
    (value: string) => {
      const now = Date.now();
      if (lastDetectedRef.current === value && now - lastDetectedAtRef.current < 1200) return;
      lastDetectedRef.current = value;
      lastDetectedAtRef.current = now;

      if (vibrateOnDetect && typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(80);
      }
      if (scanSoundEnabled && typeof window !== "undefined") {
        const beep = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQQAAAAA");
        beep.play().catch(() => undefined);
      }

      toast.success(`Detecte: ${value}`);
      onDetected(value);
      setActive(false);
    },
    [onDetected, scanSoundEnabled, vibrateOnDetect]
  );

  const stopNative = React.useCallback(async () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (nativeStreamRef.current) {
      nativeStreamRef.current.getTracks().forEach((track) => track.stop());
      nativeStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    detectorRef.current = null;
  }, []);

  const stopZxing = React.useCallback(async () => {
    try {
      zxingControlsRef.current?.stop?.();
    } catch {
      // ignore
    }
    zxingControlsRef.current = null;

    try {
      zxingReaderRef.current?.reset?.();
    } catch {
      // ignore
    }
    zxingReaderRef.current = null;
  }, []);

  const stopScanner = React.useCallback(async () => {
    await Promise.all([stopNative(), stopZxing()]);
  }, [stopNative, stopZxing]);

  const loadCameras = React.useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const normalized = devices
        .filter((d) => d.kind === "videoinput")
        .map((d, i) => ({ id: d.deviceId, label: d.label || `Camera ${i + 1}` }));
      setCameras(normalized);
      if (!selectedCameraId) {
        const back = getBackCamera(normalized);
        if (back) setSelectedCameraId(back.id);
      }
    } catch {
      // ignore
    }
  }, [getBackCamera, selectedCameraId]);

  const startNative = React.useCallback(async () => {
    const BarcodeDetectorClass = (window as any).BarcodeDetector;
    if (!BarcodeDetectorClass) throw new Error("native scanner unavailable");

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: selectedCameraId ? { exact: selectedCameraId } : undefined,
        facingMode: selectedCameraId ? undefined : { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    nativeStreamRef.current = stream;

    if (!videoRef.current) throw new Error("video element missing");
    const video = videoRef.current;
    video.srcObject = stream;
    video.setAttribute("playsinline", "true");
    await video.play();

    detectorRef.current = new BarcodeDetectorClass({ formats: BARCODE_DETECTOR_FORMATS });

    const tick = async () => {
      try {
        const barcodes = await detectorRef.current.detect(video);
        if (Array.isArray(barcodes) && barcodes.length > 0) {
          const raw = String(barcodes[0]?.rawValue ?? "").trim();
          if (raw) {
            notifyDetected(raw);
            return;
          }
        }
      } catch {
        // ignore frame errors
      }
      rafRef.current = requestAnimationFrame(() => tick());
    };

    rafRef.current = requestAnimationFrame(() => tick());
  }, [notifyDetected, selectedCameraId]);

  const startZxing = React.useCallback(async () => {
    const z = await loadZxing();

    const hints = new Map();
    hints.set(z.DecodeHintType.POSSIBLE_FORMATS, [
      z.BarcodeFormat.EAN_13,
      z.BarcodeFormat.EAN_8,
      z.BarcodeFormat.UPC_A,
      z.BarcodeFormat.UPC_E,
      z.BarcodeFormat.CODE_128,
      z.BarcodeFormat.CODE_39
    ]);
    hints.set(z.DecodeHintType.TRY_HARDER, true);

    const reader = new z.BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: 50,
      delayBetweenScanSuccess: 1200
    });
    zxingReaderRef.current = reader;

    if (!videoRef.current) throw new Error("video element missing");

    const controls = await reader.decodeFromVideoDevice(
      selectedCameraId || undefined,
      videoRef.current,
      (result: any) => {
        if (!result) return;
        const raw = String(result.getText?.() ?? "").trim();
        if (raw) notifyDetected(raw);
      }
    );

    zxingControlsRef.current = controls;
  }, [loadZxing, notifyDetected, selectedCameraId]);

  const startScanner = React.useCallback(async () => {
    setBusy(true);
    setError(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera non disponible sur cet appareil.");
      }
      if (!window.isSecureContext) {
        throw new Error("Camera live bloquee en HTTP. Passe en HTTPS ou utilise le scan photo.");
      }

      await stopScanner();

      const hasNative = typeof (window as any).BarcodeDetector !== "undefined";
      if (hasNative) {
        try {
          await startNative();
          setEngine("native");
          await loadCameras();
          return;
        } catch {
          await stopNative();
        }
      }

      await startZxing();
      setEngine("zxing");
      await loadCameras();
    } catch (e) {
      await stopScanner();
      const message = e instanceof Error ? e.message : "Impossible de demarrer la camera. Essaie le mode photo.";
      setError(message);
      setActive(false);
    } finally {
      setBusy(false);
    }
  }, [loadCameras, startNative, startZxing, stopNative, stopScanner]);

  React.useEffect(() => {
    const prefs = loadPreferences();
    setScannerAutoStart(prefs.scanner_auto_start);
    setVibrateOnDetect(prefs.scanner_vibrate_on_detect);
    setScanSoundEnabled(prefs.scan_sound_enabled);
  }, []);

  React.useEffect(() => {
    loadCameras().catch(() => undefined);
  }, [loadCameras]);

  React.useEffect(() => {
    if (!scannerAutoStart || !window.isSecureContext) return;
    setActive(true);
  }, [scannerAutoStart]);

  React.useEffect(() => {
    let unmounted = false;

    async function run() {
      if (unmounted) return;
      if (active) await startScanner();
      else await stopScanner();
    }

    run().catch(() => undefined);

    return () => {
      unmounted = true;
      stopScanner().catch(() => undefined);
    };
  }, [active, startScanner, stopScanner]);

  async function onPickImage(file: File) {
    setBusy(true);
    setError(null);

    try {
      const z = await loadZxing();
      const hints = new Map();
      hints.set(z.DecodeHintType.POSSIBLE_FORMATS, [
        z.BarcodeFormat.EAN_13,
        z.BarcodeFormat.EAN_8,
        z.BarcodeFormat.UPC_A,
        z.BarcodeFormat.UPC_E,
        z.BarcodeFormat.CODE_128,
        z.BarcodeFormat.CODE_39
      ]);
      hints.set(z.DecodeHintType.TRY_HARDER, true);

      const reader = new z.BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 10 });
      const imageUrl = URL.createObjectURL(file);
      try {
        const result = await reader.decodeFromImageUrl(imageUrl);
        const raw = String(result?.getText?.() ?? "").trim();
        if (!raw) throw new Error("Aucun code detecte");
        notifyDetected(raw);
      } finally {
        URL.revokeObjectURL(imageUrl);
        reader.reset();
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Aucun code-barres detecte sur la photo.";
      setError(message);
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Scanner</div>
          <div className="text-sm text-gray-600 dark:text-slate-400">Mode hybride: scanner natif mobile + fallback ZXing.</div>
        </div>
        <Button
          type="button"
          variant={active ? "danger" : "ghost"}
          className="min-h-[44px]"
          loading={busy}
          onClick={() => setActive((v) => !v)}
        >
          <Camera className="h-4 w-4" />
          {active ? "Stop" : "Demarrer"}
        </Button>
      </div>

      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Zap className="h-3.5 w-3.5 text-[#7da03c]" />
        Moteur actif: {engine === "native" ? "natif" : "zxing"}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {cameras.length > 1 ? (
          <select
            value={selectedCameraId ?? ""}
            onChange={(e) => setSelectedCameraId(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            {cameras.map((cam) => (
              <option key={cam.id} value={cam.id}>
                {cam.label || "Camera"}
              </option>
            ))}
          </select>
        ) : null}

        <Button type="button" variant="ghost" className="min-h-[40px]" onClick={() => loadCameras()}>
          <RefreshCcw className="h-4 w-4" />
          Rafraichir cameras
        </Button>

        <Button type="button" variant="ghost" className="min-h-[40px]" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-4 w-4" />
          Scanner depuis photo
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onPickImage(file);
          }}
        />
      </div>

      <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
        Astuce: eclairage fort, code bien plat, distance 12-18 cm, et remplis bien l'ecran avec le code.
      </div>

      {error ? <div className="state-error mt-3 rounded-xl px-3 py-2 text-sm">{error}</div> : null}

      <video
        ref={videoRef}
        id={containerId}
        className={["mt-4 w-full overflow-hidden rounded-2xl bg-black", active ? "block" : "hidden"].join(" ")}
        muted
        autoPlay
        playsInline
      />
    </Card>
  );
}
