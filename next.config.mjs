/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Comprovantes chegam como anexo em Server Action; 6 MB cobre o limite de
  // 5 MB por arquivo com folga para o restante do formulário.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default nextConfig;
