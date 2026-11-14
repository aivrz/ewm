/**
 * UTF-8 字符串 → 字节数组
 *
 * 为什么需要这个模块：
 * qrcode-generator v2 的 `qrcode.stringToBytes` 默认是 Latin-1 截断
 * （`charCodeAt(i) & 0xff`），中文会变成乱码、emoji 的代理对会被拆成两个错误字节。
 * ewm 旧代码自己手写了转换逻辑，但存在代理对处理缺陷。
 *
 * 这里用 TextEncoder 实现，正确处理代理对，行为与浏览器原生一致。
 */

const encoder = new TextEncoder();

/**
 * 把字符串编码为 UTF-8 字节数组。
 * 不可编码的孤立代理项（如孤立的高位代理）会被替换为 U+FFFD，
 * 这是 WHATWG Encoding 标准的默认行为。
 */
export function utf8Bytes(s: string): number[] {
  return Array.from(encoder.encode(s));
}
