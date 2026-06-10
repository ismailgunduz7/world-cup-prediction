import { toPng } from 'html-to-image';

/** BracketExportPoster sabit genişliği — mobil/masaüstü tutarlılığı için. */
export const POSTER_WIDTH = 3000;

function sanitizeFilenamePart(value: string): string {
  return value
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function buildFilename(displayName: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const user = sanitizeFilenamePart(displayName) || 'kullanici';
  return `bracket-tahmin-${user}-${date}.png`;
}

async function waitForRender(): Promise<void> {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function findPosterElement(wrapper: HTMLElement): HTMLElement {
  return wrapper.querySelector('.poster') ?? wrapper;
}

/**
 * Vue bileşen ağacını bozmadan yakalamak için canlı DOM yerine klon kullanır.
 * Klon geçici sandbox'ta sabit genişlikte render edilir.
 */
async function capturePosterClone(poster: HTMLElement): Promise<string> {
  const clone = poster.cloneNode(true) as HTMLElement;

  const sandbox = document.createElement('div');
  sandbox.setAttribute('aria-hidden', 'true');
  sandbox.style.cssText = [
    'position: fixed',
    'left: 0',
    'top: 0',
    `width: ${POSTER_WIDTH}px`,
    'overflow: visible',
    'opacity: 0',
    'pointer-events: none',
    'z-index: -1',
  ].join(';');

  document.body.appendChild(sandbox);
  sandbox.appendChild(clone);

  try {
    await waitForRender();
    return await toPng(clone, {
      cacheBust: true,
      pixelRatio: 2,
      width: POSTER_WIDTH,
      backgroundColor: '#042f2e',
    });
  } finally {
    sandbox.remove();
  }
}

export async function captureBracketImage(wrapper: HTMLElement): Promise<string> {
  const poster = findPosterElement(wrapper);
  return capturePosterClone(poster);
}

/** Pop-up engelleyicisini aşmak için tıklama anında çağrılmalı. */
export function openBracketPreviewWindow(): Window | null {
  return window.open('about:blank', '_blank');
}

export function showBracketPreviewLoading(previewWindow: Window): void {
  previewWindow.document.open();
  previewWindow.document.write(`<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Bracket önizleme</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #0f172a;
      color: #94a3b8;
      font-family: system-ui, sans-serif;
      font-size: 15px;
    }
  </style>
</head>
<body><p>Görsel hazırlanıyor…</p></body>
</html>`);
  previewWindow.document.close();
}

export function showBracketPreviewImage(previewWindow: Window, dataUrl: string): void {
  previewWindow.document.open();
  previewWindow.document.write(`<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Bracket önizleme</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px;
      box-sizing: border-box;
      background: #0f172a;
    }
    img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
    }
    p {
      margin: 16px 0 0;
      color: #94a3b8;
      font-family: system-ui, sans-serif;
      font-size: 14px;
      text-align: center;
    }
  </style>
</head>
<body>
  <img src="${dataUrl}" alt="Bracket tahmini" />
  <p>İndirmek için görsele sağ tıklayıp “Resmi farklı kaydet” seçebilir veya Bracket sayfasındaki “Görseli indir” butonunu kullanabilirsiniz.</p>
</body>
</html>`);
  previewWindow.document.close();
}

export async function downloadBracketImage(wrapper: HTMLElement, displayName: string): Promise<void> {
  const dataUrl = await captureBracketImage(wrapper);
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = buildFilename(displayName);
  link.click();
}

export async function previewBracketImage(
  wrapper: HTMLElement,
  previewWindow: Window,
): Promise<void> {
  showBracketPreviewLoading(previewWindow);
  const dataUrl = await captureBracketImage(wrapper);
  showBracketPreviewImage(previewWindow, dataUrl);
}
