"use client";

import { useEffect, useState } from "react";

type Device = "apple" | "google" | "unknown";

function detect(ua: string): Device {
  if (/iPhone|iPad|iPod|Macintosh/i.test(ua)) return "apple";
  if (/Android/i.test(ua)) return "google";
  return "unknown";
}

/**
 * Shows "Add to Apple Wallet" on iOS, "Add to Google Wallet" on Android, and both elsewhere.
 * Wallet pass endpoints arrive in Milestone 3; until then the buttons are shown disabled.
 */
export function WalletButtons({ ready = false }: { ready?: boolean }) {
  const [device, setDevice] = useState<Device>("unknown");
  useEffect(() => setDevice(detect(navigator.userAgent)), []);

  const apple = (
    <a key="apple" href={ready ? "/api/wallet/apple" : undefined} aria-disabled={!ready} className="btn btn-cta btn-block">
      <WalletIcon /> Add to Apple Wallet
    </a>
  );
  const google = (
    <a key="google" href={ready ? "/api/wallet/google" : undefined} aria-disabled={!ready} className="btn btn-cta btn-block">
      <WalletIcon /> Add to Google Wallet
    </a>
  );

  const buttons = device === "apple" ? [apple] : device === "google" ? [google] : [apple, google];
  return (
    <div className="stack-sm">
      {buttons}
      {!ready && <p className="small muted" style={{ textAlign: "center" }}>Wallet passes are coming soon. Your web card works today.</p>}
    </div>
  );
}

function WalletIcon() {
  // Carbon "wallet" (line style)
  return (
    <svg width="20" height="20" viewBox="0 0 32 32" aria-hidden fill="currentColor">
      <path d="M22 17h2v2h-2z" />
      <path d="M28 8H4V5h22V3H4a2 2 0 0 0-2 2v21a2 2 0 0 0 2 2h24a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2Zm-24 18V10h24v3h-8a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h8v3Zm24-11v6h-8v-6Z" />
    </svg>
  );
}
