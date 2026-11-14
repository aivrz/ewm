/**
 * 编码内核适配层
 *
 * 上游：qrcode-generator (Kazuhiko Arase 原作者授权，kozakdenys 维护的 v2)
 *      https://github.com/kozakdenys/qrcode-generator  MIT License
 *
 * 相比 ewm 内置的旧版（js/qrcode.js，被 Dean Edwards Packer 压成 eval），
 * 这里换成了 npm 正式发布的现代版本，并做了两处关键修正：
 *   1. 注入正确的 UTF-8 编码器，修复中文乱码与 emoji 代理对被拆断的问题。
 *   2. 输出稳定的矩阵接口，渲染层不再依赖被压缩变量名的内部实现。
 */
import qrcode from 'qrcode-generator';
import { utf8Bytes } from './utf8.ts';
import type { EccLevel, QrMatrix } from './types.ts';

/**
 * 覆盖上游默认的 Latin-1 截断实现。
 * 上游 `qr8BitByte` 在每次 addData 时实时读取 `qrcode.stringToBytes`，
 * 因此这里覆盖后即可全局生效。
 */
qrcode.stringToBytes = utf8Bytes;

/**
 * 把内容编码成二维码矩阵。
 * @param text 待编码内容
 * @param level 纠错等级
 * @throws 当内容超出 QR 容量（版本 40 + 最高纠错）时抛出
 */
export function encodeMatrix(text: string, level: EccLevel): QrMatrix {
  // v2 的工厂函数直接接受 'L' | 'M' | 'Q' | 'H' 字符串
  const qr = qrcode(0, level);
  qr.addData(text, 'Byte');
  qr.make();

  const size = qr.getModuleCount();
  const version = Math.floor((size - 17) / 4);

  return {
    size,
    version,
    isDark: (row: number, col: number) => qr.isDark(row, col),
  };
}

/**
 * 估算内容在给定纠错等级下是否放得下。
 * 用于输入时即时提示，避免用户填完才发现超限。
 */
export function checkCapacity(text: string, level: EccLevel): { ok: boolean; hint: string } {
  const bytes = utf8Bytes(text).length;
  // 版本 40 在各纠错等级下的字节容量（Byte 模式）
  const capBytes: Record<EccLevel, number> = { L: 2953, M: 2331, Q: 1663, H: 1273 };
  const cap = capBytes[level];
  if (bytes > cap) {
    return {
      ok: false,
      hint: `内容过长：${bytes} 字节，超出 ${level} 级上限 ${cap} 字节`,
    };
  }
  return { ok: true, hint: '' };
}
