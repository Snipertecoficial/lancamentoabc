const CT = "text/plain;charset=UTF-8";

export function sendBatch(url, body, useBeacon) {
  try {
    if (useBeacon && navigator.sendBeacon) {
      if (navigator.sendBeacon(url, new Blob([body], { type: CT }))) return true;
    }
  } catch (e) { /* fall through to fetch */ }
  try {
    const p = fetch(url, { method: "POST", body, keepalive: true, headers: { "Content-Type": CT } });
    if (p && p.catch) p.catch(() => {});
    return true;
  } catch (e) {
    return false;
  }
}
