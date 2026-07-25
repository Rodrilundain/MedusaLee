// === OcrService: reconocimiento de texto en imagenes (Tesseract.js) ===
// Reutiliza el mismo patron que server/src/voice/voiceService.js: motor
// opt-in (OCR_ENABLED=false por defecto), con un limitador de
// concurrencia porque cada reconocimiento consume CPU real, y nunca
// lanza una excepcion hacia quien lo llama -- cualquier fallo se
// traduce a { success:false, error }, para que un problema de este
// modulo opcional nunca tire abajo el resto del backend.
//
// A diferencia de Piper (que se invoca como proceso del sistema aparte
// con spawn), Tesseract.js corre dentro del propio proceso de Node
// (WebAssembly): por eso aca se reutiliza un mismo worker entre pedidos
// en vez de crear uno nuevo cada vez -- crear un worker (carga del
// modelo entrenado del idioma) es la parte cara, no cada reconocimiento
// en si.
//
// IMPORTANTE (ver README.md de esta carpeta): esta integracion se
// escribio siguiendo la API documentada de tesseract.js, pero no se
// pudo ejecutar de punta a punta en este entorno de desarrollo (sin
// terminal disponible para correr npm install ni para probar un
// reconocimiento real) -- a diferencia del resto del repositorio, que
// si corre sus pruebas automatizadas en CI.

import { createWorker } from "tesseract.js";
import { cargarOcrConfig } from "./ocrConfig.js";
import { crearLimitadorConcurrencia } from "../voice/concurrencyLimiter.js";

let limitador = null;
function obtenerLimitador(config) {
    if (!limitador) {
          limitador = crearLimitadorConcurrencia({
                  maxConcurrentes: config.maxConcurrencia,
                  maxEnCola: config.maxEnCola,
          });
    }
    return limitador;
}
// Solo para tests: permite que un test cambie OCR_MAX_CONCURRENCIA y
// vuelva a crear el limitador con el nuevo tamano.
export function reiniciarLimitadorParaTests() {
    limitador = null;
}

// El worker de Tesseract se crea una sola vez (perezoso, en el primer
// pedido real) y se reutiliza entre llamadas siguientes -- ver nota de
// arriba. Si createWorker falla (por ejemplo, sin conexion para bajar
// los datos del idioma la primera vez), se limpia la promesa fallida
// para que el PROXIMO pedido pueda reintentar en vez de quedar
// encadenado a un error viejo para siempre.
let workerPromise = null;
function obtenerWorker(idioma) {
    if (!workerPromise) {
          workerPromise = createWorker(idioma).catch(err => {
                  workerPromise = null;
                  throw err;
          });
    }
    return workerPromise;
}
export function reiniciarWorkerParaTests() {
    workerPromise = null;
}

const PREFIJO_DATA_URL = /^data:image\/(png|jpeg|jpg|webp);base64,/;

function bufferDesdeDataUrl(dataUrl) {
    if (typeof dataUrl !== "string" || !PREFIJO_DATA_URL.test(dataUrl)) return null;
    const base64 = dataUrl.replace(PREFIJO_DATA_URL, "");
    try {
          return Buffer.from(base64, "base64");
    } catch {
          return null;
    }
}

// reconocerTexto({ imagenBase64 }) -> { success, texto, error, codigo? }
//
// imagenBase64 es un data URL completo (ej: "data:image/png;base64,...")
// de UNA pagina del documento, ya renderizada como imagen del lado del
// navegador (con pdf.js, que ya se usa para leer PDFs con texto). Este
// modulo no sabe nada de PDFs ni de paginas: solo recibe una imagen y
// devuelve el texto que Tesseract pudo reconocer en ella.
export async function reconocerTexto({ imagenBase64 } = {}) {
    const config = cargarOcrConfig();

  if (!config.ocrEnabled) {
        return { success: false, texto: null, error: "El reconocimiento optico de caracteres esta desactivado (OCR_ENABLED=false)." };
  }

  const buffer = bufferDesdeDataUrl(imagenBase64);
    if (!buffer) {
          return { success: false, texto: null, error: "La imagen enviada no es valida (se espera un data URL PNG/JPEG en base64)." };
    }
    if (buffer.byteLength > config.maxImagenBytes) {
          return { success: false, texto: null, error: `La imagen supera el tamano maximo permitido (${Math.round(config.maxImagenBytes / (1024 * 1024))} MB).` };
    }

  const limitar = obtenerLimitador(config);
    try {
          return await limitar(async () => {
                  const worker = await obtenerWorker(config.idioma);
                  const { data } = await worker.recognize(buffer);
                  const texto = (data?.text || "").replace(/\s+/g, " ").trim();
                  return { success: true, texto, error: null };
          });
    } catch (err) {
          return { success: false, texto: null, error: err?.message || "Error desconocido al reconocer el texto.", codigo: err?.codigo };
    }
}

// Para que server.js pueda informar en /health si este motor esta
// habilitado, sin que cada lugar que lo necesite tenga que leer
// variables de entorno por su cuenta.
export function ocrHabilitado() {
    return cargarOcrConfig().ocrEnabled;
}
