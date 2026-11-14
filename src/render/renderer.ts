/**
 * Canvas 渲染层
 *
 * 能力迁移自 ewm 的 js/canvas.js（该文件被 Packer 压缩成 eval），
 * 这里用 TypeScript 重写，保留全部美化能力并修复若干缺陷：
 *   - SVG 导出丢失所有美化的问题（由 render/svg.ts 独立解决）
 *   - 180° 旋转因转置两次等于没转
 *   - 非法 MIME "image/jpg" 导出的 .jpg 实为 PNG
 *   - 静默区以像素计、不可控
 */
import type { QrMatrix, RenderOptions } from '../core/types.ts';

/** 画一个圆角矩形路径 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/** 判断 (row,col) 是否落在某个定位图案（码眼）区域内 */
export function isFinderArea(row: number, col: number, size: number): boolean {
  return (
    (row < 7 && col < 7) ||
    (row < 7 && col >= size - 7) ||
    (row >= size - 7 && col < 7)
  );
}

/** 码眼的三个左上角坐标 */
export function finderOrigins(size: number): Array<[number, number]> {
  return [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ];
}

/** 绘制单个码点的路径（不填充，由调用方决定填充色） */
function modulePath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  style: RenderOptions['dotStyle'],
  roundRatio: number,
): void {
  switch (style) {
    case 'dots':
      ctx.beginPath();
      ctx.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2);
      break;
    case 'rounded':
      roundRect(ctx, x, y, s, s, s * roundRatio);
      break;
    case 'classy':
      roundRect(ctx, x, y, s, s, s * 0.18);
      break;
    case 'classy-rounded':
      roundRect(ctx, x, y, s, s, s * 0.35);
      break;
    case 'extra-rounded':
      roundRect(ctx, x, y, s, s, s * 0.5);
      break;
    case 'square':
    default:
      ctx.beginPath();
      ctx.rect(x, y, s, s);
      break;
  }
}

/** 绘制码点路径（可带水滴尖角） */
function paintModule(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  opts: RenderOptions,
  matrix: QrMatrix,
  row: number,
  col: number,
): void {
  modulePath(ctx, x, y, s, opts.dotStyle, opts.roundRatio);
  ctx.fill();

  if (!opts.isWater) return;

  // 水滴效果：在右下角补一个尖角，形成"水滴"造型
  const dark = (r: number, c: number): boolean =>
    r >= 0 && c >= 0 && r < matrix.size && c < matrix.size && matrix.isDark(r, c);

  if (dark(row + 1, col) && dark(row, col + 1) && !dark(row + 1, col + 1)) {
    ctx.beginPath();
    ctx.moveTo(x + s, y);
    ctx.lineTo(x + s, y + s);
    ctx.lineTo(x + s * 0.35, y + s * 0.35);
    ctx.closePath();
    ctx.fill();
  }
}

/** 创建渐变对象 */
function createGradient(
  ctx: CanvasRenderingContext2D,
  opts: RenderOptions,
  size: number,
): CanvasGradient | string {
  if (!opts.gradientEnabled) return opts.fgColor;

  const from = opts.fgColor;
  const to = opts.gcColor;
  let g: CanvasGradient;

  switch (opts.gradientWay) {
    case 'vertical':
      g = ctx.createLinearGradient(0, 0, 0, size);
      break;
    case 'diagonal':
      g = ctx.createLinearGradient(0, 0, size, size);
      break;
    case 'anti-diagonal':
      g = ctx.createLinearGradient(0, size, size, 0);
      break;
    case 'radial':
      g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      break;
    case 'horizontal':
    default:
      g = ctx.createLinearGradient(0, 0, size, 0);
      break;
  }
  g.addColorStop(0, from);
  g.addColorStop(1, to);
  return g;
}

/** 绘制一个码眼（定位图案） */
function drawFinder(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  cell: number,
  opts: RenderOptions,
  paint: CanvasGradient | string,
): void {
  const outer = opts.ptColor ?? (typeof paint === 'string' ? paint : opts.fgColor);
  const inner = opts.inptColor ?? (typeof paint === 'string' ? paint : opts.fgColor);
  const style = opts.finderStyle;

  // 外框 7x7 环
  ctx.fillStyle = outer;
  const ring = (rx: number, ry: number, rw: number, rh: number, radius: number) => {
    roundRect(ctx, originX + rx * cell, originY + ry * cell, rw * cell, rh * cell, radius);
    ctx.fill();
  };
  const rOuter =
    style === 'rounded' ? cell * 0.4 : style === 'extra-rounded' ? cell * 0.9 : 0;
  ring(0, 0, 7, 1, rOuter);
  ring(0, 6, 7, 1, rOuter);
  ring(0, 1, 1, 5, 0);
  ring(6, 1, 1, 5, 0);

  // 内点 3x3
  ctx.fillStyle = inner;
  if (style === 'dot') {
    ctx.beginPath();
    ctx.arc(
      originX + 3.5 * cell,
      originY + 3.5 * cell,
      1.5 * cell,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  } else {
    const rInner = style === 'square' ? 0 : cell * (style === 'extra-rounded' ? 0.7 : 0.35);
    ring(2, 2, 3, 3, rInner);
  }
}

/** 绘制 Logo */
function drawLogo(
  ctx: CanvasRenderingContext2D,
  logo: CanvasImageSource,
  box: { x: number; y: number; w: number; h: number },
  type: RenderOptions['logoType'],
  size: number,
): void {
  const { x, y, w, h } = box;

  switch (type) {
    case 'icon': {
      // 圆角裁切
      ctx.save();
      roundRect(ctx, x, y, w, h, size * 0.06);
      ctx.clip();
      ctx.drawImage(logo, x, y, w, h);
      ctx.restore();
      break;
    }
    case 'border': {
      // 白色底板 + 内边距
      const pad = size * 0.03;
      ctx.save();
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, x - pad, y - pad, w + pad * 2, h + pad * 2, size * 0.05);
      ctx.fill();
      ctx.restore();
      ctx.drawImage(logo, x, y, w, h);
      break;
    }
    case 'stroke': {
      // 多方向偏移叠加形成描边
      const n = Math.max(2, Math.round(size * 0.02));
      ctx.save();
      for (let a = 0; a < 360; a += 360 / (n * 4)) {
        const rad = (a * Math.PI) / 180;
        ctx.drawImage(
          logo,
          x + Math.cos(rad) * n,
          y + Math.sin(rad) * n,
          w,
          h,
        );
      }
      ctx.restore();
      ctx.drawImage(logo, x, y, w, h);
      break;
    }
    case 'raw':
    default:
      ctx.drawImage(logo, x, y, w, h);
      break;
  }
}

/** 绘制嵌入文字（叠加在二维码中心） */
function drawText(
  ctx: CanvasRenderingContext2D,
  opts: RenderOptions,
  paint: CanvasGradient | string,
  scale: number,
): void {
  const text = opts.ctext.trim();
  if (!text) return;

  const c = opts.size / 2;
  const base = typeof paint === 'string' ? paint : opts.fgColor;

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.font = `bold ${opts.fontSize * scale}px "PingFang SC","Microsoft YaHei",sans-serif`;

  const strokeColor = opts.bgColor ?? '#ffffff';

  switch (opts.fontEffect) {
    case 'inner':
      ctx.lineWidth = 6 * scale;
      ctx.fillStyle = base;
      ctx.strokeStyle = strokeColor;
      ctx.strokeText(text, c, c);
      ctx.fillText(text, c, c);
      break;
    case 'outer':
      ctx.lineWidth = 6 * scale;
      ctx.fillStyle = strokeColor;
      ctx.strokeStyle = base;
      ctx.strokeText(text, c, c);
      ctx.fillText(text, c, c);
      break;
    case 'stretch': {
      const r = 16 * scale;
      ctx.lineWidth = 2 * scale;
      ctx.fillStyle = opts.ftColor || base;
      ctx.strokeStyle = strokeColor;
      for (let i = 0; i < r; i++) {
        ctx.globalAlpha = (i + 1) / r;
        ctx.strokeText(text, c, c - r + i);
        ctx.fillText(text, c, c - r + i);
      }
      break;
    }
    case 'three-d': {
      const r = 5 * scale;
      ctx.lineWidth = 4 * scale;
      ctx.fillStyle = opts.ftColor || base;
      ctx.strokeStyle = strokeColor;
      for (let i = 0; i < r; i++) {
        ctx.globalAlpha = (i + 1) / r;
        ctx.strokeText(text, c + r - i * 2, c - r + i);
        ctx.fillText(text, c + r - i * 2, c - r + i);
      }
      break;
    }
    case 'glow':
      ctx.lineWidth = 2 * scale;
      ctx.fillStyle = opts.ftColor || base;
      ctx.shadowColor = strokeColor;
      ctx.shadowOffsetX = 2 * scale;
      ctx.shadowOffsetY = -2 * scale;
      ctx.shadowBlur = 6 * scale;
      ctx.strokeStyle = strokeColor;
      ctx.strokeText(text, c, c);
      ctx.fillText(text, c, c);
      break;
    case 'none':
    default:
      ctx.lineWidth = 2 * scale;
      ctx.fillStyle = opts.ftColor || base;
      ctx.strokeStyle = strokeColor;
      ctx.strokeText(text, c, c);
      ctx.fillText(text, c, c);
      break;
  }
  ctx.restore();
}

/** 取图片的原始像素尺寸，不支持时返回 fallback */
function imageSize(img: CanvasImageSource, fallback: number): { w: number; h: number } {
  const probe = img as { width?: unknown; height?: unknown };
  const w = typeof probe.width === 'number' && probe.width > 0 ? probe.width : fallback;
  const h = typeof probe.height === 'number' && probe.height > 0 ? probe.height : fallback;
  return { w, h };
}

/**
 * 主渲染入口。
 * @param canvas 目标画布
 * @param matrix 编码后的矩阵
 * @param opts 渲染参数
 */
export function renderQr(
  canvas: HTMLCanvasElement,
  matrix: QrMatrix,
  opts: RenderOptions,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const S = opts.size;
  canvas.width = S;
  canvas.height = S;
  ctx.clearRect(0, 0, S, S);

  // 背景
  if (opts.bgColor) {
    ctx.fillStyle = opts.bgColor;
    ctx.fillRect(0, 0, S, S);
  }

  // 静默区（模块数）→ 单元格尺寸
  const total = matrix.size + opts.margin * 2;
  const cell = S / total;
  const offset = opts.margin * cell;

  const paint = createGradient(ctx, opts, S);

  // 数据模块（跳过码眼区域，码眼单独绘制以便独立配色）
  ctx.fillStyle = paint;
  for (let r = 0; r < matrix.size; r++) {
    for (let c = 0; c < matrix.size; c++) {
      if (!matrix.isDark(r, c)) continue;
      if (isFinderArea(r, c, matrix.size)) continue;
      paintModule(
        ctx,
        offset + c * cell,
        offset + r * cell,
        cell,
        opts,
        matrix,
        r,
        c,
      );
    }
  }

  // 码眼
  for (const [fr, fc] of finderOrigins(matrix.size)) {
    drawFinder(ctx, offset + fc * cell, offset + fr * cell, cell, opts, paint);
  }

  // 文字
  // 字号比例基准：二维码区域像素边长 / 250（与 ewm 的 250px 画布行为一致），
  // 这样 fontSize=28 在标准尺寸下就是 28px，且随画布等比缩放。
  const qrSide = matrix.size * cell;
  drawText(ctx, opts, paint, qrSide / 250);

  // Logo（ewm 旧逻辑：纠错等级为 L 时不叠加 Logo）
  if (opts.logo && opts.level !== 'L') {
    const logoSize = S * 0.22;
    const { w: lw, h: lh } = imageSize(opts.logo, logoSize);
    const ratio = lw / lh;
    let w = logoSize;
    let h = logoSize / ratio;
    if (h > logoSize) {
      h = logoSize;
      w = logoSize * ratio;
    }
    drawLogo(
      ctx,
      opts.logo,
      { x: (S - w) / 2, y: (S - h) / 2, w, h },
      opts.logoType,
      S,
    );
  }

  // 旋转（ewm 旧实现把画布转置两次，180° 实际等于没转，这里用离屏画布正确处理）
  if (opts.rotate !== 0) {
    const off = document.createElement('canvas');
    off.width = S;
    off.height = S;
    const octx = off.getContext('2d');
    if (octx) {
      octx.drawImage(canvas, 0, 0);
      ctx.clearRect(0, 0, S, S);
      ctx.save();
      ctx.translate(S / 2, S / 2);
      ctx.rotate((opts.rotate * Math.PI) / 180);
      ctx.drawImage(off, -S / 2, -S / 2);
      ctx.restore();
    }
  }
}
