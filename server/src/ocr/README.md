# OCR para PDFs escaneados (motor opcional, gratis, sin cuota)

Este módulo agrega reconocimiento óptico de caracteres (OCR) para PDFs
que son en realidad una imagen escaneada (sin texto seleccionable). Es
un motor separado del resto de la app, con el mismo criterio que
`server/src/voice/` (Piper): apagado por defecto (`OCR_ENABLED=false`),
así que si no lo configurás, MedusaLee sigue funcionando exactamente
igual que antes -- la detección de PDF escaneado que ya existe en el
frontend (`js/documentos.js`) solo avisa, nunca bloquea el resto de la
app.

## Aviso importante: qué se verificó y qué no en esta sesión

A diferencia del resto del repositorio (que corre sus pruebas
automatizadas en cada PR/push, ver `.github/workflows/ci.yml`), este
módulo se escribió sin acceso a una terminal para instalar dependencias
ni ejecutar nada: no se corrió `npm install`, no se generó ningún
worker de Tesseract real, y no se reconoció texto de ninguna imagen de
verdad. El código sigue la API pública documentada de `tesseract.js`,
pero **no está probado de punta a punta**. Antes de activar
`OCR_ENABLED=true` en producción:

1. Corré `cd server && npm install` para instalar `tesseract.js` de verdad.
2. Probá `POST /ocr/pagina` con una imagen real de una página escaneada
   (por ejemplo, una captura de pantalla de un PDF) y confirmá que el
      texto reconocido tiene sentido.
      3. Revisá los logs del primer pedido real: la primera vez que se usa un
         idioma, `tesseract.js` descarga los datos entrenados de ese idioma
            desde una CDN pública (ver sección siguiente) -- si esa descarga
               falla en el entorno de despliegue, el motor va a fallar con un error
                  claro, no en silencio, pero conviene saberlo de antemano.
                  4. Corré `npm test` en `server/` y confirmá que nada se rompió (este
                     módulo no trae tests propios todavía -- ver "Qué falta" al final).

                     ## Origen y licencia

                     [tesseract.js](https://github.com/naptha/tesseract.js) es un envoltorio
                     en JavaScript/WebAssembly del motor Tesseract OCR, licencia Apache-2.0
                     (permisiva, sin copyleft -- a diferencia de Piper/GPL-3.0, no impone
                     condiciones sobre cómo se distribuye MedusaLee). Los datos entrenados
                     de cada idioma (`spa.traineddata`, `eng.traineddata`) se descargan la
                     primera vez que se usa ese idioma, normalmente desde una CDN pública
                     (jsDelivr o similar, configurable). **No se confirmó en esta sesión**
                     si esa CDN es alcanzable desde el entorno de build de Render, ni
                     cuánto pesa esa descarga -- mismo tipo de limitación que ya existe con
                     la voz `es_AR-daniela` de Piper y Hugging Face (ver
                     `server/src/voice/README.md`).

                     ## Instalación

                     ```
                     cd server
                     npm install tesseract.js
                     ```

                     En `server/.env` (no se commitea):

                     ```
                     OCR_ENABLED=true
                     OCR_IDIOMA=spa+eng
                     OCR_MAX_CONCURRENCIA=1
                     OCR_MAX_EN_COLA=5
                     OCR_MAX_IMAGEN_BYTES=15728640
                     ```

                     Con `OCR_ENABLED=false` (o sin definir, el valor por defecto),
                     `POST /ocr/pagina` responde `404` con `{ success:false }` y el resto de
                     MedusaLee sigue funcionando exactamente igual.

                     ## Cómo se usa desde el frontend

                     Este módulo no sabe nada de PDFs: solo recibe una imagen (un data URL
                     PNG/JPEG en base64) y devuelve el texto reconocido. El frontend
                     (`js/documentos.js`) es quien arma esa imagen, reutilizando `pdf.js`
                     (que ya está cargado para leer PDFs con texto): cuando la heurística
                     existente detecta un PDF escaneado, se ofrece un botón para renderizar
                     cada página como imagen y mandarla, una por una, a `POST /ocr/pagina`.
                     
                     ## Endpoint

                     `POST /ocr/pagina` recibe `{ imagenBase64 }` (un data URL PNG/JPEG en
                     base64 de una sola página) y devuelve `{ success, texto, error }`.
                     También se agregó `ocrHabilitado` a la respuesta de `GET /health`, para
                     que el frontend sepa si puede ofrecer el botón de OCR sin adivinar.
                     ## Qué falta (no incluido en esta entrega)

                     - Tests automatizados: el resto del repositorio prueba cada módulo con
                       `node --test` (153 tests en `server/` a la fecha de este cambio);
                         este módulo no trae tests propios todavía.
                         - No se probó con una imagen real de un documento escaneado en
                           español, solo se revisó el código contra la documentación de
                             `tesseract.js`.
                             - No se implementó reintento automático si falla la descarga de los
                               datos del idioma la primera vez (queda como mejora futura).
                               - El frontend manda las páginas una por una, en secuencia (no en
                                 paralelo), para no saturar el límite de concurrencia del servidor --
                                   esto puede ser lento para documentos de muchas páginas.

                                   ## Resumen de lo que se hizo

                                   `server/src/ocr/ocrConfig.js` (variables de entorno), `ocrService.js`
                                   (lógica de reconocimiento con Tesseract.js, mismo patrón de límite de
                                   concurrencia que `server/src/voice/`), y el endpoint `POST /ocr/pagina`
                                   en `server/server.js`. Del lado del frontend, `js/documentos.js` ofrece
                                   un botón de OCR cuando detecta un PDF escaneado, reutilizando `pdf.js`
                                   para renderizar cada página como imagen.
                                   