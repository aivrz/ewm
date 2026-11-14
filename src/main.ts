/**
 * 应用主控
 *
 * 相比 ewm 的 html5.js（被 Packer 压缩成 eval）：
 *   - 接上了原本定义了却从未调用的 500ms 防抖（execCanvas），改为 250ms
 *   - 移除了 jQuery 依赖与对全局变量的污染
 *   - 默认内容指向站点自身地址，不再是残留的第三方示例网址
 *   - 默认纠错等级从 L 改为 Q，避免美化后扫不出
 */
import './style.css';
import { checkCapacity, encodeMatrix } from './core/encoder.ts';
import { buildContent } from './core/templates.ts';
import { renderQr } from './render/renderer.ts';
import { buildSvg } from './render/svg.ts';
import { exportCanvas, exportSvg } from './render/download.ts';
import type {
  DotStyle,
  EccLevel,
  FinderStyle,
  FontEffect,
  GradientWay,
  LogoType,
  QrMatrix,
  RenderOptions,
  TemplateKind,
} from './core/types.ts';

/** 站点自身地址，作为首次打开的默认内容 */
const DEFAULT_CONTENT = 'https://ewm.ipwl.cn/';

const $ = <T extends HTMLElement>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`缺少元素: ${sel}`);
  return el;
};

const canvas = $<HTMLCanvasElement>('#canvas');
const statusEl = $('#status');
const shareEl = $<HTMLTextAreaElement>('#shareContent');

/** 可分享状态（不含二进制 Logo，Logo 通过 URL 片段无法承载，故不参与分享） */
interface ShareState {
  kind: TemplateKind;
  fields: Record<string, string>;
  opts: RenderOptions;
}

const state: ShareState & { logo: CanvasImageSource | null } = {
  kind: 'url',
  fields: {
    url: DEFAULT_CONTENT,
    text: '',
    mail: '',
    tel: '',
    smsTel: '',
    smsBody: '',
    wifiSsid: '',
    wifiPass: '',
    wifiEnc: 'WPA',
    cardName: '',
    cardOrg: '',
    cardTitle: '',
    cardTel: '',
    cardPhone: '',
    cardFax: '',
    cardUrl: '',
    cardMail: '',
    cardAddr: '',
    cardNote: '',
  },
  logo: null,
  opts: {
    text: '',
    level: 'Q',
    size: 320,
    margin: 4,
    fgColor: '#000000',
    bgColor: '#ffffff',
    dotStyle: 'square',
    roundRatio: 0.3,
    gradientEnabled: false,
    gradientWay: 'horizontal',
    gcColor: '#1d9e75',
    ptColor: null,
    inptColor: null,
    finderStyle: 'square',
    isWater: false,
    logoType: 'icon',
    logo: null,
    rotate: 0,
    ctext: '',
    fontEffect: 'none',
    fontSize: 28,
    ftColor: '#000000',
  },
};

/** 最近一次成功编码的结果 */
let lastMatrix: QrMatrix | null = null;
let lastSvg = '';

/** 防抖定时器 */
let timer: number | undefined;

/** 读取表单里所有模板字段的当前值 */
function collectFields(): void {
  for (const [key, id] of Object.entries({
    text: 'f-text',
    url: 'f-url',
    cardName: 'f-cardName',
    cardOrg: 'f-cardOrg',
    cardTitle: 'f-cardTitle',
    cardTel: 'f-cardTel',
    cardPhone: 'f-cardPhone',
    cardFax: 'f-cardFax',
    cardUrl: 'f-cardUrl',
    cardMail: 'f-cardMail',
    cardAddr: 'f-cardAddr',
    cardNote: 'f-cardNote',
    tel: 'f-tel',
    smsTel: 'f-smsTel',
    smsBody: 'f-smsBody',
    wifiSsid: 'f-wifiSsid',
    wifiPass: 'f-wifiPass',
    wifiEnc: 'f-wifiEnc',
    mail: 'f-mail',
  })) {
    const el = document.querySelector<HTMLInputElement>(`#${id}`);
    if (el) state.fields[key] = el.value;
  }
}

/** 执行一次渲染 */
function render(): void {
  collectFields();

  const { content, errors } = buildContent(state.kind, state.fields);
  state.opts.text = content;

  if (errors.length > 0) {
    statusEl.textContent = errors.join('；');
    statusEl.className = 'status status-error';
    return;
  }

  const cap = checkCapacity(content, state.opts.level);
  if (!cap.ok) {
    statusEl.textContent = cap.hint;
    statusEl.className = 'status status-error';
    return;
  }

  try {
    const matrix = encodeMatrix(content, state.opts.level);
    lastMatrix = matrix;
    state.opts.logo = state.logo;
    renderQr(canvas, matrix, state.opts);
    lastSvg = buildSvg(matrix, state.opts);
    shareEl.value = content;
    statusEl.textContent = `版本 ${matrix.version} · ${matrix.size}×${matrix.size} 模块 · ${content.length} 字符`;
    statusEl.className = 'status status-ok';
  } catch (err) {
    statusEl.textContent = `生成失败：${(err as Error).message}`;
    statusEl.className = 'status status-error';
  }
}

/** 防抖渲染 */
function scheduleRender(): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(render, 250);
}

/** 切换模板 */
function setTemplate(kind: TemplateKind): void {
  state.kind = kind;
  for (const tab of document.querySelectorAll<HTMLElement>('#tabs .tab')) {
    tab.classList.toggle('active', tab.dataset.template === kind);
  }
  for (const pane of document.querySelectorAll<HTMLElement>('.form-block')) {
    pane.hidden = pane.dataset.pane !== kind;
  }
  scheduleRender();
}

/** 从 URL 片段恢复可分享状态 */
function loadFromHash(): void {
  const hash = location.hash.replace(/^#/, '');
  if (!hash) return;
  try {
    const parsed = JSON.parse(decodeURIComponent(escape(atob(hash))));
    if (parsed && typeof parsed === 'object') {
      if (parsed.kind) state.kind = parsed.kind;
      if (parsed.fields) Object.assign(state.fields, parsed.fields);
      if (parsed.opts) Object.assign(state.opts, parsed.opts, { logo: null });
    }
  } catch {
    // 片段非法则忽略，使用默认值
  }
}

/** 把当前状态写回 URL 片段 */
function writeHash(): void {
  const payload = JSON.stringify({ kind: state.kind, fields: state.fields, opts: state.opts });
  history.replaceState(null, '', `#${btoa(unescape(encodeURIComponent(payload)))}`);
}

/** 绑定所有控件 */
function bind(): void {
  // 模板标签
  for (const tab of document.querySelectorAll<HTMLElement>('#tabs .tab')) {
    tab.addEventListener('click', () => setTemplate(tab.dataset.template as TemplateKind));
  }

  // 所有输入类控件
  for (const el of document.querySelectorAll<HTMLElement>('.editor-panel input, .editor-panel select, .editor-panel textarea')) {
    if (el.id === 'logoInput') continue;
    el.addEventListener('input', scheduleRender);
    el.addEventListener('change', scheduleRender);
  }

  // 数值滑块回显
  const bindRange = (id: string, outId: string, fmt = (v: string) => v) => {
    const el = document.querySelector<HTMLInputElement>(`#${id}`);
    const out = document.querySelector<HTMLElement>(`#${outId}`);
    if (!el || !out) return;
    const update = () => {
      out.textContent = fmt(el.value);
    };
    el.addEventListener('input', update);
    update();
  };
  bindRange('roundRatio', 'roundRatioValue', (v) => Number(v).toFixed(2));
  bindRange('fontSize', 'fontSizeValue');
  bindRange('size', 'sizeValue');

  // 具体控件映射到状态
  const on = <T extends HTMLElement>(id: string, evt: string, fn: (el: T) => void) => {
    const el = document.querySelector<T>(`#${id}`);
    el?.addEventListener(evt, () => fn(el));
  };

  on<HTMLInputElement>('fgColor', 'input', (el) => {
    state.opts.fgColor = el.value;
  });
  on<HTMLInputElement>('bgColor', 'input', (el) => {
    state.opts.bgColor = el.value;
  });
  on<HTMLInputElement>('gcColor', 'input', (el) => {
    state.opts.gcColor = el.value;
  });
  on<HTMLInputElement>('ftColor', 'input', (el) => {
    state.opts.ftColor = el.value;
  });
  on<HTMLInputElement>('ptColor', 'input', (el) => {
    state.opts.ptColor = el.value;
  });
  on<HTMLInputElement>('inptColor', 'input', (el) => {
    state.opts.inptColor = el.value;
  });
  on<HTMLInputElement>('ptFollow', 'change', (el) => {
    state.opts.ptColor = el.checked ? null : `#000000`;
  });
  on<HTMLInputElement>('inptFollow', 'change', (el) => {
    state.opts.inptColor = el.checked ? null : `#000000`;
  });
  on<HTMLInputElement>('gradientEnabled', 'change', (el) => {
    state.opts.gradientEnabled = el.checked;
  });
  on<HTMLSelectElement>('gradientWay', 'change', (el) => {
    state.opts.gradientWay = el.value as GradientWay;
  });
  on<HTMLSelectElement>('dotStyle', 'change', (el) => {
    state.opts.dotStyle = el.value as DotStyle;
  });
  on<HTMLSelectElement>('finderStyle', 'change', (el) => {
    state.opts.finderStyle = el.value as FinderStyle;
  });
  on<HTMLInputElement>('roundRatio', 'input', (el) => {
    state.opts.roundRatio = Number(el.value);
  });
  on<HTMLInputElement>('isWater', 'change', (el) => {
    state.opts.isWater = el.checked;
  });
  on<HTMLSelectElement>('logoType', 'change', (el) => {
    state.opts.logoType = el.value as LogoType;
  });
  on<HTMLInputElement>('ctext', 'input', (el) => {
    state.opts.ctext = el.value;
  });
  on<HTMLSelectElement>('fontEffect', 'change', (el) => {
    state.opts.fontEffect = el.value as FontEffect;
  });
  on<HTMLInputElement>('fontSize', 'input', (el) => {
    state.opts.fontSize = Number(el.value);
  });
  on<HTMLInputElement>('size', 'input', (el) => {
    state.opts.size = Number(el.value);
  });
  on<HTMLSelectElement>('margin', 'change', (el) => {
    state.opts.margin = Number(el.value);
  });
  on<HTMLSelectElement>('level', 'change', (el) => {
    state.opts.level = el.value as EccLevel;
  });
  on<HTMLSelectElement>('rotate', 'change', (el) => {
    state.opts.rotate = Number(el.value) as 0 | 90 | 180 | 270;
  });

  // Logo 上传
  on<HTMLInputElement>('logoInput', 'change', (el) => {
    const file = el.files?.[0];
    if (!file) {
      state.logo = null;
      scheduleRender();
      return;
    }
    const img = new Image();
    img.onload = () => {
      state.logo = img;
      scheduleRender();
    };
    img.src = URL.createObjectURL(file);
  });

  // 导出
  for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-export]')) {
    btn.addEventListener('click', () => {
      const name = ($<HTMLInputElement>('#fileName')).value.trim() || 'qrcode';
      const fmt = btn.dataset.export as 'png' | 'jpeg' | 'webp' | 'svg';
      if (fmt === 'svg') {
        if (!lastSvg) return;
        exportSvg(lastSvg, name);
      } else {
        if (!lastMatrix) return;
        exportCanvas(canvas, fmt, name);
      }
      writeHash();
    });
  }

  // 复制内容
  $('#copyContent').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareEl.value);
      const btn = $<HTMLButtonElement>('#copyContent');
      const old = btn.textContent;
      btn.textContent = '已复制';
      setTimeout(() => {
        btn.textContent = old;
      }, 1500);
    } catch {
      shareEl.select();
    }
  });

  // 恢复默认
  $('#resetAll').addEventListener('click', () => {
    state.opts.fgColor = '#000000';
    state.opts.bgColor = '#ffffff';
    state.opts.gcColor = '#1d9e75';
    state.opts.ptColor = null;
    state.opts.inptColor = null;
    state.opts.gradientEnabled = false;
    state.opts.dotStyle = 'square';
    state.opts.finderStyle = 'square';
    state.opts.roundRatio = 0.3;
    state.opts.isWater = false;
    state.opts.ctext = '';
    state.opts.fontEffect = 'none';
    state.opts.fontSize = 28;
    state.opts.ftColor = '#000000';
    state.opts.level = 'Q';
    state.opts.margin = 4;
    state.opts.rotate = 0;
    state.opts.size = 320;
    state.logo = null;

    // 同步回界面
    $<HTMLInputElement>('#fgColor').value = state.opts.fgColor;
    $<HTMLInputElement>('#bgColor').value = state.opts.bgColor;
    $<HTMLInputElement>('#gcColor').value = state.opts.gcColor;
    $<HTMLInputElement>('#ftColor').value = state.opts.ftColor;
    $<HTMLInputElement>('#ptColor').value = '#000000';
    $<HTMLInputElement>('#inptColor').value = '#000000';
    $<HTMLInputElement>('#ptFollow').checked = true;
    $<HTMLInputElement>('#inptFollow').checked = true;
    $<HTMLInputElement>('#gradientEnabled').checked = false;
    $<HTMLSelectElement>('#dotStyle').value = 'square';
    $<HTMLSelectElement>('#finderStyle').value = 'square';
    $<HTMLInputElement>('#roundRatio').value = '0.3';
    $<HTMLInputElement>('#isWater').checked = false;
    $<HTMLInputElement>('#ctext').value = '';
    $<HTMLSelectElement>('#fontEffect').value = 'none';
    $<HTMLInputElement>('#fontSize').value = '28';
    $<HTMLSelectElement>('#level').value = 'Q';
    $<HTMLSelectElement>('#margin').value = '4';
    $<HTMLSelectElement>('#rotate').value = '0';
    $<HTMLInputElement>('#size').value = '320';
    $<HTMLInputElement>('#logoInput').value = '';

    render();
  });
}

/** 把渲染参数同步回界面控件（用于从分享链接恢复时） */
function syncOptsToUI(): void {
  const set = <T extends HTMLInputElement | HTMLSelectElement>(id: string, value: string) => {
    const el = document.querySelector<T>(id);
    if (el) el.value = value;
  };

  set('#fgColor', state.opts.fgColor);
  set('#bgColor', state.opts.bgColor ?? '#ffffff');
  set('#gcColor', state.opts.gcColor);
  set('#ftColor', state.opts.ftColor);
  set('#ptColor', state.opts.ptColor ?? '#000000');
  set('#inptColor', state.opts.inptColor ?? '#000000');
  set('#gradientWay', state.opts.gradientWay);
  set('#dotStyle', state.opts.dotStyle);
  set('#finderStyle', state.opts.finderStyle);
  set('#logoType', state.opts.logoType);
  set('#fontEffect', state.opts.fontEffect);
  set('#level', state.opts.level);
  set('#margin', String(state.opts.margin));
  set('#rotate', String(state.opts.rotate));
  set('#size', String(state.opts.size));
  set('#roundRatio', String(state.opts.roundRatio));
  set('#fontSize', String(state.opts.fontSize));
  set('#ctext', state.opts.ctext);

  const check = (id: string, on: boolean) => {
    const el = document.querySelector<HTMLInputElement>(id);
    if (el) el.checked = on;
  };
  check('#gradientEnabled', state.opts.gradientEnabled);
  check('#isWater', state.opts.isWater);
  check('#ptFollow', state.opts.ptColor === null);
  check('#inptFollow', state.opts.inptColor === null);

  // 数值回显
  const out = (id: string, text: string) => {
    const el = document.querySelector<HTMLElement>(id);
    if (el) el.textContent = text;
  };
  out('#roundRatioValue', state.opts.roundRatio.toFixed(2));
  out('#fontSizeValue', String(state.opts.fontSize));
  out('#sizeValue', String(state.opts.size));
}

/** 初始化 */
function init(): void {
  loadFromHash();

  // 把恢复的字段值写回界面
  for (const [key, id] of Object.entries({
    text: 'f-text',
    url: 'f-url',
    cardName: 'f-cardName',
    cardOrg: 'f-cardOrg',
    cardTitle: 'f-cardTitle',
    cardTel: 'f-cardTel',
    cardPhone: 'f-cardPhone',
    cardFax: 'f-cardFax',
    cardUrl: 'f-cardUrl',
    cardMail: 'f-cardMail',
    cardAddr: 'f-cardAddr',
    cardNote: 'f-cardNote',
    tel: 'f-tel',
    smsTel: 'f-smsTel',
    smsBody: 'f-smsBody',
    wifiSsid: 'f-wifiSsid',
    wifiPass: 'f-wifiPass',
    wifiEnc: 'f-wifiEnc',
    mail: 'f-mail',
  })) {
    const el = document.querySelector<HTMLInputElement>(`#${id}`);
    if (el) el.value = state.fields[key] ?? '';
  }

  syncOptsToUI();
  bind();
  setTemplate(state.kind);
  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// 全局错误兜底：任何未捕获异常都显示到状态栏，避免用户看到空白画布
window.addEventListener('error', (e) => {
  statusEl.textContent = `运行时错误：${e.message}`;
  statusEl.className = 'status status-error';
});
window.addEventListener('unhandledrejection', (e) => {
  statusEl.textContent = `运行时错误：${String((e as PromiseRejectionEvent).reason)}`;
  statusEl.className = 'status status-error';
});
