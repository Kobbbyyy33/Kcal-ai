"use client";

import * as React from "react";
import { Camera, RefreshCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { loadPreferences } from "@/lib/preferences";

type Html5QrcodeModule = typeof import("html5-qrcode");

type CameraDevice = {
  id: string;
  label: string;
};

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

  const containerId = React.useId().replaceAll(":", "");
  const fileContainerId = `${containerId}-file`;

  const scannerRef = React.useRef<any | null>(null);
  const html5ModuleRef = React.useRef<Html5QrcodeModule | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const formats = React.useMemo(
    () => ["EAN_13", "EAN_8", "UPC_A", "UPC_E", "CODE_128", "CODE_39", "QR_CODE"] as const,
    []
  );

  const getBackCamera = React.useCallback((list: CameraDevice[]) => {
    const back = list.find((cam) => /back|rear|arriere|environment/i.test(cam.label));
    return back ?? list[0] ?? null;
  }, []);

  const stopScanner = React.useCallback(async () => {
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

  const startScanner = React.useCallback(async () => {
    setBusy(true);
    setError(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera non disponible sur cet appareil.");
      }

      if (!window.isSecureContext) {
        throw new Error("Camera live bloquee: utilise HTTPS ou le mode photo ci-dessous.");
      }

      const mod = await loadModule();
      const supportedFormats = formats
        .map((f) => (mod.Html5QrcodeSupportedFormats as any)[f])
        .filter(Boolean);

      const scanner = new mod.Html5Qrcode(containerId);
      scannerRef.current = scanner;

      const config = {
        fps: 12,
        qrbox: { width: 260, height: 160 },
        aspectRatio: 1.777,
        disableFlip: true,
        formatsToSupport: supportedFormats
      };

      const preferredCamera =
        selectedCameraId ?? (cameras.length > 0 ? getBackCamera(cameras)?.id : null) ?? ({ facingMode: "environment" } as const);

      await scanner.start(
        preferredCamera,
        config,
        async (decodedText: string) => {
          if (vibrateOnDetect && typeof navigator !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate(80);
          }
          if (scanSoundEnabled && typeof window !== "undefined") {
            const beep = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQQAAAAA");
            beep.play().catch(() => undefined);
          }
          toast.success(`Detecte: ${decodedText}`);
          onDetected(decodedText);
          await stopScanner();
          setActive(false);
        },
        () => {
          // ignore not-found frames
        }
      );

      await loadCameras();
    } catch (e) {
      await stopScanner();
      const message = e instanceof Error ? e.message : "Impossible de demarrer la camera. Essaie le mode photo.";
      setError(message);
      setActive(false);
    } finally {
      setBusy(false);
    }
  }, [cameras, containerId, formats, getBackCamera, loadCameras, loadModule, onDetected, scanSoundEnabled, selectedCameraId, stopScanner, vibrateOnDetect]);

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
      const supportedFormats = formats
        .map((f) => (mod.Html5QrcodeSupportedFormats as any)[f])
        .filter(Boolean);

      const scanner = new mod.Html5Qrcode(fileContainerId, {
        formatsToSupport: supportedFormats
      } as any);

      const decoded = await scanner.scanFile(file, true);
      toast.success(`Detecte: ${decoded}`);
      onDetected(decoded);

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
          <div className="text-sm text-gray-600 dark:text-slate-400">Camera arriere optimisee mobile + fallback scan photo.</div>
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

      {error ? <div className="state-error mt-3 rounded-xl px-3 py-2 text-sm">{error}</div> : null}
      <div id={containerId} className="mt-4" />
      <div id={fileContainerId} className="hidden" />
    </Card>
  );
}
