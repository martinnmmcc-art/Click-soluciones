import { supabase } from "@/lib/supabaseClient";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function pushSoportado() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

// Pide permiso (si hace falta) y suscribe al navegador. No hace nada si el usuario ya rechazó el permiso antes.
export async function suscribirPush(telefono) {
  if (!pushSoportado()) return { ok: false, motivo: "no-soportado" };

  if (Notification.permission === "denied") {
    return { ok: false, motivo: "denegado" };
  }

  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") {
    return { ok: false, motivo: "no-concedido" };
  }

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
  });

  await fetch("/api/push/suscribir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub, telefono: telefono || null })
  });

  return { ok: true };
}

export async function desuscribirPush() {
  if (!pushSoportado()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}

export async function estaSuscripto() {
  if (!pushSoportado()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch (e) {
    return false;
  }
}
