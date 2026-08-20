// Validación de celulares argentinos.
// No verifica que la persona sea dueña del número (para eso hace falta
// mandarle un código), pero sí que el número PUEDA existir: código de área
// real, cantidad correcta de dígitos, y que no sea algo inventado
// como 1111111111 o 1234567890.

// Códigos de área de Argentina. Los de 2 dígitos (11) tienen 8 dígitos de
// abonado, los de 3 tienen 7, y los de 4 tienen 6. Siempre 10 en total.
const AREAS_2 = ["11"];

const AREAS_3 = [
  "220", "221", "223", "230", "236", "237", "249", "260", "261", "263", "264",
  "266", "280", "291", "297", "299",
  "341", "342", "343", "345", "348", "351", "353", "358", "362", "364", "370",
  "376", "379", "380", "381", "383", "385", "387", "388"
];

const AREAS_4 = [
  "2202", "2223", "2224", "2225", "2226", "2227", "2229", "2241", "2242",
  "2243", "2244", "2245", "2246", "2252", "2254", "2255", "2257", "2261",
  "2262", "2264", "2265", "2266", "2267", "2268", "2271", "2272", "2273",
  "2274", "2281", "2283", "2284", "2285", "2286", "2291", "2292", "2296",
  "2297", "2302", "2314", "2316", "2317", "2320", "2323", "2324", "2325",
  "2326", "2331", "2333", "2334", "2335", "2336", "2337", "2338", "2342",
  "2343", "2344", "2345", "2346", "2352", "2353", "2354", "2355", "2356",
  "2357", "2358", "2362", "2363", "2364", "2365", "2392", "2393", "2394",
  "2395", "2396", "2473", "2474", "2475", "2477", "2478", "2481", "2482",
  "2483", "2484", "2485", "2488", "2491", "2492", "2493", "2494", "2495",
  "2496", "2622", "2624", "2625", "2626", "2646", "2647", "2648", "2651",
  "2652", "2655", "2656", "2657", "2658", "2901", "2902", "2903", "2920",
  "2921", "2922", "2923", "2924", "2925", "2926", "2927", "2928", "2929",
  "2931", "2932", "2933", "2934", "2935", "2936", "2940", "2942", "2944",
  "2945", "2946", "2948", "2952", "2953", "2954", "2962", "2963", "2964",
  "2966", "2972", "2982", "2983", "3327", "3329", "3382", "3385", "3387",
  "3388", "3400", "3401", "3402", "3404", "3405", "3406", "3407", "3408",
  "3409", "3435", "3436", "3437", "3438", "3442", "3444", "3445", "3446",
  "3447", "3448", "3454", "3455", "3456", "3458", "3460", "3462", "3463",
  "3464", "3465", "3466", "3467", "3468", "3469", "3471", "3472", "3476",
  "3482", "3483", "3487", "3489", "3491", "3492", "3493", "3496", "3497",
  "3498", "3521", "3522", "3524", "3525", "3532", "3533", "3537", "3541",
  "3542", "3543", "3544", "3546", "3547", "3548", "3549", "3562", "3563",
  "3564", "3571", "3572", "3573", "3574", "3575", "3576", "3582", "3583",
  "3584", "3585", "3711", "3715", "3716", "3718", "3721", "3725", "3731",
  "3734", "3735", "3741", "3743", "3751", "3754", "3755", "3756", "3757",
  "3758", "3772", "3773", "3774", "3775", "3777", "3781", "3782", "3786",
  "3821", "3825", "3826", "3827", "3832", "3835", "3837", "3838", "3841",
  "3843", "3844", "3845", "3846", "3854", "3855", "3856", "3857", "3858",
  "3861", "3862", "3863", "3865", "3867", "3868", "3869", "3873", "3876",
  "3877", "3878", "3885", "3886", "3887", "3888", "3891", "3892", "3894"
];

// Deja el número en formato interno: 10 dígitos, sin +54, sin 9, sin 0, sin 15.
export function normalizarTelefono(tel) {
  let n = (tel || "").replace(/\D/g, "");

  if (n.startsWith("54")) n = n.slice(2);
  if (n.startsWith("9") && n.length > 10) n = n.slice(1);
  if (n.startsWith("0")) n = n.slice(1);

  // Algunos escriben el 15 después del código de área (formato viejo)
  if (n.length === 12) {
    for (const area of AREAS_4) {
      if (n.startsWith(area) && n.slice(4, 6) === "15") {
        n = area + n.slice(6);
        break;
      }
    }
  }
  if (n.length === 11) {
    for (const area of AREAS_3) {
      if (n.startsWith(area) && n.slice(3, 5) === "15") {
        n = area + n.slice(5);
        break;
      }
    }
  }

  return n;
}

// Detecta números inventados: todos iguales, secuencias, o repeticiones simples.
function pareceInventado(n) {
  if (/^(\d)\1+$/.test(n)) return true; // 1111111111
  if (n === "1234567890" || n === "0987654321") return true;
  if (/^(\d{2})\1{4}$/.test(n)) return true; // 1212121212
  if (/^(\d)\1{5,}/.test(n)) return true; // 6 o más iguales seguidos
  return false;
}

// Devuelve { valido, motivo, telefono } con el número ya normalizado.
export function validarTelefonoArgentino(tel) {
  const n = normalizarTelefono(tel);

  if (!n) {
    return { valido: false, motivo: "Ingresá tu número de celular.", telefono: "" };
  }
  if (n.length !== 10) {
    return {
      valido: false,
      motivo:
        n.length < 10
          ? "Faltan números. Poné el código de área sin el 0 y el número sin el 15 (ej: 2944123456)."
          : "Sobran números. Poné solo el código de área sin el 0 y el número sin el 15 (ej: 2944123456).",
      telefono: n
    };
  }
  if (pareceInventado(n)) {
    return { valido: false, motivo: "Ese número no parece real. Revisalo por favor.", telefono: n };
  }

  const area4 = n.slice(0, 4);
  const area3 = n.slice(0, 3);
  const area2 = n.slice(0, 2);

  const areaValida =
    AREAS_4.includes(area4) || AREAS_3.includes(area3) || AREAS_2.includes(area2);

  if (!areaValida) {
    return {
      valido: false,
      motivo: `El código de área "${area3}" no existe en Argentina. Revisá el número.`,
      telefono: n
    };
  }

  return { valido: true, motivo: "", telefono: n };
}

// Para mostrar bonito: 2944 63-6224
export function formatearTelefono(tel) {
  const n = normalizarTelefono(tel);
  if (n.length !== 10) return tel;

  if (AREAS_4.includes(n.slice(0, 4))) return `${n.slice(0, 4)} ${n.slice(4, 6)}-${n.slice(6)}`;
  if (AREAS_3.includes(n.slice(0, 3))) return `${n.slice(0, 3)} ${n.slice(3, 6)}-${n.slice(6)}`;
  return `${n.slice(0, 2)} ${n.slice(2, 6)}-${n.slice(6)}`;
}
