/**
 * OneSignal client helper
 *
 * OneSignal is initialised once via the script tag in layout.tsx.
 * This module provides typed helpers for subscription management.
 */

export async function getOneSignal(): Promise<typeof window.OneSignal | null> {
  if (typeof window === 'undefined') return null;
  // Wait for OneSignalDeferred to resolve (SDK loads async)
  if (window.OneSignal) return window.OneSignal;
  return new Promise((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(() => resolve(window.OneSignal ?? null));
    // Timeout after 5s
    setTimeout(() => resolve(null), 5000);
  });
}

export async function getOneSignalUserId(): Promise<string | null> {
  const os = await getOneSignal();
  if (!os) return null;
  try {
    return await os.User.PushSubscription.id ?? null;
  } catch {
    return null;
  }
}

// Extend window type
declare global {
  interface Window {
    OneSignal: any;
    OneSignalDeferred: any[];
  }
}
