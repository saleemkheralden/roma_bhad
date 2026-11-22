"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { strings } from "@/lib/strings";
import { buttonClass } from "./button-class";
import { deletePushSubscription, savePushSubscription } from "@/app/push-actions";

const n = strings.notifications;
type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Turn notifications on or off for this device (each phone separately). */
export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setState(ios && !standalone ? "ios-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function turnOn() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const result = await savePushSubscription(json);
      if (result?.error) {
        await sub.unsubscribe();
        setError(result.error);
        return;
      }
      setState("on");
    } catch {
      setError(n.failed);
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[var(--radius-control)] border border-rule bg-paper p-4">
      <p className="text-sm text-ink-2">{n.explain}</p>
      <div className="mt-3">
        {state === "on" ? (
          <button type="button" className={buttonClass("outline")} disabled={busy} onClick={turnOff}>
            <BellOff aria-hidden size={18} />
            {n.turnOff}
          </button>
        ) : state === "off" ? (
          <button type="button" className={buttonClass("primary")} disabled={busy} onClick={turnOn}>
            <Bell aria-hidden size={18} />
            {n.turnOn}
          </button>
        ) : (
          <p className="text-sm font-medium text-ink">
            {state === "loading"
              ? strings.common.loading
              : state === "ios-install"
                ? n.iosInstall
                : state === "denied"
                  ? n.denied
                  : n.unsupported}
          </p>
        )}
      </div>
      {state === "on" ? <p className="mt-2 text-sm font-bold text-present-ink">{n.onNote}</p> : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm font-medium text-absent-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
