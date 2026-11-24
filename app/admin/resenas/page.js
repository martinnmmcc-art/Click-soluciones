import { redirect } from "next/navigation";

// Las opiniones de productos ahora están en Panel → Opiniones (pestaña Productos)
export default function ResenasPage() {
  redirect("/admin/opiniones?ver=productos");
}
