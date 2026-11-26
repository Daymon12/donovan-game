// Checks GitHub for a newer version and reloads the game if there is one.
// Returns a short message to show on screen.
import { VERSION } from './version.js';

export async function checkForUpdate() {
  let online;
  try {
    const res = await fetch(`src/version.js?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status);
    const text = await res.text();
    online = (text.match(/VERSION\s*=\s*'([^']+)'/) || [])[1];
  } catch {
    return { message: 'Offline - try again later', reloading: false };
  }

  if (!online || online === VERSION) {
    return { message: `Up to date  v${VERSION}`, reloading: false };
  }

  // Newer version found: refresh the offline helper too, then reload.
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update();
  } catch { /* still reload below */ }

  setTimeout(() => location.reload(), 600);
  return { message: `Updating to v${online}...`, reloading: true };
}
