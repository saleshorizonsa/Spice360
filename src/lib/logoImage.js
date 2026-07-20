/**
 * Turn an uploaded logo file into an embedded data URL, downscaled so the stored
 * string stays small.
 *
 * Why a data URL instead of a hosted URL: the logo previously uploaded to a Supabase
 * "logos" bucket and was referenced by its public URL. That URL fails to render if
 * the bucket is not public, and — because print windows call window.print() the
 * moment they load — the remote image often had not downloaded yet, so it printed
 * blank. An embedded data URL is part of the document: it shows in the dashboard,
 * the settings preview, and every print/PDF with no bucket, CORS, or timing
 * dependency.
 */

const MAX_SOURCE_BYTES = 6 * 1024 * 1024; // reject absurdly large uploads outright

export const isImageFile = (file) => typeof file?.type === 'string' && file.type.startsWith('image/');

// SVG is already compact and vector — keep it as-is rather than rasterising on a
// canvas (which loses the vector and can taint depending on the source).
export const isVectorImage = (file) => file?.type === 'image/svg+xml';

// PNG (and unknown) keep an alpha channel for transparent logos; photos re-encode
// as JPEG to stay small.
export const outputMimeForFile = (file) => (file?.type === 'image/jpeg' ? 'image/jpeg' : 'image/png');

/** Target dimensions preserving aspect ratio, capped at maxDim. */
export const scaledDimensions = (width, height, maxDim) => {
  if (!width || !height) return { width: maxDim, height: maxDim };
  if (width <= maxDim && height <= maxDim) return { width, height };
  const scale = Math.min(maxDim / width, maxDim / height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
};

const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Could not read the image file.'));
  reader.onload = () => resolve(reader.result);
  reader.readAsDataURL(file);
});

/**
 * @returns {Promise<string>} a data: URL for the logo.
 */
export async function fileToLogoDataUrl(file, { maxDim = 400, quality = 0.92 } = {}) {
  if (!isImageFile(file)) throw new Error('Please choose an image file (PNG, JPG or SVG).');
  if (file.size > MAX_SOURCE_BYTES) throw new Error('Image is too large — please use one under 6 MB.');

  const raw = await readAsDataUrl(file);

  // SVG: use as-is (already small and resolution-independent).
  if (isVectorImage(file)) return raw;

  // Raster: downscale on a canvas so the embedded string stays small.
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('Could not decode the image.'));
    img.onload = () => {
      try {
        const { width, height } = scaledDimensions(img.naturalWidth, img.naturalHeight, maxDim);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL(outputMimeForFile(file), quality));
      } catch (err) {
        // Canvas can fail (e.g. tainted); fall back to the untouched data URL.
        resolve(raw);
      }
    };
    img.src = raw;
  });
}
