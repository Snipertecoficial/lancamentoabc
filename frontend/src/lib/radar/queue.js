export function createQueue({ send, flushMs = 5000, maxBatch = 20, setTimer = setTimeout }) {
  let items = [];
  let timer = null;
  const flush = (useBeacon) => {
    if (timer !== null) { clearTimeout(timer); timer = null; }
    if (!items.length) return;
    const batch = items;
    items = [];
    try { send(batch, !!useBeacon); } catch (e) { /* never throw */ }
  };
  return {
    push(event) {
      items.push(event);
      if (items.length >= maxBatch) flush();
      else if (timer === null) timer = setTimer(() => { timer = null; flush(); }, flushMs);
    },
    flush,
    size: () => items.length,
  };
}
