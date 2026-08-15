"use client";

import { useEffect } from "react";
import { useAdmin } from "@/context/AdminContext";

export default function ProtegerContenido() {
  const { isAdmin } = useAdmin();

  useEffect(() => {
    if (isAdmin) {
      document.body.classList.remove("no-copiar");
      return;
    }

    document.body.classList.add("no-copiar");

    function bloquearMenu(e) {
      e.preventDefault();
    }
    function bloquearCopia(e) {
      e.preventDefault();
    }

    document.addEventListener("contextmenu", bloquearMenu);
    document.addEventListener("copy", bloquearCopia);
    document.addEventListener("cut", bloquearCopia);

    return () => {
      document.removeEventListener("contextmenu", bloquearMenu);
      document.removeEventListener("copy", bloquearCopia);
      document.removeEventListener("cut", bloquearCopia);
      document.body.classList.remove("no-copiar");
    };
  }, [isAdmin]);

  return null;
}
