"use client";

import * as React from "react";
import { Camera, RefreshCcw, Upload, Zap } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { loadPreferences } from "@/lib/preferences";

type Html5QrcodeModule = typeof import("html5-qrcode");

type CameraDevice = {
  id: string;
  label: string;
};

type ScanEngine = "native" | "html5";

const BARCODE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"];

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
  const [engine, setEngine] = React.useState<ScanEngine>("html5");

  const containerId = React.useId().replaceAll(":", "");
  const fileContainerId = `${containerId}-file`;

  const scannerRef = React.useRef<any | null>(null);
  const html5ModuleRef = React.useRef<Html5QrcodeModule | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const detectorRef = React.useRef<any | null>(null);
  const nativeStreamRef = React.useRef<MediaStream | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const lastDetectedRef = React.useRef<string>("");
  const lastDetectedAtRef = React.useRef<number>(0);

  const getBackCamera = React.useCallback((list: CameraDevice[]) => {
    const back = list.find((cam) => /back|rear|arriere|environment/i.test(cam.label));
    return back ?? list[0] ?? null;
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

  const stopHtml5 = React.useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;

    try {
      const state = scanner.getState?.();
      if (state === 1 || state === 2) {
        await scanner.stop();
      }
    } catch {
      // ignore
    }

    try {
      await scanner.clear();
    } catch {
      // ignore
    }

    scannerRef.current = null;
  }, []);

  const stopScanner = React.useCallback(async () => {
    await Promise.all([stopNative(), stopHtml5()]);
  }, [stopHtml5, stopNative]);

  const loadModule = React.useCallback(async () => {
    if (html5ModuleRef.current) return html5ModuleRef.current;
    const mod = await import("html5-qrcode");
    html5ModuleRef.current = mod;
    return mod;
  }, []);

  const loadCameras = React.useCallback(async () => {
    try {
      const mod = await loadModule();
      const raw = await mod.Html5Qrcode.getCameras();
      const normalized = (raw ?? [])
        .filter((cam: any) => cam?.id)
        .map((cam: any) => ({
          id: String(cam.id),
          label: String(cam.label ?? "Camera")
        }));

      setCameras(normalized);
      if (!selectedCameraId) {
        const back = getBackCamera(normalized);
        if (back) setSelectedCameraId(back.id);
      }
    } catch {
      // iOS can hide labels until permission is granted.
    }
  }, [getBackCamera, loadModule, selectedCameraId]);

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

    detectorRef.current = new BarcodeDetectorClass({ formats: BARCODE_FORMATS });

    const tick = async () => {
      try {
        if (!video.videoWidth || !video.videoHeight) {
          rafRef.current = requestAnimationFrame(() => tick());
          return;
        }

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

  const startHtml5 = React.useCallback(async () => {
    const mod = await loadModule();
    const scanner = new mod.Html5Qrcode(containerId);
    scannerRef.current = scanner;

    const supportedFormats = [
      mod.Html5QrcodeSupportedFormats.EAN_13,
      mod.Html5QrcodeSupportedFormats.EAN_8,
      mod.Html5QrcodeSupportedFormats.UPC_A,
      mod.Html5QrcodeSupportedFormats.UPC_E,
      mod.Html5QrcodeSupportedFormats.CODE_128,
      mod.Html5QrcodeSupportedFormats.CODE_39,
      mod.Html5QrcodeSupportedFormats.QR_CODE
    ].filter(Boolean);

    const config: any = {
      fps: 12,
      qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
        const side = Math.min(viewfinderWidth * 0.9, viewfinderHeight * 0.6);
        return { width: Math.max(220, Math.floor(side)), height: Math.max(120, Math.floor(side * 0.55)) };
      },
      aspectRatio: 1.777,
      disableFlip: true,
      formatsToSupport: supportedFormats
    };

    await scanner.start(
      selectedCameraId
        ? { deviceId: { exact: selectedCameraId } }
        : ({ facingMode: "environment" } as const),
      config,
      (decodedText: string) => {
        notifyDetected(decodedText);
      },
      () => {
        // ignore not-found frames
      }
    );
  }, [containerId, loadModule, notifyDetected, selectedCameraId]);

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

      await startHtml5();
      setEngine("html5");
      await loadCameras();
    } catch (e) {
      await stopScanner();
      const message = e instanceof Error ? e.message : "Impossible de demarrer la camera. Essaie le mode photo.";
      setError(message);
      setActive(false);
    } finally {
      setBusy(false);
    }
  }, [loadCameras, startHtml5, startNative, stopNative, stopScanner]);

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
      if (active) {
        await startScanner();
      } else {
        await stopScanner();
      }
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
      const mod = await loadModule();
      const scanner = new mod.Html5Qrcode(fileContainerId, {
        formatsToSupport: [
          mod.Html5QrcodeSupportedFormats.EAN_13,
          mod.Html5QrcodeSupportedFormats.EAN_8,
          mod.Html5QrcodeSupportedFormats.UPC_A,
          mod.Html5QrcodeSupportedFormats.UPC_E,
          mod.Html5QrcodeSupportedFormats.CODE_128,
          mod.Html5QrcodeSupportedFormats.CODE_39,
          mod.Html5QrcodeSupportedFormats.QR_CODE
        ]
      } as any);

      const decoded = await scanner.scanFile(file, true);
      notifyDetected(decoded);

      try {
        await scanner.clear();
      } catch {
        // ignore
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
          <div className="text-sm text-gray-600 dark:text-slate-400">
            Mode hybride: scanner natif mobile + fallback automatique.
          </div>
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
        Moteur actif: {engine === "native" ? "natif" : "html5"}
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
        Astuce: eclairage fort, code bien plat, distance 12-18 cm.
      </div>

      {error ? <div className="state-error mt-3 rounded-xl px-3 py-2 text-sm">{error}</div> : null}

      <video
        ref={videoRef}
        className={["mt-4 w-full overflow-hidden rounded-2xl bg-black", active && engine === "native" ? "block" : "hidden"].join(" ")}
        muted
      />
      <div id={containerId} className={["mt-4", active && engine === "html5" ? "block" : "hidden"].join(" ")} />
      <div id={fileContainerId} className="hidden" />
    </Card>
  );
}
