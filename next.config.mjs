/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/html/index.html",
        permanent: false,
      },
      {
        source: "/dashboard/client",
        destination: "/html/client-dashboard.html",
        permanent: false,
      },
      {
        source: "/dashboard/worker",
        destination: "/html/worker-dashboard.html",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
