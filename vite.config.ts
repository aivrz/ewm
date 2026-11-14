import { defineConfig } from 'vite';

export default defineConfig({
  // 使用相对路径，兼容 Cloudflare Workers Static Assets / Pages 与 GitHub Pages 子路径
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsDir: 'assets',
    cssCodeSplit: false,
    sourcemap: false,
    reportCompressedSize: false,
  },
  server: {
    port: 5173,
    open: false,
  },
});
