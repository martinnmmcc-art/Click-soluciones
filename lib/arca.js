// Conexión con ARCA (ex AFIP) para emitir Factura C de monotributo.
//
// Cómo funciona ARCA por web service:
//  1. WSAA (autenticación): se firma un pedido con tu certificado y ARCA
//     devuelve un "ticket" (token + sign) que vale 12 horas. Se guarda en la
//     base para no pedirlo en cada factura.
//  2. WSFEv1 (factura electrónica): con el ticket se pide el último número
//     usado y se solicita el CAE del siguiente. El CAE es lo que hace válida
//     la factura.
//
// Solo corre en el servidor: el certificado y la clave privada están en las
// variables de entorno de Vercel y nunca llegan al navegador.
//
// Variables (Vercel → Settings → Environment Variables):
//  ARCA_CUIT          tu CUIT, solo números
//  ARCA_PUNTO_VENTA   número del punto de venta "Web Services" (ej. 2)
//  ARCA_CERT          el certificado .crt que bajás de ARCA (texto completo)
//  ARCA_KEY           tu clave privada .key (texto completo)
//  ARCA_PRODUCCION    "si" para facturas reales; cualquier otra cosa = pruebas

import https from "node:https";
import forge from "node-forge";

const PRODUCCION = () => String(process.env.ARCA_PRODUCCION || "").toLowerCase() === "si";

const URLS = () =>
  PRODUCCION()
    ? {
        wsaa: "https://wsaa.afip.gov.ar/ws/services/LoginCms",
        wsfe: "https://servicios1.afip.gov.ar/wsfev1/service.asmx"
      }
    : {
        wsaa: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
        wsfe: "https://wswhomo.afip.gov.ar/wsfev1/service.asmx"
      };

// Factura C y condiciones frente al IVA del receptor (tabla de ARCA)
export const TIPO_FACTURA_C = 11;
export const CONDICION_IVA = {
  consumidor_final: 5,
  monotributo: 6,
  responsable_inscripto: 1,
  exento: 4
};
export const TIPO_DOC = { cuit: 80, cuil: 86, dni: 96, sin_identificar: 99 };

export class ErrorArca extends Error {
  constructor(mensaje, codigo, detalle) {
    super(mensaje);
    this.codigo = codigo;
    this.detalle = detalle;
  }
}

// ---------- configuración ----------
function pem(texto, tipo) {
  if (!texto) return null;
  let t = String(texto).trim();
  // Si se pegó en base64 de una sola línea (sin encabezados), se arma el PEM
  if (!t.includes("-----BEGIN")) {
    try {
      const decod = Buffer.from(t, "base64").toString("utf8");
      if (decod.includes("-----BEGIN")) t = decod;
      else t = `-----BEGIN ${tipo}-----\n${t.match(/.{1,64}/g).join("\n")}\n-----END ${tipo}-----`;
    } catch (e) {}
  }
  // Vercel a veces guarda los saltos de línea como "\n" literal
  return t.replace(/\\n/g, "\n");
}

export function configuracion() {
  const cuit = String(process.env.ARCA_CUIT || "").replace(/\D/g, "");
  const puntoVenta = Number(process.env.ARCA_PUNTO_VENTA || 0);
  const cert = pem(process.env.ARCA_CERT, "CERTIFICATE");
  const key = pem(process.env.ARCA_KEY, "PRIVATE KEY");
  const faltan = [];
  if (cuit.length !== 11) faltan.push("ARCA_CUIT");
  if (!puntoVenta) faltan.push("ARCA_PUNTO_VENTA");
  if (!cert) faltan.push("ARCA_CERT");
  if (!key) faltan.push("ARCA_KEY");
  return { cuit, puntoVenta, cert, key, produccion: PRODUCCION(), faltan };
}

// ---------- HTTP ----------
// Los servidores de ARCA usan una configuración de seguridad vieja que Node
// rechaza por defecto ("dh key too small"): se baja el nivel solo para ellos.
const agente = new https.Agent({ ciphers: "DEFAULT@SECLEVEL=0", keepAlive: false });

function post(url, cuerpo, soapAction) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: "POST",
        agent: agente,
        timeout: 25000,
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "Content-Length": Buffer.byteLength(cuerpo),
          SOAPAction: soapAction || '""'
        }
      },
      (res) => {
        let datos = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (datos += c));
        res.on("end", () => resolve({ estado: res.statusCode, texto: datos }));
      }
    );
    req.on("timeout", () => req.destroy(new Error("ARCA no respondió a tiempo")));
    req.on("error", reject);
    req.write(cuerpo);
    req.end();
  });
}

// ---------- XML mínimo ----------
function desescapar(s) {
  return String(s)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function tag(xml, nombre) {
  const m = new RegExp(`<(?:\\w+:)?${nombre}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${nombre}>`).exec(xml || "");
  return m ? m[1].trim() : null;
}

function tags(xml, nombre) {
  const re = new RegExp(`<(?:\\w+:)?${nombre}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${nombre}>`, "g");
  const out = [];
  let m;
  while ((m = re.exec(xml || ""))) out.push(m[1].trim());
  return out;
}

// Errores y observaciones que devuelve WSFE
function erroresWsfe(xml) {
  const lista = [];
  for (const bloque of [...tags(xml, "Err"), ...tags(xml, "Obs")]) {
    const code = tag(bloque, "Code");
    const msg = tag(bloque, "Msg");
    if (code || msg) lista.push(`${code ? code + ": " : ""}${desescapar(msg || "")}`);
  }
  return lista;
}

// ---------- WSAA: ticket de acceso ----------
function fechaArca(d) {
  // Hora argentina con su zona, como pide ARCA
  const local = new Date(d.getTime() - 3 * 3600 * 1000);
  return local.toISOString().replace(/\.\d{3}Z$/, "-03:00");
}

export function armarTRA(servicio, ahora = new Date()) {
  const desde = new Date(ahora.getTime() - 10 * 60 * 1000);
  const hasta = new Date(ahora.getTime() + 10 * 60 * 1000);
  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${Math.floor(ahora.getTime() / 1000)}</uniqueId>
    <generationTime>${fechaArca(desde)}</generationTime>
    <expirationTime>${fechaArca(hasta)}</expirationTime>
  </header>
  <service>${servicio}</service>
</loginTicketRequest>`;
}

// Firma CMS (PKCS#7) del pedido con tu certificado y clave
export function firmarCMS(contenido, certPem, keyPem) {
  const cert = forge.pki.certificateFromPem(certPem);
  const key = forge.pki.privateKeyFromPem(keyPem);
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(contenido, "utf8");
  p7.addCertificate(cert);
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() }
    ]
  });
  p7.sign();
  return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());
}

// Datos del certificado (para mostrar en "Probar conexión")
export function infoCertificado(certPem) {
  try {
    const c = forge.pki.certificateFromPem(certPem);
    const cn = c.subject.getField("CN")?.value || "";
    const serial = c.subject.getField({ name: "serialNumber" })?.value || "";
    return { nombre: cn, cuit: serial.replace(/\D/g, ""), vence: c.validity.notAfter.toISOString() };
  } catch (e) {
    return { error: "El certificado no se pudo leer. Revisá que ARCA_CERT tenga el .crt completo." };
  }
}

async function pedirTicketNuevo(servicio, cfg) {
  const cms = firmarCMS(armarTRA(servicio), cfg.cert, cfg.key);
  const soap = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soapenv:Header/>
  <soapenv:Body><wsaa:loginCms><wsaa:in0>${cms}</wsaa:in0></wsaa:loginCms></soapenv:Body>
</soapenv:Envelope>`;
  const r = await post(URLS().wsaa, soap, "");
  const ret = tag(r.texto, "loginCmsReturn");
  if (!ret) {
    const falla = desescapar(tag(r.texto, "faultstring") || `ARCA respondió ${r.estado}`);
    // Ya hay un ticket vigente pedido hace poco (por otra instancia)
    if (/alreadyAuthenticated|ya posee un TA valido/i.test(falla)) {
      throw new ErrorArca("ARCA dice que ya hay un acceso vigente. Esperá 2 minutos y probá de nuevo.", "TA_VIGENTE", falla);
    }
    if (/notAuthorized|no autorizado|Computador no autorizado/i.test(falla)) {
      throw new ErrorArca(
        "ARCA no autorizó el certificado para facturar. Falta asociarlo al servicio “wsfe” en Administrador de Relaciones.",
        "NO_AUTORIZADO",
        falla
      );
    }
    throw new ErrorArca(`No se pudo entrar a ARCA: ${falla}`, "WSAA", falla);
  }
  const ticket = desescapar(ret);
  return {
    token: tag(ticket, "token"),
    sign: tag(ticket, "sign"),
    vence: tag(ticket, "expirationTime")
  };
}

// Ticket guardado en la base (vale 12 h) o uno nuevo
export async function ticketAcceso(supabase, cfg, servicio = "wsfe") {
  const clave = `${servicio}:${cfg.produccion ? "prod" : "homo"}:${cfg.cuit}`;
  const { data } = await supabase.from("arca_tickets").select("*").eq("clave", clave).maybeSingle();
  if (data && new Date(data.vence).getTime() - Date.now() > 10 * 60 * 1000) {
    return { token: data.token, sign: data.sign };
  }
  const t = await pedirTicketNuevo(servicio, cfg);
  await supabase
    .from("arca_tickets")
    .upsert({ clave, token: t.token, sign: t.sign, vence: t.vence, creado_en: new Date().toISOString() });
  return t;
}

// ---------- WSFEv1 ----------
function sobre(metodo, cuerpo) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soap:Body><ar:${metodo}>${cuerpo}</ar:${metodo}></soap:Body>
</soap:Envelope>`;
}

function auth(t, cfg) {
  return `<ar:Auth><ar:Token>${t.token}</ar:Token><ar:Sign>${t.sign}</ar:Sign><ar:Cuit>${cfg.cuit}</ar:Cuit></ar:Auth>`;
}

async function wsfe(metodo, cuerpo) {
  const r = await post(URLS().wsfe, sobre(metodo, cuerpo), `http://ar.gov.afip.dif.FEV1/${metodo}`);
  if (r.estado >= 500 && !r.texto.includes(`${metodo}Response`)) {
    throw new ErrorArca(`ARCA respondió con error (${r.estado}). Probá de nuevo en unos minutos.`, "WSFE_HTTP", r.texto.slice(0, 500));
  }
  return r.texto;
}

// Sin autenticación: solo dice si los servidores de ARCA están funcionando
export async function estadoServidores() {
  const xml = await wsfe("FEDummy", "");
  return { app: tag(xml, "AppServer"), base: tag(xml, "DbServer"), auth: tag(xml, "AuthServer") };
}

export async function puntosDeVenta(t, cfg) {
  const xml = await wsfe("FEParamGetPtosVenta", auth(t, cfg));
  return tags(xml, "PtoVenta").map((p) => ({
    numero: Number(tag(p, "Nro")),
    tipo: tag(p, "EmisionTipo"),
    bloqueado: tag(p, "Bloqueado") === "S",
    baja: tag(p, "FchBaja")
  }));
}

export async function ultimoNumero(t, cfg, tipo = TIPO_FACTURA_C) {
  const xml = await wsfe(
    "FECompUltimoAutorizado",
    `${auth(t, cfg)}<ar:PtoVta>${cfg.puntoVenta}</ar:PtoVta><ar:CbteTipo>${tipo}</ar:CbteTipo>`
  );
  const errores = erroresWsfe(xml);
  const n = tag(xml, "CbteNro");
  if (n === null) throw new ErrorArca(`ARCA no informó el último número: ${errores.join(" · ")}`, "ULTIMO", xml.slice(0, 800));
  return Number(n);
}

// Consulta un comprobante ya emitido (para recuperar uno si se cortó la señal)
export async function consultarComprobante(t, cfg, numero, tipo = TIPO_FACTURA_C) {
  const xml = await wsfe(
    "FECompConsultar",
    `${auth(t, cfg)}<ar:FeCompConsReq><ar:CbteTipo>${tipo}</ar:CbteTipo><ar:CbteNro>${numero}</ar:CbteNro><ar:PtoVta>${cfg.puntoVenta}</ar:PtoVta></ar:FeCompConsReq>`
  );
  const r = tag(xml, "ResultGet");
  if (!r) return null;
  return {
    numero: Number(tag(r, "CbteDesde")),
    fecha: tag(r, "CbteFch"),
    total: Number(tag(r, "ImpTotal")),
    docTipo: Number(tag(r, "DocTipo")),
    docNro: tag(r, "DocNro"),
    cae: tag(r, "CodAutorizacion"),
    caeVence: tag(r, "FchVto")
  };
}

function hoyArca(d = new Date()) {
  const local = new Date(d.getTime() - 3 * 3600 * 1000);
  return local.toISOString().slice(0, 10).replace(/-/g, "");
}

// Arma el pedido de CAE de una Factura C (sin IVA discriminado)
export function armarFacturaC({ cfg, numero, total, docTipo, docNro, condicionIva, fecha = hoyArca(), concepto = 1 }) {
  const importe = Number(total).toFixed(2);
  const servicios =
    concepto === 1 ? "" : `<ar:FchServDesde>${fecha}</ar:FchServDesde><ar:FchServHasta>${fecha}</ar:FchServHasta><ar:FchVtoPago>${fecha}</ar:FchVtoPago>`;
  return `<ar:FeCAEReq>
  <ar:FeCabReq><ar:CantReg>1</ar:CantReg><ar:PtoVta>${cfg.puntoVenta}</ar:PtoVta><ar:CbteTipo>${TIPO_FACTURA_C}</ar:CbteTipo></ar:FeCabReq>
  <ar:FeDetReq><ar:FECAEDetRequest>
    <ar:Concepto>${concepto}</ar:Concepto>
    <ar:DocTipo>${docTipo}</ar:DocTipo>
    <ar:DocNro>${docNro}</ar:DocNro>
    <ar:CbteDesde>${numero}</ar:CbteDesde>
    <ar:CbteHasta>${numero}</ar:CbteHasta>
    <ar:CbteFch>${fecha}</ar:CbteFch>
    <ar:ImpTotal>${importe}</ar:ImpTotal>
    <ar:ImpTotConc>0.00</ar:ImpTotConc>
    <ar:ImpNeto>${importe}</ar:ImpNeto>
    <ar:ImpOpEx>0.00</ar:ImpOpEx>
    <ar:ImpTrib>0.00</ar:ImpTrib>
    <ar:ImpIVA>0.00</ar:ImpIVA>
    ${servicios}
    <ar:MonId>PES</ar:MonId>
    <ar:MonCotiz>1</ar:MonCotiz>
    <ar:CondicionIVAReceptorId>${condicionIva}</ar:CondicionIVAReceptorId>
  </ar:FECAEDetRequest></ar:FeDetReq>
</ar:FeCAEReq>`;
}

export async function solicitarCAE(t, cfg, datos) {
  const xml = await wsfe("FECAESolicitar", `${auth(t, cfg)}${armarFacturaC({ cfg, ...datos })}`);
  const resultado = tag(xml, "Resultado");
  const det = tag(xml, "FECAEDetResponse") || "";
  const cae = tag(det, "CAE");
  const errores = erroresWsfe(xml);
  if (resultado !== "A" || !cae) {
    throw new ErrorArca(
      `ARCA rechazó la factura: ${errores.join(" · ") || "sin detalle"}`,
      "RECHAZADA",
      xml.slice(0, 2000)
    );
  }
  return {
    cae,
    caeVence: tag(det, "CAEFchVto"),
    fecha: tag(det, "CbteFch"),
    observaciones: errores,
    xml: xml.slice(0, 4000)
  };
}

// Datos del QR que exige ARCA (RG 4892)
export function urlQR({ cuit, puntoVenta, numero, fecha, total, docTipo, docNro, cae }) {
  const f = String(fecha);
  const datos = {
    ver: 1,
    fecha: f.includes("-") ? f : `${f.slice(0, 4)}-${f.slice(4, 6)}-${f.slice(6, 8)}`,
    cuit: Number(cuit),
    ptoVta: Number(puntoVenta),
    tipoCmp: TIPO_FACTURA_C,
    nroCmp: Number(numero),
    importe: Number(Number(total).toFixed(2)),
    moneda: "PES",
    ctz: 1,
    tipoDocRec: Number(docTipo),
    nroDocRec: Number(docNro || 0),
    tipoCodAut: "E",
    codAut: Number(cae)
  };
  return `https://www.afip.gob.ar/fe/qr/?p=${Buffer.from(JSON.stringify(datos)).toString("base64")}`;
}
