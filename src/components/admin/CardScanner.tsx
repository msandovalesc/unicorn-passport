"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Scans an employee's card QR with the laptop or phone camera and opens their record, where the
 * reward is marked redeemed. Card QRs hold an opaque URL (/r/<token>), never personal data.
 * Uses the browser's BarcodeDetector where available, otherwise ZXing.
 */
export function CardScanner() {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let stop = () => {};
    let cancelled = false;

    const handle = (text: string) => {
      const m = text.match(/\/r\/([A-Za-z0-9_-]{16,64})(?:[?#].*)?$/);
      if (!m) {
        setError("That's not a Unicorn Passport card. Try the QR on the employee's card.");
        return false;
      }
      cancelled = true;
      stop();
      router.push(`/r/${m[1]}`);
      return true;
    };

    (async () => {
      try {
        if ("BarcodeDetector" in window) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
          if (cancelled) return stream.getTracks().forEach((t) => t.stop());
          stop = () => stream.getTracks().forEach((t) => t.stop());
          video.current!.srcObject = stream;
          await video.current!.play();
          // @ts-expect-error BarcodeDetector is not in the TS DOM lib yet
          const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
          const tick = async () => {
            if (cancelled || !video.current) return;
            try {
              const codes = await detector.detect(video.current);
              if (codes[0] && handle(codes[0].rawValue)) return;
            } catch {}
            setTimeout(tick, 250);
          };
          tick();
        } else {
          const { BrowserQRCodeReader } = await import("@zxing/browser");
          const reader = new BrowserQRCodeReader();
          const controls = await reader.decodeFromVideoDevice(undefined, video.current!, (result) => {
            if (result) handle(result.getText());
          });
          stop = () => controls.stop();
          if (cancelled) stop();
        }
      } catch {
        setError("Couldn't open the camera. Allow camera access, or scan the card with your phone's camera app instead.");
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [open, router]);

  if (!open) {
    return (
      <button type="button" className="btn btn-primary" onClick={() => { setError(null); setOpen(true); }}>
        Scan a card
      </button>
    );
  }

  return (
    <div className="scanner stack-sm">
      <video ref={video} className="scanner-video" muted playsInline />
      <p className="small muted">Point the camera at the QR on the employee&apos;s wallet or web card.</p>
      {error && <p className="alert">{error}</p>}
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </div>
  );
}
