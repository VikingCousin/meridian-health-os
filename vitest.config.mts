import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      DATABASE_URL: "file:./data/test.db",
    },
    // Tests share one SQLite file and mutate real tables — keep them
    // sequential so they can't race each other.
    fileParallelism: false,
    globalSetup: ["./tests/global-setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
});
