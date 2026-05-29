import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ビルド成果物は Go が embed する internal/server/dist へ出力する。
// 開発時は vite dev サーバ (5173) が /api を Go サーバ (8787) にプロキシする。
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../internal/server/dist",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
});
