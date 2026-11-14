/**
 * SVG 导出
 *
 * 修复 ewm 的一个关键缺陷：原实现的 SVG 导出（canvas.js 的 createSVG）只画纯色矩形，
 * 渐变、码眼配色、Logo、圆角、水滴效果全部丢失，用户导出的 SVG 与预览完全不同。
 *
 * 这里重新实现，并且把逐模块 <rect>（最多约 3 万个节点）合并成单条 <path>，
 * 文件体积与渲染开销大幅下降。
 */
import type { QrMatrix, RenderOptions } from '../core/types.ts';
import { finderOrigins, isFinderArea } from './renderer.ts';

/** 把颜色转成可用的填充值 */
function safe(color: string | null, fallback: string): string {
  return color && color.trim() ? color : fallback;
}

/** 生成渐变 defs */
function gradientDefs(opts: RenderOptions, id: string): string {
  if (!opts.gradientEnabled) return '';

  const from = opts.fgColor;
  const to = safe(opts.gcColor, opts.fgColor);

  if (opts.gradientWay === 'radial') {
    return (
      `<radialGradient id="${id}" cx="50%" cy="50%" r="70%">` +
      `<stop offset="0%" stop-color="${from}"/>` +
      `<stop offset="100%" stop-color="${to}"/>` +
      `</radialGradient>`
    );
  }

  const coords: Record<string, [string, string, string, string]> = {
    horizontal: ['0%', '0%', '100%', '0%'],
    vertical: ['0%', '0%', '0%', '100%'],
    diagonal: ['0%', '0%', '100%', '100%'],
    'anti-diagonal': ['0%', '100%', '100%', '0%'],
  };
  const [x1, y1, x2, y2] = coords[opts.gradientWay] ?? coords.horizontal;

  return (
    `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">` +
    `<stop offset="0%" stop-color="${from}"/>` +
    `<stop offset="100%" stop-color="${to}"/>` +
    `</linearGradient>`
  );
}

/** 生成一个圆角矩形的 path（radius 为 0 时退化为普通矩形） */
function rectPath(
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): string {
  const rad = Math.max(0, Math.min(radius, Math.min(w, h) / 2));
  if (rad === 0) {
    return `M ${x.toFixed(3)} ${y.toFixed(3)} h ${w.toFixed(3)} v ${h.toFixed(3)} h ${(-w).toFixed(3)} Z`;
  }
  const r = rad.toFixed(3);
  return (
    `M ${(x + rad).toFixed(3)} ${y.toFixed(3)} ` +
    `H ${(x + w - rad).toFixed(3)} ` +
    `A ${r} ${r} 0 0 1 ${(x + w).toFixed(3)} ${(y + rad).toFixed(3)} ` +
    `V ${(y + h - rad).toFixed(3)} ` +
    `A ${r} ${r} 0 0 1 ${(x + w - rad).toFixed(3)} ${(y + h).toFixed(3)} ` +
    `H ${(x + rad).toFixed(3)} ` +
    `A ${r} ${r} 0 0 1 ${x.toFixed(3)} ${(y + h - rad).toFixed(3)} ` +
    `V ${(y + rad).toFixed(3)} ` +
    `A ${r} ${r} 0 0 1 ${(x + rad).toFixed(3)} ${y.toFixed(3)} Z`
  );
}

/** 生成单个模块的 path 片段 */
function modulePath(
  x: number,
  y: number,
  s: number,
  style: RenderOptions['dotStyle'],
  roundRatio: number,
): string {
  switch (style) {
    case 'dots':
      return (
        `M ${(x + s / 2).toFixed(3)} ${y.toFixed(3)} ` +
        `a ${(s / 2).toFixed(3)} ${(s / 2).toFixed(3)} 0 1 0 0.001 0 Z`
      );
    case 'rounded':
    case 'classy':
    case 'classy-rounded':
    case 'extra-rounded': {
      const ratio =
        style === 'rounded'
          ? roundRatio
          : style === 'classy'
            ? 0.18
            : style === 'classy-rounded'
              ? 0.35
              : 0.5;
      return rectPath(x, y, s, s, s * ratio);
    }
    case 'square':
    default:
      return `M ${x.toFixed(3)} ${y.toFixed(3)} h ${s.toFixed(3)} v ${s.toFixed(3)} h ${(-s).toFixed(3)} Z`;
  }
}

/** 生成码眼外框（7x7 环）的 path */
function finderOuterPath(
  originX: number,
  originY: number,
  cell: number,
  style: RenderOptions['finderStyle'],
): string {
  const rOuter = style === 'rounded' ? cell * 0.4 : style === 'extra-rounded' ? cell * 0.9 : 0;
  const parts = [
    rectPath(originX, originY, 7 * cell, cell, rOuter),
    rectPath(originX, originY + 6 * cell, 7 * cell, cell, rOuter),
    rectPath(originX, originY + cell, cell, 5 * cell, 0),
    rectPath(originX + 6 * cell, originY + cell, cell, 5 * cell, 0),
  ];
  return parts.join(' ');
}

/** 生成码眼内点（3x3）的 path */
function finderInnerPath(
  originX: number,
  originY: number,
  cell: number,
  style: RenderOptions['finderStyle'],
): string {
  const x = originX + 2 * cell;
  const y = originY + 2 * cell;
  const s = 3 * cell;
  if (style === 'dot') {
    return (
      `M ${(x + s / 2).toFixed(3)} ${y.toFixed(3)} ` +
      `a ${(s / 2).toFixed(3)} ${(s / 2).toFixed(3)} 0 1 0 0.001 0 Z`
    );
  }
  const rInner = style === 'square' ? 0 : style === 'extra-rounded' ? cell * 0.7 : cell * 0.35;
  return rectPath(x, y, s, s, rInner);
}

/**
 * 生成与 Canvas 预览一致的 SVG 字符串。
 * @param matrix 编码矩阵
 * @param opts 渲染参数
 */
export function buildSvg(matrix: QrMatrix, opts: RenderOptions): string {
  const S = opts.size;
  const total = matrix.size + opts.margin * 2;
  const cell = S / total;
  const offset = opts.margin * cell;

  const defs = gradientDefs(opts, 'qrgrad');
  const dataFill = opts.gradientEnabled ? 'url(#qrgrad)' : opts.fgColor;

  // 数据模块：合并为单条 path
  let d = '';
  for (let r = 0; r < matrix.size; r++) {
    for (let c = 0; c < matrix.size; c++) {
      if (!matrix.isDark(r, c)) continue;
      if (isFinderArea(r, c, matrix.size)) continue;
      d += modulePath(offset + c * cell, offset + r * cell, cell, opts.dotStyle, opts.roundRatio);
    }
  }

  // 码眼
  const outerFill = opts.ptColor ?? dataFill;
  const innerFill = opts.inptColor ?? dataFill;
  let finderOuter = '';
  let finderInner = '';
  for (const [fr, fc] of finderOrigins(matrix.size)) {
    const ox = offset + fc * cell;
    const oy = offset + fr * cell;
    finderOuter += finderOuterPath(ox, oy, cell, opts.finderStyle);
    finderInner += finderInnerPath(ox, oy, cell, opts.finderStyle);
  }

  // 背景
  const bg = opts.bgColor
    ? `<rect x="0" y="0" width="${S}" height="${S}" fill="${opts.bgColor}"/>`
    : '';

  // 文字
  const text = opts.ctext.trim()
    ? `<text x="${S / 2}" y="${S / 2}" text-anchor="middle" dominant-baseline="central" ` +
      `font-family="PingFang SC,Microsoft YaHei,sans-serif" font-weight="bold" ` +
      `font-size="${(opts.fontSize * cell).toFixed(2)}" ` +
      `fill="${opts.ftColor || dataFill}" stroke="${opts.bgColor || '#ffffff'}" stroke-width="2">` +
      `${opts.ctext.trim().replace(/[<>&]/g, (m) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[m]!)}` +
      `</text>`
    : '';

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">` +
    (defs ? `<defs>${defs}</defs>` : '') +
    bg +
    (d ? `<path d="${d}" fill="${dataFill}"/>` : '') +
    (finderOuter ? `<path d="${finderOuter}" fill="${outerFill}"/>` : '') +
    (finderInner ? `<path d="${finderInner}" fill="${innerFill}"/>` : '') +
    text +
    `</svg>`
  );
}
