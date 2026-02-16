"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";

export function BarcodeScanner({
  onDetected
}: {
  onDetected: (barcode: string) => void;
}) {
  const [active, setActive] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const containerId = React.useId().replaceAll(":", "");

  React.useEffect(() => {
    let scanner: any | null = null;
    let cancelled = false;

    async function start() {
      try {
        if (!window.isSecureContext) {
          throw new Error("Sur iPhone, la camera exige HTTPS. Ouvre l'app en https:// ou via localhost sur le meme appareil.");
        }
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera non disponible dans ce navigateur.");
        }
        setError(null);
        const mod = await import("html5-qrcode");
        const { Html5QrcodeScanner, Html5QrcodeSupportedFormats } = mod as any;

        if (cancelled) return;
        scanner = new Html5QrcodeScanner(
          containerId,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            rememberLastUsedCamera: true,
            formatsToSupport: [
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.QR_CODE
            ]
          },
          false
        );
        scanner.render(
          (decodedText: string) => {
            toast.success(`Détecté: ${decodedText}`);
            onDetected(decodedText);
            try {
              scanner?.clear?.();
            } catch {
              // ignore
            }
            setActive(false);
          },
          (scanErr: any) => {
            // ignore noisy errors
            if (typeof scanErr === "string" && scanErr.includes("NotFoundException")) return;
          }
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Impossible de démarrer la caméra");
        setActive(false);
      }
    }

    if (active) start();
    return () => {
      cancelled = true;
      try {
        scanner?.clear?.();
      } catch {
        // ignore
      }
    };
  }, [active, containerId, onDetected]);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Scanner</div>
          <div className="text-sm text-gray-600 dark:text-slate-400">Ouvre la caméra et détecte automatiquement.</div>
        </div>
        <button
          type="button"
          className={[
            "min-h-[44px] rounded-xl border px-4 py-2 text-sm font-medium",
            active
              ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
              : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          ].join(" ")}
          onClick={() => setActive((v) => !v)}
        >
          {active ? "Stop" : "Démarrer"}
        </button>
      </div>

      {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
      {active ? <div className="mt-4" id={containerId} /> : null}
    </Card>
  );
}
