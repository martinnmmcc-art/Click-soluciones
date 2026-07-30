import { AdminProvider } from "@/context/AdminContext";

export const metadata = {
  title: "Admin | Clic Soluciones"
};

export default function AdminLayout({ children }) {
  return <AdminProvider>{children}</AdminProvider>;
}
