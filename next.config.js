const path = require("path");
const webpack = require("webpack");

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  // Mark LangChain and Adobe packages as external for server-side to avoid bundling issues
  serverExternalPackages: [
    "langchain",
    "@langchain/core",
    "@langchain/classic",
    "@langchain/cohere",
    "@langchain/google-genai",
    "@langchain/textsplitters",
    "@langchain/community",
    "@adobe/pdfservices-node-sdk",
    "log4js",
    "adm-zip",
  ],
  webpack: (config, { isServer }) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    config.resolve.alias.canvas = path.resolve(__dirname, "stubs/canvas.js");

    // Handle node: protocol imports for LangChain
    // Replace node: protocol imports with regular module imports
    config.plugins = config.plugins || [];
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
        if (resource.request && resource.request.startsWith("node:")) {
          resource.request = resource.request.replace(/^node:/, "");
        }
      })
    );

    // For server-side builds, ensure Node.js modules are available
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        // Map node: protocol to regular module names as fallback
        "node:module": "module",
        "node:fs": "fs",
        "node:path": "path",
        "node:url": "url",
        "node:util": "util",
        "node:stream": "stream",
        "node:buffer": "buffer",
        "node:crypto": "crypto",
        "node:os": "os",
        "node:events": "events",
      };

      // Suppress log4js dynamic require warning
      config.module = config.module || {};
      config.module.exprContextCritical = false;
      config.module.unknownContextCritical = false;
    }

    // For client-side builds, ignore Node.js modules
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        buffer: false,
        util: false,
        url: false,
        os: false,
        events: false,
        module: false,
      };
    }

    return config;
  },
};

module.exports = nextConfig;
