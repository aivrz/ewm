/**
 * 端到端正确性验证：编码 → 渲染成位图 → 解码 → 比对原文
 *
 * 这是对整个编码链路最硬的验证：不仅检查"没报错"，
 * 而是真正用独立解码器把二维码读回来，确认内容一字不差。
 *
 * 运行：node --experimental-strip-types scripts/verify-decode.mjs
 */
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { encodeMatrix } from '../src/core/encoder.ts';
import { buildContent } from '../src/core/templates.ts';

let pass = 0;
let fail = 0;

/** 把矩阵渲染成 PNG 位图（含静默区） */
function renderPng(matrix, scale = 4, margin = 4) {
  const size = matrix.size + margin * 2;
  const px = size * scale;
  const png = new PNG({ width: px, height: px });

  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      const mx = Math.floor(x / scale) - margin;
      const my = Math.floor(y / scale) - margin;
      const inCode = mx >= 0 && my >= 0 && mx < matrix.size && my < matrix.size;
      const dark = inCode && matrix.isDark(my, mx);
      const i = (px * y + x) << 2;
      const v = dark ? 0 : 255;
      png.data[i] = v;
      png.data[i + 1] = v;
      png.data[i + 2] = v;
      png.data[i + 3] = 255;
    }
  }
  return png;
}

/** 解码并比对 */
function verify(label, original) {
  const matrix = encodeMatrix(original, 'Q');
  const png = renderPng(matrix);
  const result = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);

  if (!result) {
    fail++;
    console.log(`  [FAIL] ${label}`);
    console.log(`         解码失败：二维码无法被识别`);
    return;
  }
  if (result.data !== original) {
    fail++;
    console.log(`  [FAIL] ${label}`);
    console.log(`         期望: ${JSON.stringify(original)}`);
    console.log(`         实际: ${JSON.stringify(result.data)}`);
    return;
  }
  pass++;
  console.log(`  [PASS] ${label}  (版本 ${matrix.version}, ${matrix.size}×${matrix.size})`);
}

console.log('\n=== 端到端编解码验证（编码 → 位图 → 解码 → 比对）===');

verify('纯 ASCII 网址', 'https://ewm.ipwl.cn/');
verify('ASCII 文本', 'Hello QR Code 12345');
verify('中文内容', '这是一段中文测试内容，二维码');
verify('中文 + 英文 + 数字', 'IP网络 free 在线 generator 2026');
verify('emoji（代理对）', '扫码体验 😀🎉✨');
verify('中文 + emoji 混合', '微信扫一扫 😀 加微信');
verify('纯数字（数字模式）', '31415926535897932384626433832795028841');
verify('联系电话', 'tel:13800138000');
verify('WiFi 串', 'WIFI:T:WPA;S:MyWiFi;P:pass123;;');
verify('vCard 联系卡', buildContent('card', {
  cardName: '张三',
  cardTel: '13800138000',
  cardOrg: '某科技公司',
  cardTitle: '工程师',
  cardUrl: 'https://ewm.ipwl.cn/',
  cardMail: 'zhangsan@example.com',
  cardAddr: '北京市海淀区',
}).content);
verify('长内容（接近版本 10）', 'A'.repeat(200));

console.log('\n=== 纠错等级差异 ===');
for (const lv of ['L', 'M', 'Q', 'H']) {
  const m = encodeMatrix('https://ewm.ipwl.cn/', lv);
  const png = renderPng(m);
  const r = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  const ok = r && r.data === 'https://ewm.ipwl.cn/';
  if (ok) pass++;
  else fail++;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] 纠错 ${lv} → 版本 ${m.version} (${m.size}×${m.size})`);
}

console.log(`\n结果: ${pass} 通过, ${fail} 失败\n`);
process.exit(fail === 0 ? 0 : 1);
