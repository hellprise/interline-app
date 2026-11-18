import { loadEnv } from "vite";
import { defineProject } from "vitest/config";

export default defineProject(({ mode }) => ({
  test: { env: loadEnv(mode, import.meta.dirname, "") },
}));
