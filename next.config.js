/** @type {import('next').NextConfig} */

// Cabeceras de seguridad que el navegador aplica en cada visita.
// Protegen contra ataques comunes sin afectar el funcionamiento de la tienda.
const securityHeaders = [
  {
    // Fuerza HTTPS por 2 años: si alguien entra por http://, el navegador
    // cambia solo a https:// antes de enviar nada.
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload"
  },
  {
    // Impide que otro sitio meta tu tienda dentro de un iframe para engañar
    // a los clientes (clickjacking).
    key: "X-Frame-Options",
    value: "SAMEORIGIN"
  },
  {
    // Evita que el navegador "adivine" el tipo de archivo, lo que se usa
    // para hacer pasar un script malicioso por una imagen.
    key: "X-Content-Type-Options",
    value: "nosniff"
  },
  {
    // No filtra la URL completa de tu sitio a terceros.
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin"
  },
  {
    // La app no necesita micrófono, cámara ni ubicación: los bloqueamos.
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  },
  {
    // Evita que el navegador cargue recursos por http:// dentro de una página https://
    key: "Content-Security-Policy",
    value: "upgrade-insecure-requests"
  }
];

const nextConfig = {
  reactStrictMode: true,

  // No revelamos qué tecnología corre por detrás
  poweredByHeader: false,

  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }]
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders
      }
    ];
  }
};

module.exports = nextConfig;
