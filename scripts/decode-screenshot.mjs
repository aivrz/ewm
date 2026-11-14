/**
 * 验证「美化后的二维码」是否仍可被解码。
 * 输入：页面截图 PNG（需包含二维码）。
 * 逻辑：从整张图里定位二维码并解码，比对内容。
 */
import fs from 'node:fs';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';

const file = process.argv[2];
const expected = process.argv[3] ?? 'https://ewm.ipwl.cn/';

const png = PNG.sync.read(fs.readFileSync(file));
const result = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);

if (!result) {
  console.log('  [FAIL] 未能从截图中定位并解码二维码');
  process.exit(1);
}
if (result.data !== expected) {
  console.log('  [FAIL] 解码内容不匹配');
  console.log(`         期望: ${expected}`);
  console.log(`         实际: ${result.data}`);
  process.exit(1);
}
console.log(`  [PASS] 美化后的二维码可正常解码 → ${result.data}`);
process.exit(0);
