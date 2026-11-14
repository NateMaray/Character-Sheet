/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Project Pages site: https://natemaray.github.io/Character-Sheet/
export default defineConfig({
  base: "/Character-Sheet/",
  plugins: [react()],
  server: { host: "0.0.0.0", port: 5173 },
  preview: { host: "0.0.0.0", port: 4173 },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
