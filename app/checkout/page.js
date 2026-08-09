"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { formatPrice } from "@/lib/whatsapp";

function generarNumeroPedido() {
  const fecha = new Date();
  const yy = String(fecha.getFullYear()).slice(-2);
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  const dd = String(fecha.getDate()).padStart(2, "0");
  const random = Math.floor(1000 + Math.random() * 9000);
  return `CS-${yy}${mm}${dd}-${random}`;
}

export default function CheckoutPage() {
  const { items, total, nota, clearCart } = useCart();
  const { user } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({
    nombre_cliente: user?.nombre || "",
    telefono_cliente: user?.telefono || "",
    localidad: user?.localidad || "",
    metodo_entrega: "retiro",
    direccion_envio: "",
    metodo_pago: "transferencia"
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleConfirmar(e) {
    e.preventDefault();
    setError("");

    if (!form.nombre_cliente.trim() || !form.telefono_cliente.trim()) {
      setError("Completá tu nombre y celular para poder contactarte.");
      return;
    }
    if (form.metodo_entrega === "envio" && !form.direccion_envio.trim()) {
      setError("Ingresá la dirección para el envío.");
      return;
    }
    if (items.length === 0) {
      setError("Tu carrito está vacío.");
      return;
    }

    setEnviando(true);
    try {
      const numero_pedido = generarNumeroPedido();

      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedido: {
            numero_pedido,
            usuario_id: user?.id || null,
            nombre_cliente: form.nombre_cliente,
            telefono_cliente: form.telefono_cliente,
            localidad: form.localidad,
            metodo_entrega: form.metodo_entrega,
            direccion_envio:
              form.metodo_entrega === "envio" ? form.direccion_envio : null,
            metodo_pago: form.metodo_pago,
            nota_cliente: nota || null,
            total,
            estado: "pendiente"
          },
          items: items.map((i) => ({
            producto_id: i.id,
            nombre_producto: i.nombre,
            precio_unitario: i.precio,
            cantidad: i.cantidad,
            subtotal: i.precio * i.cantidad
          }))
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Error al crear el pedido");

      clearCart();
      router.push(`/confirmacion?numero=${numero_pedido}`);
    } catch (err) {
      console.error("Error completo:", err);
      setError(`Error: ${err.message || JSON.stringify(err)}`);
    } finally {
      setEnviando(false);
    }
  }

  if (items.length === 0) {
    return (
      <main className="pb-6">
        <Header showSearch={false} />
        <div className="px-4 mt-6">
          <div className="card p-8 text-center text-gray-500">
            Tu carrito está vacío. Agregá productos antes de continuar.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="pb-6">
      <Header showSearch={false} />
      <div className="px-4 mt-4">
        <h1 className="font-bold text-xl text-gray-800 mb-4">Checkout</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3 mb-4 break-words">
            {error}
          </div>
        )}

        <form onSubmit={handleConfirmar} className="flex flex-col gap-5">
          <div className="card p-4">
            <h2 className="font-semibold text-gray-800 mb-3">Tus datos</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Nombre y apellido
                </label>
                <input
                  name="nombre_cliente"
                  value={form.nombre_cliente}
                  onChange={handleChange}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Celular
                </label>
                <input
                  name="telefono_cliente"
                  value={form.telefono_cliente}
                  onChange={handleChange}
                  className="input-field"
                  inputMode="tel"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Localidad
                </label>
                <input
                  name="localidad"
                  value={form.localidad}
                  onChange={handleChange}
                  className="input-field"
                />
              </div>
            </div>
          </div>

          <div className="card p-4">
            <h2 className="font-semibold text-gray-800 mb-3">Entrega</h2>
            <div className="flex flex-col gap-2">
              <label
                className={`flex items-center gap-3 border rounded-xl p-3 cursor-pointer ${
                  form.metodo_entrega === "retiro"
                    ? "border-brand-blue bg-blue-50"
                    : "border-gray-200"
                }`}
              >
                <input
                  type="radio"
                  name="metodo_entrega"
                  value="retiro"
                  checked={form.metodo_entrega === "retiro"}
                  onChange={handleChange}
                />
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    Retiro en showroom
                  </p>
                  <p className="text-xs text-gray-500">
                    Sin costo adicional. Te avisamos cuando esté listo.
                  </p>
                </div>
              </label>
              <label
                className={`flex items-center gap-3 border rounded-xl p-3 cursor-pointer ${
                  form.metodo_entrega === "envio"
                    ? "border-brand-blue bg-blue-50"
                    : "border-gray-200"
                }`}
              >
                <input
                  type="radio"
                  name="metodo_entrega"
                  value="envio"
                  checked={form.metodo_entrega === "envio"}
                  onChange={handleChange}
                />
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    Envío a domicilio
                  </p>
                  <p className="text-xs text-gray-500">
                    Coordinamos el costo de envío por WhatsApp.
                  </p>
                </div>
              </label>
            </div>

            {form.metodo_entrega === "envio" && (
              <div className="mt-3">
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Dirección de envío
                </label>
                <input
                  name="direccion_envio"
                  value={form.direccion_envio}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="Calle, número, barrio"
                />
                <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl p-2.5 mt-2">
                  🚚 Enviamos a El Bolsón y la Comarca Andina. Fuera del casco urbano puede tener recargo — coordinamos transporte local o punto de encuentro por WhatsApp.
                </p>
              </div>
            )}
          </div>

          <div className="card p-4">
            <h2 className="font-semibold text-gray-800 mb-3">Pago</h2>
            <div className="flex flex-col gap-2">
              <label
                className={`flex items-center gap-3 border rounded-xl p-3 cursor-pointer ${
                  form.metodo_pago === "transferencia"
                    ? "border-brand-blue bg-blue-50"
                    : "border-gray-200"
                }`}
              >
                <input
                  type="radio"
                  name="metodo_pago"
                  value="transferencia"
                  checked={form.metodo_pago === "transferencia"}
                  onChange={handleChange}
                />
                <span className="text-sm font-semibold text-gray-800">
                  Transferencia bancaria
                </span>
              </label>
              <label
                className={`flex items-center gap-3 border rounded-xl p-3 cursor-pointer ${
                  form.metodo_pago === "efectivo"
                    ? "border-brand-blue bg-blue-50"
                    : "border-gray-200"
                }`}
              >
                <input
                  type="radio"
                  name="metodo_pago"
                  value="efectivo"
                  checked={form.metodo_pago === "efectivo"}
                  onChange={handleChange}
                />
                <span className="text-sm font-semibold text-gray-800">
                  Efectivo al retirar
                </span>
              </label>
            </div>
          </div>

          <div className="card p-4 flex items-center justify-between">
            <span className="font-semibold text-gray-700">Total</span>
            <span className="text-xl font-extrabold text-brand-blueDark">
              ${formatPrice(total)}
            </span>
          </div>

          <button disabled={enviando} className="btn-primary">
            {enviando ? "Confirmando pedido..." : "Confirmar pedido"}
          </button>
        </form>
      </div>
    </main>
  );
}
