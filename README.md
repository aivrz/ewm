# ewm · 现代化纯前端二维码生成器

对原版 [ewm](https://github.com/)（2013–2015 年风格的在线二维码生成器）的现代化重写。

**保留 ewm 的全部差异化能力**（渐变、码眼独立配色、Logo 四种叠加、圆角/水滴码点、嵌入文字与五种特效、七类内容模板），
**彻底移除** Dean Edwards Packer 的 `eval` 压缩层、失效的默认参数、过期 polyfill 与重复资源。

纯前端、零后端、零上传，可直接部署到 Cloudflare 静态托管（免费且不限流量）。

> 📘 **部署请看 [DEPLOY.md](./DEPLOY.md)** —— 含四套完整方案（Cloudflare Pages / Workers Static Assets / GitHub Pages / 自建 Nginx）、
> 自定义域名与 DNS 配置、CSP 详解、国内访问优化、成本核算与故障排查。
>
> 原版代码完整归档在 `legacy/` 目录（含你原有的站点配置改动），可随时查阅或回滚。

---

## 快速开始

```bash
npm install
npm run dev        # 本地开发 http://localhost:5173
npm run build      # 产物输出到 dist/
npm run preview    # 预览生产构建
npm run typecheck  # TypeScript 严格模式类型检查
npm test           # 单元自测（UTF-8 / 模板）
node --experimental-strip-types scripts/verify-decode.mjs   # 端到端编解码验证
```

---

## 与 ewm 的功能对照

| 能力 | ewm 原版 | 本项目 | 说明 |
|---|---|---|---|
| 内容模板 | 7 类 | 7 类 | 文本 / 网址 / 联系卡 / 电话 / 短信 / WiFi / 邮件，逻辑逐行迁移自 `basefn.js` |
| 渐变 | 5 方向 | 5 方向 | 水平 / 垂直 / 斜线 / 反斜线 / 圆形 |
| 码眼独立配色 | 有 | 有 | 外框色、内点色可分别指定，或跟随前景色 |
| Logo 叠加 | 4 模式 | 4 模式 | 圆角 / 白色边框 / 描边 / 原图 |
| 码点形状 | 部分 | 6 种 | 方形 / 圆角 / 圆形 / 轻圆角 / 中圆角 / 重圆角 |
| 水滴码点 | 有 | 有 | — |
| 嵌入文字 + 特效 | 5 种 | 5 种 | 内融合 / 外融合 / 拉伸 / 3D / 发光 |
| 导出格式 | PNG/JPG/SVG/PDF | PNG/JPG/WEBP/SVG | 见下方「修复清单」 |
| 代码形态 | Packer `eval` 压缩 | TypeScript 源码 | 可上严格 CSP、可读可维护 |

### 修复清单

| # | 原问题 | 现状 |
|---|---|---|
| 1 | 默认二维码指向第三方示例域名 `Online-QRCode-Generator.com` | 默认指向站点自身 `https://ewm.ipwl.cn/`，可在 `src/main.ts` 的 `DEFAULT_CONTENT` 修改 |
| 2 | 界面显示纠错「高 H」，引擎实际用「L」 | 默认 **Q**，界面与实际一致；带 Logo 时建议 H |
| 3 | `index.html` 里设置默认二维码的两行代码完全失效 | 默认值在代码中唯一来源，界面与引擎同源 |
| 4 | 三个核心脚本被 Packer 压成 `eval`，无法启用 CSP | 全部改写为 TypeScript 源码，`public/_headers` 已配置严格 CSP |
| 5 | 手写 UTF-8 转换，emoji 代理对被拆成错误字节 | 改用 `TextEncoder`，中文与 emoji 均正确（已有解码验证） |
| 6 | 500ms 防抖函数 `execCanvas` 定义了却从未接线 | 真正接上 250ms 防抖 |
| 7 | SVG 导出丢失全部美化（渐变/码眼/Logo 全丢） | SVG 与 Canvas 预览完全一致 |
| 8 | SVG 导出拼接最多约 3 万个 `<rect>` 节点 | 合并为单条 `<path>`，文件体积大幅下降 |
| 9 | 导出 JPG 使用非法 MIME `"image/jpg"`，实为 PNG | 按格式使用 `image/png` / `image/jpeg` / `image/webp` |
| 10 | 180° 旋转因转置两次等于没转 | 用离屏画布按角度正确旋转 |
| 11 | WiFi 串结尾只有一个分号，不符合协议规范 | 输出标准 `WIFI:T:..;S:..;P:..;;`（双分号结尾） |
| 12 | 前端加载 705 KB，含 65 KB 未使用的 Snap.svg、48 KB 2013 年 polyfill、121 KB 重复 CSS | 产物 **43 KB**（JS 39 KB + CSS 4 KB），零外部运行时依赖 |
| 13 | 47 个内容完全相同的 `_1` 冗余副本、缺失的图片资源 | 无冗余资源 |
| 14 | 残留 `savevector.php`、`/api.php`、Google Analytics、百度分享等失效外链 | 全部移除 |
| 15 | 无分享能力 | 状态写入 URL 片段，刷新/分享可完整还原配置 |

### 产物对比

| | ewm | ewm-v2 |
|---|---|---|
| 首屏 JS | ~705 KB（含 143 个文件） | 39 KB |
| CSS | 121 KB（两套互相覆盖） | 4 KB |
| 运行时依赖 | jQuery + Bootstrap + Material + Waves + Snap.svg | 无（仅 `qrcode-generator`） |

---

## 部署

项目是纯静态站点，三种免费方案任选其一。

### 方案 A：Cloudflare Pages 连 GitHub（最简单，零 Token）

1. 推送到 GitHub 仓库
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git
3. 选择仓库，构建命令 `npm run build`，输出目录 `dist`
4. 完成。静态资源请求免费且不限流量

### 方案 B：Cloudflare Workers Static Assets + GitHub Actions（已配好工作流）

仓库内已含 `.github/workflows/deploy.yml`，只需在仓库 Settings → Secrets 中添加：

- `CLOUDFLARE_API_TOKEN`：Cloudflare API Token（需 Workers Scripts:Edit 权限）
- `CLOUDFLARE_ACCOUNT_ID`：账户 ID

推送 `main` 分支即自动构建并部署。`wrangler.jsonc` 已配置好 Static Assets 绑定。

### 方案 C：GitHub Pages

仓库内已含 `.github/workflows/pages.yml`。仓库 Settings → Pages → Source 选 "GitHub Actions" 即可。
注意：与方案 B 的工作流不要同时启用同名 job。

### 国内访问

Cloudflare 免费线路在国内连通性不稳定。若主要用户在国内，建议：
- 使用自有域名 + ICP 备案后指向国内 CDN / 对象存储，或
- 保留 GitHub Pages 作为备用入口

---

## 目录结构

```
ewm/
├── index.html                 页面结构（中文界面，7 个模板标签页）
├── DEPLOY.md                  部署文档（四套方案 + DNS + CSP + 排错）
├── src/
│   ├── main.ts                主控：状态、事件绑定、防抖、分享链接
│   ├── style.css              样式
│   ├── core/
│   │   ├── types.ts           类型定义
│   │   ├── utf8.ts            UTF-8 编码（修复中文/emoji）
│   │   ├── templates.ts       7 类内容模板（迁移自 legacy/js/basefn.js）
│   │   └── encoder.ts         编码内核适配层
│   └── render/
│       ├── renderer.ts        Canvas 渲染（渐变/码眼/圆角/水滴/Logo/文字特效）
│       ├── svg.ts             SVG 导出（与预览一致）
│       └── download.ts        导出下载（正确的 MIME）
├── scripts/
│   ├── selftest.mjs           单元自测
│   ├── verify-decode.mjs      端到端编解码验证
│   └── decode-screenshot.mjs  从页面截图解码，验证美化后仍可扫
├── public/_headers             Cloudflare 响应头与 CSP
├── wrangler.jsonc             Workers Static Assets 配置
├── .github/workflows/          CI / 自动部署
└── legacy/                     旧版代码归档（含原站点配置改动，可随时查阅回滚）
```

---

## 已知限制

1. **无 ECI 段**：底层 `qrcode-generator` 不支持在二维码中声明 ECI（字符集标识），
   中文与 emoji 按 UTF-8 字节编码但不附带 ECI 声明。经 jsQR 独立解码器验证，
   中英文与 emoji 均可正确读出；绝大多数主流扫码器同样采用 UTF-8 启发式识别。
   如需严格符合 ISO 18004，可将内核替换为
   [nayuki/QR-Code-generator](https://github.com/nayuki/QR-Code-generator)（MIT，支持 ECI，
   但未发布到 npm，需从源码引入）。

2. **纠错等级为 L 时不叠加 Logo**：沿用 ewm 的原逻辑（L 级仅 7% 容错，
   叠加 Logo 极易导致扫不出）。建议用 Q 或 H。

3. **美化会降低扫描鲁棒性**：圆角码点、深色 Logo、文字叠加都会占用纠错冗余。
   本项目已默认 Q 级；带 Logo 时建议切到 H。改动美化参数后建议用
   `npm run test` 与 `scripts/decode-screenshot.mjs` 复验。

4. **Logo 不参与分享链接**：图片是二进制，无法写入 URL 片段。分享链接会还原全部
   样式参数，但 Logo 需要重新选择。

---

## 致谢与许可

- 编码内核：[qrcode-generator](https://github.com/kozakdenys/qrcode-generator) v2（Kazuhiko Arase 原著，MIT）
- 渲染层能力迁移自 ewm 项目的 `js/canvas.js` 与 `js/basefn.js`
- 本项目：MIT
