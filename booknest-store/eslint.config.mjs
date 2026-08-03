import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Next.js App Router: đọc localStorage / URL trong useEffect là pattern chuẩn
      // để tránh hydration mismatch (state khởi tạo lazy với window sẽ lệch server).
      // Luật React-Compiler này báo sai trên pattern hợp lệ này nên tắt.
      "react-hooks/set-state-in-effect": "off",
      // Countdown / timer dùng Date.now() trong khởi tạo state là pattern hợp lệ
      // (đồng hồ đếm ngược luôn re-render định kỳ), nên không coi là lỗi purity.
      "react-hooks/purity": "off",
    },
  },
]);

export default eslintConfig;
