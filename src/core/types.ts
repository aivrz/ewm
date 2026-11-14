/**
 * 全局类型定义
 */

/** 纠错等级：L 7% / M 15% / Q 25% / H 30% */
export type EccLevel = 'L' | 'M' | 'Q' | 'H';

/** 码点样式，对应 qr-code-styling 的 dotsOptions.type */
export type DotStyle =
  | 'square'
  | 'rounded'
  | 'dots'
  | 'classy'
  | 'classy-rounded'
  | 'extra-rounded';

/** 渐变方向，对应 ewm 的 gradientWay 下拉框 */
export type GradientWay =
  | 'horizontal' // 水平
  | 'vertical' // 垂直
  | 'diagonal' // 斜线
  | 'anti-diagonal' // 反斜线
  | 'radial'; // 圆形

/** 码眼（定位图案）样式 */
export type FinderStyle = 'square' | 'rounded' | 'extra-rounded' | 'dot';

/** Logo 叠加方式，对应 ewm 的 logotype 四个单选 */
export type LogoType = 'icon' | 'border' | 'stroke' | 'raw';

/** 嵌入文字特效，对应 ewm 的 fonteffect 下拉框 */
export type FontEffect =
  | 'none'
  | 'inner' // 内融合
  | 'outer' // 外融合
  | 'stretch' // 拉伸
  | 'three-d' // 3D 效果
  | 'glow'; // 发光

/** 内容模板类型，对应 ewm 的 Mode_* */
export type TemplateKind =
  | 'text'
  | 'url'
  | 'card'
  | 'telephone'
  | 'sms'
  | 'wifi'
  | 'mail';

/** 渲染参数集合 */
export interface RenderOptions {
  /** 二维码内容 */
  text: string;
  /** 纠错等级 */
  level: EccLevel;
  /** 画布边长（px） */
  size: number;
  /** 静默区边距（模块数） */
  margin: number;
  /** 前景色 */
  fgColor: string;
  /** 背景色，null 表示透明 */
  bgColor: string | null;
  /** 码点样式 */
  dotStyle: DotStyle;
  /** 圆角半径比例 0~1 */
  roundRatio: number;
  /** 是否启用渐变 */
  gradientEnabled: boolean;
  /** 渐变方向 */
  gradientWay: GradientWay;
  /** 渐变终点色（起点为 fgColor） */
  gcColor: string;
  /** 码眼外框色，null 表示跟随前景 */
  ptColor: string | null;
  /** 码眼内点色，null 表示跟随前景 */
  inptColor: string | null;
  /** 码眼样式 */
  finderStyle: FinderStyle;
  /** 水滴码点 */
  isWater: boolean;
  /** Logo 叠加方式 */
  logoType: LogoType;
  /** Logo 图片 */
  logo: CanvasImageSource | null;
  /** 旋转角度，只允许 0/90/180/270 */
  rotate: 0 | 90 | 180 | 270;
  /** 嵌入文字 */
  ctext: string;
  /** 文字特效 */
  fontEffect: FontEffect;
  /** 文字字号 */
  fontSize: number;
  /** 文字颜色 */
  ftColor: string;
}

/** 编码结果 */
export interface QrMatrix {
  /** 边长（模块数） */
  size: number;
  /** 模块是否为暗色 */
  isDark: (row: number, col: number) => boolean;
  /** QR 版本号 */
  version: number;
}

/** 模板解析结果 */
export interface TemplateResult {
  /** 最终编码内容 */
  content: string;
  /** 校验错误 */
  errors: string[];
}
