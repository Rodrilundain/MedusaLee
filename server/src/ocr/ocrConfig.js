// === Configuración del OCR (reconocimiento óptico de caracteres) ===
// Motor: Tesseract.js, corre 100% en el servidor (nunca se manda la
// imagen de la página a un servicio externo). Mismo criterio que el
// módulo de voz local (server/src/voice/): apagado por defecto, así que
// sin configurar nada MedusaLee sigue funcionando exactamente igual que
// antes -- la detección de PDF escaneado que ya existe en el frontend
// solo avisa, nunca bloquea el resto de la app.

function leerBooleano(valor, porDefecto) {
    if (valor === undefined || valor === "") return porDefecto;
    return valor === "true" || valor === "1";
}

function leerNumero(valor, porDefecto) {
    const n = Number(valor);
    return Number.isFinite(n) && n > 0 ? n : porDefecto;
}

export function cargarOcrConfig() {
    return {
          // Opt-in, igual que TTS_ENABLED: sin esto en "true", /ocr/pagina
          // devuelve un error claro en vez de intentar reconocer texto.
          ocrEnabled: leerBooleano(process.env.OCR_ENABLED, false),
          // Idiomas que Tesseract.js debe cargar (formato propio de Tesseract,
          // varios separados por "+"). "spa+eng" cubre documentos en español
          // con términos o siglas en inglés mezcladas.
          idioma: process.env.OCR_IDIOMA || "spa+eng",
          // Cada reconocimiento consume CPU real (WebAssembly) -- igual que con
          // Piper, se limita cuántos corren en paralelo y cuántos más esperan
          // en cola antes de rechazar con un error claro.
          maxConcurrencia: leerNumero(process.env.OCR_MAX_CONCURRENCIA, 1),
          maxEnCola: leerNumero(process.env.OCR_MAX_EN_COLA, 5),
          // Cota defensiva sobre el tamaño de la imagen (PNG en base64) que se
          // acepta por página -- no una expectativa real de tamaño.
          maxImagenBytes: leerNumero(process.env.OCR_MAX_IMAGEN_BYTES, 15 * 1024 * 1024),
    };
}
