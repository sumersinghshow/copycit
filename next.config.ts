import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'remark-docx',
    '@mathjax/src',
    'mathjax-full',
    'shiki',
    '@shikijs/core',
  ],
};

export default nextConfig;
