import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/*"], // isolation of tests for each package
  },
});
