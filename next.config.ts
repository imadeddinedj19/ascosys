import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer doit rester en dépendance externe (rendu côté serveur).
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
