/**
 * Open a print window for a full HTML document and print it only AFTER its images
 * have loaded.
 *
 * Print windows that call window.print() the instant they open fire before remote
 * images (a logo) have downloaded, so the logo prints blank. This waits for every
 * <img> to finish (or error), with a timeout fallback so it never hangs, then
 * prints. For a document with no images it prints immediately.
 *
 * The HTML you pass must NOT contain its own window.print() trigger — this adds it.
 */
export function openPrintWindow(html) {
  const win = window.open('', '_blank');
  if (!win) return null; // popup blocked

  win.document.open();
  win.document.write(html);
  win.document.close();

  const printWhenReady = () => {
    let imgs = [];
    try { imgs = Array.from(win.document.images || []); } catch { /* cross-doc access */ }

    const fire = () => { try { win.focus(); win.print(); } catch { /* window closed */ } };

    let remaining = imgs.length;
    if (remaining === 0) { fire(); return; }

    const one = () => { if (--remaining <= 0) fire(); };
    imgs.forEach((img) => {
      if (img.complete) one();
      else { img.onload = one; img.onerror = one; }
    });

    // Never wait forever on a slow/broken image.
    setTimeout(fire, 2500);
  };

  if (win.document.readyState === 'complete') printWhenReady();
  else win.addEventListener('load', printWhenReady);

  return win;
}
