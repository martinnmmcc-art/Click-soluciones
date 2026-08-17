"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminGuard from "@/components/AdminGuard";

function Redireccion() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/productos?tab=a-pedido");
  }, [router]);
  return <div className="text-center text-gray-400 py-16">Redirigiendo...</div>;
}

export default function APedidoAdminPage() {
  return (
    <AdminGuard>
      <Redireccion />
    </AdminGuard>
  );
}
