/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Native module — must not be bundled by webpack/turbopack.
  serverExternalPackages: ['better-sqlite3'],
  eslint: {
    dirs: ['src'],
  },
};

export default nextConfig;
