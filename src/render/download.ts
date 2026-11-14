/**
 * 导出与下载
 *
 * 修复 ewm 的导出缺陷：
 *   - 原本用 "image/jpg" 这个非法 MIME，导致导出的 .jpg 实为 PNG 内容
 *   - 原本 SVG 导出丢失所有美化（改由 render/svg.ts 重建）
 */

export type ExportFormat = 'png' | 'jpeg' | 'webp' | 'svg';

/** 触发浏览器下载 */
function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 释放对象 URL
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 从画布导出位图。
 * @param canvas 源画布
 * @param format 目标格式
 * @param filename 文件名（不含扩展名）
 */
export function exportCanvas(
  canvas: HTMLCanvasElement,
  format: 'png' | 'jpeg' | 'webp',
  filename: string,
): void {
  // JPEG / WebP 不支持透明通道，先铺一层背景
  let source = canvas;
  if (format !== 'png') {
    const flat = document.createElement('canvas');
    flat.width = canvas.width;
    flat.height = canvas.height;
    const fctx = flat.getContext('2d');
    if (fctx) {
      fctx.fillStyle = '#ffffff';
      fctx.fillRect(0, 0, flat.width, flat.height);
      fctx.drawImage(canvas, 0, 0);
      source = flat;
    }
  }

  const mime = format === 'png' ? 'image/png' : format === 'jpeg' ? 'image/jpeg' : 'image/webp';
  source.toBlob(
    (blob) => {
      if (blob) download(blob, `${filename}.${format === 'jpeg' ? 'jpg' : format}`);
    },
    mime,
    format === 'jpeg' ? 0.92 : undefined,
  );
}

/** 导出 SVG */
export function exportSvg(svg: string, filename: string): void {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  download(blob, `${filename}.svg`);
}
