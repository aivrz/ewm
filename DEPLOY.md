# 部署文档 · ewm 在线二维码生成器

> 适用版本：ewm v2.0.0（现代化重写版）
> 目标域名：`https://ewm.ipwl.cn/`
> 部署形态：**纯静态站点**，零后端、零数据库、零上传

---

## 目录

1. [部署前检查清单](#1-部署前检查清单)
2. [方案总览](#2-方案总览)
3. [方案 A：Cloudflare Pages 连 GitHub（推荐）](#3-方案-acloudflare-pages-连-github推荐)
4. [方案 B：Cloudflare Workers Static Assets + GitHub Actions](#4-方案-bcloudflare-workers-static-assets--github-actions)
5. [方案 C：GitHub Pages](#5-方案-cgithub-pages)
6. [方案 D：自建服务器（Nginx）](#6-方案-d自建服务器nginx)
7. [自定义域名与 DNS 配置](#7-自定义域名与-dns-配置)
8. [安全响应头与 CSP 详解](#8-安全响应头与-csp-详解)
9. [CI/CD 流程](#9-cicd-流程)
10. [国内访问优化](#10-国内访问优化)
11. [成本核算](#11-成本核算)
12. [故障排查](#12-故障排查)
13. [回滚与灰度](#13-回滚与灰度)
14. [日常维护](#14-日常维护)

---

## 1. 部署前检查清单

在开始之前逐项确认：

| # | 检查项 | 怎么确认 | 说明 |
|---|---|---|---|
| 1 | Node.js ≥ 20.6 | `node -v` | 低于 20.6 无法运行 `npm test` 的 TS 直跑 |
| 2 | 依赖安装成功 | `npm install` | 只拉取 `qrcode-generator` 一个运行时依赖 |
| 3 | 类型检查通过 | `npm run typecheck` | 零错误才能进 CI |
| 4 | 单元测试通过 | `npm test` | 14 项：UTF-8 编码 / 7 类模板 / 校验逻辑 |
| 5 | 编解码验证通过 | `npm run test:decode` | 15 项：**编码 → 位图 → jsQR 独立解码 → 比对原文** |
| 6 | 生产构建成功 | `npm run build` | 产物应约 45 KB（JS 40 KB + CSS 4 KB） |
| 7 | 本地预览正常 | `npm run preview` | 浏览器打开 http://localhost:4173/ ，二维码可见、可扫 |
| 8 | GitHub 仓库可访问 | `git remote -v` | 确认 `origin` 指向你的仓库 |
| 9 | 域名 DNS 可控 | Cloudflare / 域名注册商后台 | 需能修改 `ewm.ipwl.cn` 的 A / CNAME 记录 |

一条命令跑完 3–6：

```bash
npm run verify
```

---

## 2. 方案总览

| | 方案 A<br>Cloudflare Pages | 方案 B<br>Workers + Actions | 方案 C<br>GitHub Pages | 方案 D<br>自建 Nginx |
|---|---|---|---|---|
| **上手难度** | ⭐ 最低 | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| **需要 Token** | 否 | 是 | 否 | 否 |
| **自动部署** | Git push 即触发 | Git push 即触发 | Git push 即触发 | 需手动/CI |
| **静态流量** | 免费不限 | 免费不限 | 免费（软限制） | 取决于带宽 |
| **构建次数限制** | 500 次/月 | 3000 分钟/月 | Actions 2000 分钟/月 | 自定 |
| **国内访问** | 一般 | 一般 | 一般 | **最好** |
| **HTTPS 证书** | 自动 | 自动 | 自动 | 需 certbot |
| **适合** | **绝大多数场景** | 需要 Workers 扩展能力 | 已有 Pages 不方便时的备选 | 已有服务器 |

**推荐**：方案 A。若未来要加「服务端出图 API / 短链统计」，再升级到方案 B（同一套配置无缝衔接）。

---

## 3. 方案 A：Cloudflare Pages 连 GitHub（推荐）

### 3.1 推送代码

```bash
cd /path/to/ewm
git branch --show-current          # 确认在 feat/modern-v2 或已合并的 main
git add -A
git commit -m "feat: 现代化重构，Vite + TypeScript，部署到 Cloudflare Pages"
git push origin main                # 若在功能分支：git push origin feat/modern-v2
```

> `legacy/` 目录是旧版代码归档，保留了全部历史与你的站点配置改动。
> 确认新版线上运行正常后，可选择删除它以减小仓库体积（不影响部署产物）。

### 3.2 创建 Pages 项目

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 左侧导航 → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
3. 选择你的 `ewm` 仓库 → **Install Cloudflare Pages GitHub App**
   - 若仓库是私有的，需在授权页勾选该仓库
4. 选择分支：`main`（或你实际使用的分支）

### 3.3 构建配置

在 **Build settings** 中填写：

| 字段 | 值 |
|---|---|
| Framework preset | `None`（纯静态，Vite 不在自动识别列表） |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/`（仓库根目录；若放在子目录则填子目录名） |
| Node.js version | 通过环境变量 `NODE_VERSION` 设置为 `20` |

在 **Environment variables** 中添加：

| 名称 | 值 | 用途 |
|---|---|---|
| `NODE_VERSION` | `20` | 指定 Node 版本，避免默认版本过旧 |

### 3.4 首次部署

点击 **Save and Deploy**。Cloudflare 会自动执行：

```
npm install → npm run build → 部署 dist/
```

成功后你会得到一个 `https://<项目名>.pages.dev` 的地址。先用它验证功能。

### 3.5 验证清单

打开 Pages 地址，逐项确认：

- [ ] 页面加载，左侧画布显示二维码
- [ ] 状态栏显示 `版本 X · N×N 模块 · M 字符`
- [ ] 切换 7 个模板标签页，表单正常切换
- [ ] 打开「详细设置」，改渐变/码眼/码点样式，实时预览变化
- [ ] 上传 Logo，4 种叠加方式都正常
- [ ] 嵌入文字，5 种特效都正常
- [ ] 4 个下载按钮都能导出文件
- [ ] **用手机扫码**，能扫出内容
- [ ] 浏览器控制台无报错（F12 → Console）

### 3.6 绑定自定义域名

1. Pages 项目 → **Custom domains** → **Set up a custom domain**
2. 输入 `ewm.ipwl.cn`
3. Cloudflare 会自动添加 CNAME 记录（前提是 `ipwl.cn` 的 NS 已指向 Cloudflare）
4. 等待证书签发（通常 1–15 分钟）

若 `ipwl.cn` 的 NS 不在 Cloudflare，需手动加 CNAME 记录，详见[第 7 节](#7-自定义域名与-dns-配置)。

---

## 4. 方案 B：Cloudflare Workers Static Assets + GitHub Actions

相比方案 A，多了一层 Workers 封装，**静态资源同样免费且不限流量**，但可以在同一个 Worker 里挂 KV / D1 / R2，做服务端出图或短链统计。

仓库已内置 `.github/workflows/deploy.yml`，只需补两个 Secret。

### 4.1 获取 Account ID

Dashboard → 右侧栏 → **Account ID** → 点击复制。

### 4.2 创建 API Token

1. Dashboard → 右上角头像 → **My Profile** → **API Tokens** → **Create Token**
2. 选择 **Edit Cloudflare Workers** 模板，或用 **Create Custom Token**：
   - Permissions：`Account` / `Workers Scripts` / `Edit`
   - Account Resources：Include → 你的账户
   - Client IP Address Filtering：留空
3. 点 **Continue to summary** → **Create Token**
4. **立即复制 Token**（只显示一次）

### 4.3 配置 GitHub Secrets

仓库 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**，添加两个：

| Name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | 上一步复制的 Token |
| `CLOUDFLARE_ACCOUNT_ID` | 第 4.1 步复制的账户 ID |

### 4.4 触发部署

```bash
git push origin main
```

或直接在 Actions 页面点 **Run workflow** 手动触发。

`deploy.yml` 的流程是：

```
push 到 main
  ├─ build: checkout → setup-node → npm ci → typecheck → test → build → 上传 artifact
  └─ deploy: （仅 push 到 main 时）checkout → npm ci → build → wrangler deploy
```

`pull_request` 触发时只跑 build + 测试，**不会部署**——相当于用 PR 做预览验证。

### 4.5 本地调试 Worker

```bash
npm install -D wrangler
npx wrangler dev          # 本地模拟 Worker + 静态资源
npx wrangler deploy      # 手动发布
npx wrangler tail        # 实时日志
```

### 4.6 绑定自定义域名

Workers → 你的 Worker → **Settings** → **Domains & Routes** → **Add** → **Custom domain** → 输入 `ewm.ipwl.cn`。

### 4.7 后续扩展（可选）

要在同一个 Worker 里加服务端能力时，取消 `wrangler.jsonc` 中的注释并创建对应资源：

```bash
npx wrangler kv namespace create QR_STATS
npx wrangler d1 create ewm-db
npx wrangler r2 bucket create ewm-assets
```

然后把返回的 ID 填进 `wrangler.jsonc`。

> **CPU 限制提醒**：Workers 免费层每次请求 **10 ms CPU**。服务端出图请输出 **SVG**（而非 PNG 栅格化），并把结果缓存进 KV，否则容易超限。

---

## 5. 方案 C：GitHub Pages

仓库已内置 `.github/workflows/pages.yml`。

1. 仓库 → **Settings** → **Pages** → **Build and deployment** → Source 选 **GitHub Actions**
2. 推送触发部署

> ⚠️ `pages.yml` 与 `deploy.yml` 的 job 名不冲突（`deploy-pages` vs `deploy`），可同时存在。
> 但建议只启用其一，避免同一次 push 做两遍无意义的构建。

自定义域名：在 Pages 设置的 **Custom domain** 填 `ewm.ipwl.cn`，
然后在 DNS 处添加 CNAME 指向 `<用户名>.github.io`。

---

## 6. 方案 D：自建服务器（Nginx）

适合已有国内服务器、需要备案域名的场景。

### 6.1 构建

```bash
npm ci
npm run build
```

产物在 `dist/`。

### 6.2 Nginx 配置

```nginx
server {
    listen 80;
    server_name ewm.ipwl.cn;
    root /var/www/ewm/dist;
    index index.html;

    # SPA 回退（当前为单页，保留以备后用）
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 带哈希的构建产物长期缓存
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # HTML 不缓存，保证更新即时生效
    location = /index.html {
        add_header Cache-Control "public, max-age=0, must-revalidate";
    }

    # 安全响应头
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header X-Frame-Options "DENY" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" always;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;
}

server {
    listen 443 ssl http2;
    server_name ewm.ipwl.cn;
    # ...同上面的 root / location / add_header 配置...
    ssl_certificate     /etc/letsencrypt/live/ewm.ipwl.cn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ewm.ipwl.cn/privkey.pem;
}
```

### 6.3 证书

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d ewm.ipwl.cn
```

### 6.4 自动同步

用 rsync + 钩子，或在 CI 里加一步：

```bash
rsync -av --delete dist/ user@server:/var/www/ewm/dist/
```

---

## 7. 自定义域名与 DNS 配置

### 7.1 前置条件：NS 指向 Cloudflare

Cloudflare Pages / Workers 签发免费证书的前提是域名已托管在 Cloudflare。

若 `ipwl.cn` 当前不在 Cloudflare：
- 在 Cloudflare 添加站点，选择 Free 套餐
- 按提示把注册商处的 NS 改成 Cloudflare 给出的两个地址
- 等待生效（通常 30 分钟到 24 小时）

> ⚠️ **国内备案风险**：如果 `ipwl.cn` 已完成 ICP 备案，切换 NS 到 Cloudflare 可能触发备案信息变更，
> 请先确认管局要求，或保留国内服务器 + Cloudflare 双入口方案（见第 10 节）。

### 7.2 DNS 记录表

| 场景 | 类型 | 名称 | 目标 | TTL |
|---|---|---|---|---|
| Pages / Workers 自定义域名（Cloudflare 托管 NS） | CNAME | `ewm` | `<项目名>.pages.dev` | Auto |
| Workers 自定义域名 | CNAME | `ewm` | `<项目名>.workers.dev` | Auto |
| GitHub Pages | CNAME | `ewm` | `<用户名>.github.io` | Auto |
| Cloudflare 代理开启时 | CNAME | `ewm` | 上述目标 | **Proxied（橙云）** |

Cloudflare 托管 NS 时，通常在绑定自定义域名环节 Cloudflare 会**自动写入** CNAME，你无需手动添加。

### 7.3 多环境隔离

建议用子域名区分环境：

| 环境 | 域名 | 分支 | 部署方式 |
|---|---|---|---|
| 生产 | `ewm.ipwl.cn` | `main` | Pages 生产环境 |
| 预览 | `preview-ewm.ipwl.cn` | 每个 PR | Pages 预览部署（自动） |
| 备用 | `www.ipwl.cn/ewm/` | `main` | 原站点反代或 301 跳转 |

若想保留旧路径 `/ewm/`，在旧站点服务器加一条 301：

```nginx
location /ewm/ {
    return 301 https://ewm.ipwl.cn$request_uri;
}
```

---

## 8. 安全响应头与 CSP 详解

配置文件：`public/_headers`（构建时自动复制到 `dist/_headers`）。

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=(), interest-cohort=()
  Cross-Origin-Opener-Policy: same-origin
  X-Frame-Options: DENY

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/*.html
  Cache-Control: public, max-age=0, must-revalidate
```

### 各条目的作用

| 指令 | 作用 | 为什么需要 |
|---|---|---|
| `default-src 'self'` | 所有资源默认只允许同源 | 兜底，防止第三方资源注入 |
| `script-src 'self'` | 禁止内联脚本与 eval | **本项目最大收益**：旧版依赖 `eval(function(...))` 压缩代码，严格 CSP 下直接不可用，重写后彻底解决 |
| `style-src 'self'` | 禁止内联样式 | 本项目无动态内联样式，可保持严格 |
| `img-src 'self' data: blob:` | 允许 data:/blob: 图片 | Logo 用 `URL.createObjectURL` 生成 blob: URL，必须放行 |
| `object-src 'none'` | 禁止 `<object>`/`<embed>` | 防插件注入 |
| `base-uri 'none'` | 禁止 `<base>` 篡改相对路径 | 防路径劫持 |
| `frame-ancestors 'none'` | 禁止被 iframe 嵌套 | 防点击劫持 |

### 收紧与放宽

若将来要接入外部统计或 CDN：

```diff
- script-src 'self'; style-src 'self'
+ script-src 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'
```

> 注意：一旦引入需要内联样式的第三方库，`style-src` 需加 `'unsafe-inline'`。
> 这会略微降低防护强度，但不影响 `script-src` 的关键保护。

### 自检方法

部署后打开浏览器 F12 → Console，应无 CSP 报错。
也可以用：

```bash
curl -I https://ewm.ipwl.cn/ | grep -i content-security-policy
```

---

## 9. CI/CD 流程

仓库内置三个工作流：

| 文件 | 触发条件 | 作用 |
|---|---|---|
| `.github/workflows/deploy.yml` | push 到 `main` / PR / 手动 | 类型检查 → 测试 → 构建 → 部署 Cloudflare |
| `.github/workflows/pages.yml` | push 到 `main` / 手动 | 构建 → 部署 GitHub Pages |
| （可选）`ci.yml` | PR | 仅跑检查 |

### 建议：加一个纯 CI 工作流（不部署）

新建 `.github/workflows/ci.yml`：

```yaml
name: CI
on:
  pull_request:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run test:decode
      - run: npm run build
```

这样任何 PR 都会自动跑完整检查，且不会触发部署。

### 保护 main 分支

仓库 → **Settings** → **Branches** → **Add rule** → **Branch protection rule**：

- Branch name pattern：`main`
- Require status checks to pass：勾选 `check`
- Require pull request before merging：勾选

---

## 10. 国内访问优化

Cloudflare 免费线路在国内延迟较高且偶发丢包。若主要用户在国内：

### 方案 10.1 双入口（推荐）

保留两个入口，用户可自行选择，或做自动切换：

| 入口 | 承载 | 说明 |
|---|---|---|
| `ewm.ipwl.cn` | Cloudflare | 全球加速，海外与程序调用友好 |
| `www.ipwl.cn/ewm/` | 国内服务器 | 国内访问快，可保留旧路径避免 SEO 损失 |

在 `www.ipwl.cn` 的 Nginx 上做反代：

```nginx
location /ewm/ {
    proxy_pass https://<项目名>.pages.dev/;
    proxy_set_header Host <项目名>.pages.dev;
    proxy_ssl_server_name on;
    proxy_cache_valid 200 1h;
}
```

### 方案 10.2 完全国内化

把 `dist/` 同步到国内服务器（对象存储 COS/OSS 或 Nginx），配合已备案域名，放弃 Cloudflare 托管。
参见[第 6 节](#6-方案-d自建服务器nginx)。

### 方案 10.3 前端无感切换

在 `index.html` 的 `<head>` 里加一段探测脚本，检测 Cloudflare 访问是否超时，超时则切到国内入口。
注意：**脚本必须内联**，而当前 CSP 禁止内联脚本——需要给 `script-src` 加一个 nonce，
或把探测脚本单独拆成 `/assets/ping.js` 用 `script-src 'self'` 加载。推荐后者。

```js
// public/cdn-fallback.js（作为独立文件，保持 CSP 严格）
(function () {
  var deadline = performance.now() + 2500;
  function probe() {
    if (performance.now() > deadline) {
      location.replace('https://www.ipwl.cn/ewm/');
      return;
    }
    requestAnimationFrame(probe);
  }
  // 若首屏渲染耗时过长则跳国内
  setTimeout(function () {
    if (document.readyState === 'loading') location.replace('https://www.ipwl.cn/ewm/');
  }, 2500);
  probe();
})();
```

---

## 11. 成本核算

| 项目 | 免费额度 | 本项目预计用量 | 是否够用 |
|---|---|---|---|
| Cloudflare Pages 构建次数 | 500 次/月 | 约 10–30 次/月（每次 push 一次） | ✅ 绰绰有余 |
| Cloudflare 静态流量 | **不限** | 视访问量，无硬上限 | ✅ |
| Cloudflare Pages 带宽 | 不限 | — | ✅ |
| Workers 静态资源请求 | 不限（只有动态请求计数） | 0（纯静态） | ✅ |
| Workers 动态请求（若加 API） | 10 万次/天 | 视用量 | ✅ 一般够 |
| Workers CPU 时间 | 10 ms/请求 | 出图需输出 SVG 并缓存 | ⚠️ 需优化 |
| GitHub Actions（公共仓库） | 标准 runner 免费 | 每次构建约 30 秒 | ✅ |
| GitHub Actions（私有仓库） | 2000 分钟/月 | 同上 | ✅ |
| GitHub Pages | 100 GB/月带宽 + 10 次构建/小时 | — | ✅ |

**结论：全免费，零成本。**

---

## 12. 故障排查

| 现象 | 可能原因 | 排查步骤 |
|---|---|---|
| 部署失败：`npm ci` 报 lock 文件不匹配 | `package-lock.json` 与 `package.json` 不同步 | 本地跑 `npm install` 后重新提交 lock 文件 |
| 部署失败：Node 版本过低 | Pages 默认 Node 18 | 加环境变量 `NODE_VERSION=20` |
| 页面白屏，控制台报 CSP | 响应头未生效 / 资源被拦截 | `curl -I https://ewm.ipwl.cn/` 看 CSP 头；检查是否用了 `eval` |
| 页面白屏，无任何报错 | JS 模块加载失败 | F12 → Network，看是否有 404 的 `.js` |
| 二维码不显示 | 内容为空或编码异常 | 看状态栏报错；F12 Console 有无异常 |
| 二维码中文乱码 / 扫不出 | UTF-8 编码被覆盖 | 确认 `src/core/encoder.ts` 仍在覆盖 `qrcode.stringToBytes` |
| 下载的 JPG 打不开 | MIME 不正确 | 确认走的是 `image/jpeg` 而非 `image/jpg` |
| SVG 导出没有渐变 | SVG 生成逻辑异常 | 对比 `src/render/svg.ts` 与 Canvas 渲染的 `createGradient` |
| 自定义域名 502 | DNS 未生效 / 代理未开 | 检查 DNS 记录是否 Proxied；`nslookup ewm.ipwl.cn` |
| 自定义域名证书报错 | NS 未托管在 Cloudflare | 确认域名 NS 已指向 Cloudflare |
| 手机能扫但内容乱 | 扫码器未启用 UTF-8 启发式 | 提高纠错等级到 H；见 README「已知限制」 |
| 修改代码后线上没变 | HTML 被缓存 | `/*.html` 已设 `max-age=0`，检查 CDN 是否有额外缓存层 |

### 快速诊断命令

```bash
# 检查响应头
curl -I https://ewm.ipwl.cn/

# 检查页面引用的资源是否都可达
curl -s https://ewm.ipwl.cn/ | grep -oE '(src|href)="[^"]*"'

# 检查 DNS
nslookup ewm.ipwl.cn
dig +short ewm.ipwl.cn

# 检查证书
echo | openssl s_client -connect ewm.ipwl.cn:443 -servername ewm.ipwl.cn 2>/dev/null | openssl x509 -noout -dates
```

---

## 13. 回滚与灰度

### 13.1 回滚代码

```bash
git log --oneline -10
git revert <commit-hash>      # 产生新提交，历史安全
git push origin main          # 触发自动重新部署
```

或用 Cloudflare Pages 的 **Rollback to this deployment**（保留最近若干次部署，一键回滚，秒级生效）。

### 13.2 灰度发布

Cloudflare Pages 天然支持分支预览：

1. 从 `main` 切出功能分支 `feature/xxx`
2. push 后 Cloudflare 自动生成 `https://<hash>.feature-xxx.pages.dev` 预览地址
3. 验证无误后合并 PR 到 `main`

### 13.3 数据安全

本项目**无任何后端与用户数据**，二维码内容只存在浏览器内存与 URL 片段中，
因此回滚不存在数据丢失风险。唯一需要注意的是 URL 分享链接的格式：
若后续修改了 `RenderOptions` 的字段结构，旧分享链接会被忽略（解析失败时回退默认值），
不会导致页面崩溃。

---

## 14. 日常维护

### 更新依赖

```bash
npm outdated          # 查看可升级项
npm update            # 升级
npm run verify        # 全量校验
```

### 升级编码内核

```bash
npm install qrcode-generator@latest
npm run test:decode   # 必跑：验证中文/emoji 仍正确
```

> ⚠️ 升级后务必跑 `npm run test:decode`。若上游改动导致 `stringToBytes` 行为变化，
> 中文与 emoji 会静默损坏 —— 这个测试就是专门用来拦这个的。

### 修改默认内容

`src/main.ts`：

```ts
const DEFAULT_CONTENT = 'https://ewm.ipwl.cn/';
```

### 修改站点标题与 SEO

`index.html` 的 `<title>`、`<meta name="description">`、Open Graph 标签。

### 修改默认样式

`src/main.ts` 的 `state.opts` 初始值。

### 定期检查

- Cloudflare Pages 构建次数是否接近 500/月
- 域名证书是否正常续期（Cloudflare 自动，Nginx 需 certbot renew）
- `npm audit` 是否有新漏洞

---

## 附录 A：项目结构

```
ewm/
├── index.html                 页面结构（中文界面，7 个模板标签页）
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
└── legacy/                     旧版代码归档（保留全部历史，可随时查阅）
```

## 附录 B：常用命令速查

| 命令 | 作用 |
|---|---|
| `npm run dev` | 本地开发服务器 |
| `npm run build` | 生产构建到 `dist/` |
| `npm run preview` | 本地预览生产构建 |
| `npm run typecheck` | TypeScript 严格类型检查 |
| `npm test` | 单元自测（14 项） |
| `npm run test:decode` | 端到端编解码验证（15 项） |
| `npm run verify` | 检查 + 测试 + 构建 全跑一遍 |
| `node scripts/decode-screenshot.mjs shot.png "内容"` | 校验某张截图里的二维码能否扫出 |
