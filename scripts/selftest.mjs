/**
 * 自检脚本：不依赖浏览器，验证核心逻辑。
 * 运行：npm test
 */
import { utf8Bytes } from '../src/core/utf8.ts';
import { buildContent } from '../src/core/templates.ts';

let pass = 0;
let fail = 0;

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass++;
    console.log(`  [PASS] ${name}`);
  } else {
    fail++;
    console.log(`  [FAIL] ${name}`);
    console.log(`         期望: ${JSON.stringify(expected)}`);
    console.log(`         实际: ${JSON.stringify(actual)}`);
  }
}

console.log('\n=== UTF-8 编码 ===');
check('ASCII', utf8Bytes('ABC'), [65, 66, 67]);
check('中文', utf8Bytes('中'), [228, 184, 173]);
check('emoji（代理对完整）', utf8Bytes('😀'), [240, 159, 152, 128]);
check('中英混合', utf8Bytes('a中'), [97, 228, 184, 173]);

console.log('\n=== 内容模板 ===');

check(
  '文本',
  buildContent('text', { text: '  hello  ' }).content,
  'hello',
);

check(
  '网址',
  buildContent('url', { url: 'https://ewm.ipwl.cn/' }).content,
  'https://ewm.ipwl.cn/',
);

check(
  '电话',
  buildContent('telephone', { tel: '13800138000' }).content,
  'tel:13800138000',
);

check(
  '短信',
  buildContent('sms', { smsTel: '13800138000', smsBody: '你好' }).content,
  'smsto:13800138000:你好',
);

check(
  'WiFi（标准双分号结尾）',
  buildContent('wifi', { wifiSsid: 'MyWiFi', wifiPass: 'pass123', wifiEnc: 'WPA' }).content,
  'WIFI:T:WPA;S:MyWiFi;P:pass123;;',
);

check(
  'WiFi 无密码',
  buildContent('wifi', { wifiSsid: 'Open', wifiPass: '', wifiEnc: 'nopass' }).content,
  'WIFI:T:nopass;S:Open;;',
);

check(
  '联系卡',
  buildContent('card', {
    cardName: '张三',
    cardTel: '13800138000',
    cardOrg: '某公司',
    cardTitle: '工程师',
    cardUrl: 'https://ewm.ipwl.cn/',
    cardMail: 'a@b.com',
    cardAddr: '某地',
  }).content,
  [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'FN:张三',
    'ORG:某公司',
    'TITLE:工程师',
    'TEL;TYPE=CELL:13800138000',
    'URL:https://ewm.ipwl.cn/',
    'EMAIL:a@b.com',
    'ADR;TYPE=WORK:;;某地;;;;',
    'END:VCARD',
  ].join('\n'),
);

console.log('\n=== 校验逻辑 ===');
check('空文本报错', buildContent('text', { text: '' }).errors.length > 0, true);
check('无效邮箱报错', buildContent('mail', { mail: 'not-an-email' }).errors.length > 0, true);
check('http:// 占位视为空', buildContent('url', { url: 'http://' }).errors.length > 0, true);

console.log(`\n结果: ${pass} 通过, ${fail} 失败\n`);
process.exit(fail === 0 ? 0 : 1);
