"use client";

import { Component } from "react";

// Envuelve los carteles y avisos que no son esenciales.
//
// Sin esto, si uno de esos componentes falla —por ejemplo en modo incógnito,
// donde el navegador restringe el almacenamiento— la app entera muestra
// "Application error" y el cliente no puede comprar. Con esto, el cartel
// simplemente no aparece y la tienda sigue funcionando.
export default class LimiteDeError extends Component {
  constructor(props) {
    super(props);
    this.state = { falló: false };
  }

  static getDerivedStateFromError() {
    return { falló: true };
  }

  componentDidCatch(error) {
    // Lo dejamos en la consola para poder diagnosticarlo, pero no
    // interrumpimos la navegación del cliente.
    console.error("Componente secundario falló:", error);
  }

  render() {
    if (this.state.falló) return null;
    return this.props.children;
  }
}
