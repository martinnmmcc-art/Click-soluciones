import "./globals.css";
import SesionEnPedidos from "@/components/SesionEnPedidos";
import { SCRIPT_TEMA_INICIAL } from "@/lib/tema";
import AuthGuard from "@/components/AuthGuard";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import { AdminProvider } from "@/context/AdminContext";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import AvisoSinConexion from "@/components/AvisoSinConexion";
import PrecargaAutomatica from "@/components/PrecargaAutomatica";
import InstalarApp from "@/components/InstalarApp";
import MuroRegistro from "@/components/MuroRegistro";
import LimiteDeError from "@/components/LimiteDeError";
import AvisoDeuda from "@/components/AvisoDeuda";
import BotonOpinar from "@/components/BotonOpinar";
import AvisoCupon from "@/components/AvisoCupon";
import MensajesCliente from "@/components/MensajesCliente";
import RegistrarOrigen from "@/components/RegistrarOrigen";
import IrACaja from "@/components/IrACaja";
import WhatsAppFloatingButton from "@/components/WhatsAppFloatingButton";
import BottomNav from "@/components/BottomNav";
import ProtegerContenido from "@/components/ProtegerContenido";
import BannerCookies from "@/components/BannerCookies";
import PieLegal from "@/components/PieLegal";
import CargarBaseLocal from "@/components/CargarBaseLocal";
import { DatosTienda } from "@/components/DatosEstructurados";

export const metadata = {
  metadataBase: new URL("https://www.bolsonclick.com.ar"),
  title: "Bolson Click | Productos para el hogar en El Bolsón y la Comarca Andina",
  description:
    "Tienda online de El Bolsón: cocina, iluminación, belleza, herramientas y tecnología con precio y stock real. Entrega en la Comarca Andina y envíos a Bariloche, Villa La Angostura, San Martín de los Andes y todo el país.",
  openGraph: {
    siteName: "Bolson Click",
    locale: "es_AR",
    type: "website"
  },
  // Código de verificación de Google Search Console (variable de entorno en
  // Vercel: NEXT_PUBLIC_GOOGLE_VERIFICACION). Si no está, no se agrega nada.
  ...(process.env.NEXT_PUBLIC_GOOGLE_VERIFICACION
    ? { verification: { google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICACION } }
    : {}),
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
  // Sin "maximumScale": quien ve poco tiene que poder agrandar con dos dedos
  themeColor: "#1560D4"
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Antes de dibujar: si eligió modo oscuro, se aplica ya, sin destello blanco */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA_INICIAL }} />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="icon" href="/icons/icon-192.png" />
        {/* Para Google: quién es la tienda, dónde está y a qué zonas llega */}
        <DatosTienda />
      </head>
      <body className="bg-brand-bg min-h-screen font-sans">
        {/* Para navegar con teclado: el primer Tab salta directo al contenido */}
        <CargarBaseLocal />
        <a href="#contenido-principal" className="saltar-al-contenido">
          Saltar al contenido
        </a>
        <SesionEnPedidos />
        <AdminProvider>
          <AuthProvider>
            <CartProvider>
              <AuthGuard>
                <ProtegerContenido />
                <ServiceWorkerRegister />
                <LimiteDeError>
                  <AvisoSinConexion />
                </LimiteDeError>
                <LimiteDeError>
                  <PrecargaAutomatica />
                </LimiteDeError>
                <LimiteDeError>
                  <InstalarApp />
                </LimiteDeError>
                <LimiteDeError>
                  <MuroRegistro />
                </LimiteDeError>
                <LimiteDeError>
                  <AvisoDeuda />
                </LimiteDeError>
                <LimiteDeError>
                  <AvisoCupon />
                </LimiteDeError>
                <LimiteDeError>
                  <MensajesCliente />
                </LimiteDeError>
                <LimiteDeError>
                  <RegistrarOrigen />
                </LimiteDeError>
                <LimiteDeError>
                  <IrACaja />
                </LimiteDeError>
                <div id="contenido-principal" tabIndex={-1} className="container-app pb-24 outline-none">
                  {children}
                  <PieLegal />
                </div>
                <LimiteDeError>
                  <BannerCookies />
                </LimiteDeError>
                <LimiteDeError>
                  <WhatsAppFloatingButton />
                </LimiteDeError>
                <LimiteDeError>
                  <BotonOpinar />
                </LimiteDeError>
                <BottomNav />
              </AuthGuard>
            </CartProvider>
          </AuthProvider>
        </AdminProvider>
      </body>
    </html>
  );
}
