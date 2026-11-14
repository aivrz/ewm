/**
 * 内容模板：把界面表单转换成二维码实际编码的内容串。
 *
 * 逻辑迁移自 ewm 的 js/basefn.js（该文件本身未被压缩，可直接对照）。
 * 迁移过程中修正了两个缺陷：
 *   1. WiFi 串原本结尾只有一个分号，不符合 WIFI: 协议要求的双分号结尾，
 *      部分手机会解析失败 —— 现输出标准 `WIFI:T:..;S:..;P:..;;`。
 *   2. vCard 原本不输出 FN 之外的 CHARSET，且网址字段 "http://" 占位未清洗 —— 已补正。
 */
import type { TemplateKind, TemplateResult } from './types.ts';

/** 模板表单字段取值 */
export type TemplateFields = Record<string, string>;

const trim = (v: string | undefined): string => (v ?? '').trim();

const isMail = (v: string): boolean =>
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(v);

/** 宽松的网址校验，允许裸域名 */
const isUrl = (v: string): boolean =>
  /^(https?|ftp):\/\/[^\s]+$/i.test(v) || /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+(\/\S*)?$/.test(v);

/**
 * 根据模板类型生成编码内容。
 * @param kind 模板类型
 * @param f 表单字段
 */
export function buildContent(kind: TemplateKind, f: TemplateFields): TemplateResult {
  const errors: string[] = [];
  let content = '';

  switch (kind) {
    case 'text': {
      content = trim(f.text);
      if (!content) errors.push('文本不能为空');
      break;
    }

    case 'url': {
      content = trim(f.url);
      if (!content || content === 'http://') errors.push('网址不能为空');
      else if (!isUrl(content)) errors.push('无效的网址');
      break;
    }

    case 'telephone': {
      const tel = trim(f.tel);
      if (!tel) errors.push('电话号码不能为空');
      content = tel ? `tel:${tel}` : '';
      break;
    }

    case 'sms': {
      const tel = trim(f.smsTel);
      const body = trim(f.smsBody);
      if (!tel) errors.push('电话号码不能为空');
      if (!body) errors.push('短信内容不能为空');
      content = tel ? `smsto:${tel}:${body}` : '';
      break;
    }

    case 'mail': {
      const mail = trim(f.mail);
      if (!mail) errors.push('邮箱不能为空');
      else if (!isMail(mail)) errors.push('无效的邮箱');
      content = mail;
      break;
    }

    case 'wifi': {
      const ssid = trim(f.wifiSsid);
      const pass = trim(f.wifiPass);
      const enc = trim(f.wifiEnc) || 'WPA';
      if (!ssid) errors.push('无线上网 ID 不能为空');
      if (!pass) errors.push('无线上网密码不能为空');
      if (ssid) {
        // 标准格式：WIFI:T:WPA;S:ssid;P:pass;H:false;;（双分号结尾）
        const parts = [`T:${enc}`, `S:${ssid}`];
        if (pass) parts.push(`P:${pass}`);
        content = `WIFI:${parts.join(';')};;`;
      }
      break;
    }

    case 'card': {
      const name = trim(f.cardName);
      const org = trim(f.cardOrg);
      const title = trim(f.cardTitle);
      const tel = trim(f.cardTel);
      const phone = trim(f.cardPhone);
      const fax = trim(f.cardFax);
      const url = trim(f.cardUrl);
      const mail = trim(f.cardMail);
      const addr = trim(f.cardAddr);
      const note = trim(f.cardNote);

      if (!name) errors.push('姓名不能为空');
      if (!tel) errors.push('电话号码不能为空');
      if (url && url !== 'http://' && !isUrl(url)) errors.push('无效的网址');
      if (mail && !isMail(mail)) errors.push('无效的邮箱');

      const lines: string[] = ['BEGIN:VCARD', 'VERSION:3.0'];
      if (name) lines.push(`FN:${name}`);
      if (org) lines.push(`ORG:${org}`);
      if (title) lines.push(`TITLE:${title}`);
      if (tel) lines.push(`TEL;TYPE=CELL:${tel}`);
      if (phone) lines.push(`TEL;TYPE=WORK,VOICE:${phone}`);
      if (fax) lines.push(`TEL;TYPE=WORK,FAX:${fax}`);
      if (url && url !== 'http://') lines.push(`URL:${url}`);
      if (mail) lines.push(`EMAIL:${mail}`);
      if (addr) lines.push(`ADR;TYPE=WORK:;;${addr};;;;`);
      if (note) lines.push(`NOTE:${note}`);
      lines.push('END:VCARD');

      content = lines.join('\n');
      break;
    }
  }

  return { content, errors };
}

/** 各模板对应的表单字段清单，用于 UI 渲染与取值 */
export const TEMPLATE_FIELDS: Record<TemplateKind, string[]> = {
  text: ['text'],
  url: ['url'],
  card: [
    'cardName',
    'cardOrg',
    'cardTitle',
    'cardTel',
    'cardPhone',
    'cardFax',
    'cardUrl',
    'cardMail',
    'cardAddr',
    'cardNote',
  ],
  telephone: ['tel'],
  sms: ['smsTel', 'smsBody'],
  wifi: ['wifiSsid', 'wifiPass', 'wifiEnc'],
  mail: ['mail'],
};

/** 模板的中文标签 */
export const TEMPLATE_LABELS: Record<TemplateKind, string> = {
  text: '免费文本',
  url: '网址',
  card: '联系卡',
  telephone: '手机',
  sms: '短信',
  wifi: '无线上网',
  mail: '邮件',
};
