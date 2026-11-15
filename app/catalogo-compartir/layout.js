// El catálogo que se comparte por WhatsApp es una copia del catálogo: fuera
// de Google, para que no compita con el catálogo de verdad.
export const metadata = {
  robots: { index: false, follow: true }
};

export default function Layout({ children }) {
  return children;
}
