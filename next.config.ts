import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Align with ATTENDANCE_UPLOAD_MAX_FILE_SIZE (5MB) in attendance import validation
      bodySizeLimit: "5mb",
    },
  },
  // Keep Prisma/pg out of the server bundle so native query engines resolve at runtime.
  serverExternalPackages: ["@prisma/client", "prisma", "pg", "@prisma/adapter-pg"],
  // Custom Prisma output is gitignored; file tracing must explicitly ship engines to /var/task.
  outputFileTracingIncludes: {
    "/**/*": ["./src/generated/prisma/**/*"],
  },
  webpack(config) {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    config.module.rules.push({
      test: /\.wasm$/,
      type: "webassembly/async",
    });
    return config;
  },
};

export default nextConfig;
