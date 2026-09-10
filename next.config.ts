import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Compras e Inventario se unificaron en un solo lugar. Los enlaces viejos
   * (favoritos del navegador, la app en el celular) siguen funcionando.
   */
  async redirects() {
    return [
      { source: "/app/compras", destination: "/app/inventario/entradas", permanent: false },
      { source: "/app/compras/nueva", destination: "/app/inventario/entradas/nueva", permanent: false },
      { source: "/app/compras/cuentas", destination: "/app/inventario/cuentas", permanent: false },
      { source: "/app/compras/proveedores", destination: "/app/inventario/proveedores", permanent: false },
      { source: "/app/compras/:id", destination: "/app/inventario/entradas/:id", permanent: false },
    ];
  },
};

export default nextConfig;
