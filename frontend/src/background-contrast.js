// Sample a tiny frame once a second; never read YouTube's cross-origin pixels.
export function contrastTone(pixels, previous = 'light') {
  let sum = 0,
    weight = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3] / 255;
    const linear = (value) => {
      const c = value / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    sum +=
      alpha *
      (0.2126 * linear(pixels[i]) +
        0.7152 * linear(pixels[i + 1]) +
        0.0722 * linear(pixels[i + 2]));
    weight += alpha;
  }
  if (!weight) return previous;
  const luminance = sum / weight;
  // Hysteresis prevents flashing text on small brightness changes.
  return luminance < 0.22 ? 'dark' : luminance > 0.38 ? 'light' : previous;
}
export function trackBackgroundContrast(media, host, visible) {
  const target = host.closest('#page') || host;
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 9;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let stopped = false;
  const sample = () => {
    if (stopped || !visible() || !ctx) return;
    const w = media.videoWidth || media.naturalWidth,
      h = media.videoHeight || media.naturalHeight;
    if (!w || !h) return;
    try {
      // Match object-fit: cover, so off-screen letterboxing does not affect contrast.
      const box = host.getBoundingClientRect(),
        aspect = box.width / Math.max(1, box.height);
      const sw = Math.min(w, h * aspect),
        sh = Math.min(h, w / aspect);
      ctx.clearRect(0, 0, 16, 9);
      ctx.drawImage(media, (w - sw) / 2, (h - sh) / 2, sw, sh, 0, 0, 16, 9);
      target.dataset.backgroundTone = contrastTone(
        ctx.getImageData(0, 0, 16, 9).data,
        target.dataset.backgroundTone,
      );
    } catch {
      /* Keep the readable theme overlay if pixel access is unavailable. */
    }
  };
  media.addEventListener('load', sample);
  media.addEventListener('loadeddata', sample);
  const timer = setInterval(sample, 1000);
  sample();
  return () => {
    stopped = true;
    clearInterval(timer);
    media.removeEventListener('load', sample);
    media.removeEventListener('loadeddata', sample);
    delete target.dataset.backgroundTone;
  };
}
