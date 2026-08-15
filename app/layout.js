import "./globals.css";
import AuthGuard from "@/components/AuthGuard";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import { AdminProvider } from "@/context/AdminContext";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import WhatsAppFloatingButton from "@/components/WhatsAppFloatingButton";
import BottomNav from "@/components/BottomNav";
import ProtegerContenido from "@/components/ProtegerContenido";

export const metadata = {
  title: "Bolson Click | Productos para el hogar",
  description:
    "Iluminación, cocina y organización para tu hogar. Comprá fácil y rápido en Bolson Click.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bolson Click"
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#1560D4"
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="icon" href="/icons/icon-192.png" />
      </head>
      <body className="bg-brand-bg min-h-screen font-sans">
        <AdminProvider>
          <AuthProvider>
            <CartProvider>
              <AuthGuard>
                <ProtegerContenido />
                <ServiceWorkerRegister />
                <div className="container-app pb-24">{children}</div>
                <WhatsAppFloatingButton />
                <BottomNav />
              </AuthGuard>
            </CartProvider>
          </AuthProvider>
        </AdminProvider>
      </body>
    </html>
  );
}
