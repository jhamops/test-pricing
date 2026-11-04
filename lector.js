/**
 * Leer una foto o un PDF y devolver su texto, EN ESTE EQUIPO (nada sale a internet).
 *
 * - PDF con texto (la factura electrónica que manda el proveedor): pdf.js saca las letras
 *   tal cual, en un instante y sin errores. Se arman las filas por su altura en la hoja.
 * - PDF que es una foto (escaneado) o una foto: Tesseract (OCR) reconoce las letras. Tarda
 *   unos segundos y se equivoca más con fotos torcidas, oscuras o letra a mano.
 *
 * Las librerías están en vendor/ (se bajan la primera vez que se usan, ~6 MB, y el
 * navegador las guarda).
 */
const BASE = new URL('./vendor/', import.meta.url).href;
const MAX_PAGINAS = 6;

let pdfjs = null;
async function cargarPdf() {
    if (!pdfjs) {
        pdfjs = await import('./vendor/pdfjs/pdf.min.mjs');
        pdfjs.GlobalWorkerOptions.workerSrc = `${BASE}pdfjs/pdf.worker.min.mjs`;
    }
    return pdfjs;
}

let trabajador = null;
let avisarProgreso = () => {};
async function lectorOcr() {
    if (!trabajador) {
        const { createWorker } = (await import('./vendor/tesseract/tesseract.esm.min.js')).default;
        trabajador = await createWorker('spa', 1, {
            workerPath: `${BASE}tesseract/worker.min.js`,
            corePath: `${BASE}tesseract/`,
            langPath: `${BASE}tesseract/lang`,
            gzip: true,
            logger: (m) => { if (m.status === 'recognizing text') avisarProgreso(m.progress); },
        });
        // Un bloque de texto parejo: mantiene juntas las celdas de una misma fila de la tabla.
        await trabajador.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
    }
    return trabajador;
}

/** Umbral de Otsu: el gris que mejor separa letra (oscuro) de papel (claro). */
function otsu(gris) {
    const h = new Array(256).fill(0);
    for (const v of gris) h[v]++;
    const total = gris.length;
    let suma = 0;
    for (let i = 0; i < 256; i++) suma += i * h[i];
    let sumaB = 0, pesoB = 0, mejor = 0, umbral = 128;
    for (let t = 0; t < 256; t++) {
        pesoB += h[t];
        if (!pesoB) continue;
        const pesoF = total - pesoB;
        if (!pesoF) break;
        sumaB += t * h[t];
        const mB = sumaB / pesoB, mF = (suma - sumaB) / pesoF;
        const entre = pesoB * pesoF * (mB - mF) ** 2;
        if (entre > mejor) { mejor = entre; umbral = t; }
    }
    return umbral;
}

function grisDe(c) {
    const { data } = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height);
    const g = new Uint8Array(c.width * c.height);
    for (let i = 0, j = 0; j < g.length; i += 4, j++) g[j] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
    return g;
}

/**
 * Cuánto está girada la hoja (en grados): el ángulo en que las filas de letras quedan más
 * «apretadas» (la varianza de la proyección horizontal es máxima).
 */
function anguloDeLaHoja(oscuro, ancho, alto) {
    const pts = [];
    const paso = Math.max(1, Math.round(Math.sqrt((ancho * alto) / 400000)));
    for (let y = 0; y < alto; y += paso) for (let x = 0; x < ancho; x += paso) if (oscuro[y * ancho + x]) pts.push(x, y);
    if (pts.length < 200) return 0;
    let mejor = 0, mejorV = -1;
    for (let a = -8; a <= 8.001; a += 0.25) {
        const r = (a * Math.PI) / 180, sn = Math.sin(r), cs = Math.cos(r);
        const filas = new Float64Array(alto * 2 + 10);
        for (let i = 0; i < pts.length; i += 2) {
            const yy = Math.round(pts[i + 1] * cs - pts[i] * sn) + alto;
            if (yy >= 0 && yy < filas.length) filas[yy]++;
        }
        let v = 0;
        for (const f of filas) v += f * f;
        if (v > mejorV) { mejorV = v; mejor = a; }
    }
    return mejor;
}

/**
 * La imagen lista para el OCR: tamaño de letra cómodo, derecha, en blanco y negro y sin las
 * rayas de la tabla (Tesseract se confunde con la cuadrícula y con el fondo gris de los títulos).
 */
function prepararImagen(fuente, ancho, alto, objetivo = 2200) {
    const escala = Math.min(3, Math.max(1, objetivo / Math.max(ancho, 1)));
    let c = document.createElement('canvas');
    c.width = Math.round(ancho * escala);
    c.height = Math.round(alto * escala);
    let g = c.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(fuente, 0, 0, c.width, c.height);

    // 1. Enderezar
    let gris = grisDe(c);
    let umbral = otsu(gris);
    const angulo = anguloDeLaHoja(gris.map((v) => (v < umbral ? 1 : 0)), c.width, c.height);
    if (Math.abs(angulo) >= 0.25) {
        const d = document.createElement('canvas');
        d.width = c.width; d.height = c.height;
        const dg = d.getContext('2d', { willReadFrequently: true });
        dg.fillStyle = '#fff';
        dg.fillRect(0, 0, d.width, d.height);
        dg.translate(d.width / 2, d.height / 2);
        dg.rotate((-angulo * Math.PI) / 180);
        dg.drawImage(c, -c.width / 2, -c.height / 2);
        c = d; g = dg;
        gris = grisDe(c);
        umbral = otsu(gris);
    }

    // 2. Blanco y negro, con umbral por zonas (la sombra de un lado no se come las letras)
    const W = c.width, H = c.height, B = 64;
    const negro = new Uint8Array(W * H);
    const bx = Math.ceil(W / B), by = Math.ceil(H / B);
    const umbrales = new Float32Array(bx * by);
    for (let j = 0; j < by; j++) for (let i = 0; i < bx; i++) {
        let s = 0, n = 0, min = 255, max = 0;
        for (let y = j * B; y < Math.min(H, (j + 1) * B); y += 2) for (let x = i * B; x < Math.min(W, (i + 1) * B); x += 2) {
            const v = gris[y * W + x]; s += v; n++; if (v < min) min = v; if (v > max) max = v;
        }
        const media = s / n;
        // Zona pareja (papel liso o fondo): se usa el umbral de toda la hoja.
        umbrales[j * bx + i] = max - min < 40 ? umbral : Math.min(media - 12, (min + max) / 2 + 10);
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const k = y * W + x;
        negro[k] = gris[k] < umbrales[((y / B) | 0) * bx + ((x / B) | 0)] ? 1 : 0;
    }

    // 3. Borrar las rayas: tramos negros mucho más largos que una letra
    const largoH = Math.max(80, W * 0.06), largoV = Math.max(70, H * 0.03);
    const borrar = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
        let x0 = -1;
        for (let x = 0; x <= W; x++) {
            const on = x < W && negro[y * W + x];
            if (on && x0 < 0) x0 = x;
            if (!on && x0 >= 0) { if (x - x0 >= largoH) for (let k = x0; k < x; k++) borrar[y * W + k] = 1; x0 = -1; }
        }
    }
    for (let x = 0; x < W; x++) {
        let y0 = -1;
        for (let y = 0; y <= H; y++) {
            const on = y < H && negro[y * W + x];
            if (on && y0 < 0) y0 = y;
            if (!on && y0 >= 0) { if (y - y0 >= largoV) for (let k = y0; k < y; k++) borrar[k * W + x] = 1; y0 = -1; }
        }
    }
    const img = g.createImageData(W, H);
    for (let k = 0; k < W * H; k++) {
        const v = negro[k] && !borrar[k] ? 0 : 255;
        img.data[k * 4] = img.data[k * 4 + 1] = img.data[k * 4 + 2] = v;
        img.data[k * 4 + 3] = 255;
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.putImageData(img, 0, 0);
    return c;
}

async function ocr(canvas, parte, partes, alProgreso) {
    avisarProgreso = (p) => alProgreso(`Leyendo${partes > 1 ? ` página ${parte} de ${partes}` : ''}… ${Math.round(p * 100)} %`);
    const w = await lectorOcr();
    const { data } = await w.recognize(canvas);
    return data.text;
}

/** Texto de un PDF con letras: cada fila de la hoja, una línea; las celdas, separadas. */
function filasDelPdf(items) {
    const filas = [];
    for (const it of items) {
        if (!it.str || !it.str.trim()) continue;
        const x = it.transform[4], y = it.transform[5], h = Math.abs(it.transform[3]) || 8;
        let fila = filas.find((f) => Math.abs(f.y - y) <= Math.max(2, h * 0.45));
        if (!fila) { fila = { y, h, celdas: [] }; filas.push(fila); }
        fila.celdas.push({ x, fin: x + (it.width || 0), t: it.str });
    }
    filas.sort((a, b) => b.y - a.y);
    return filas.map((f) => {
        f.celdas.sort((a, b) => a.x - b.x);
        let linea = '', fin = null;
        for (const c of f.celdas) {
            const hueco = fin == null ? 0 : c.x - fin;
            linea += fin == null ? c.t : (hueco > f.h * 0.8 ? '  ' : hueco > f.h * 0.15 ? ' ' : '') + c.t;
            fin = c.fin;
        }
        return linea.trim();
    }).join('\n');
}

/**
 * → { texto, como: 'pdf' | 'ocr', paginas }
 * alProgreso(texto) recibe «Leyendo… 40 %». `objetivo`: ancho en píxeles al que se lleva la hoja
 * (más ancho = letra más grande para el OCR, y más lento).
 */
export async function leerArchivo(archivo, alProgreso = () => {}, { objetivo = 2200 } = {}) {
    const esPdf = archivo.type === 'application/pdf' || /\.pdf$/i.test(archivo.name);
    if (esPdf) {
        alProgreso('Abriendo el PDF…');
        const { getDocument } = await cargarPdf();
        const doc = await getDocument({ data: new Uint8Array(await archivo.arrayBuffer()), isEvalSupported: false }).promise;
        const paginas = Math.min(doc.numPages, MAX_PAGINAS);
        const textos = [];
        for (let n = 1; n <= paginas; n++) {
            const pagina = await doc.getPage(n);
            textos.push(filasDelPdf((await pagina.getTextContent()).items));
        }
        const texto = textos.join('\n');
        // Un PDF con letras trae decenas de caracteres; uno escaneado, ninguno.
        if (texto.replace(/\s/g, '').length >= 30) return { texto, como: 'pdf', paginas };
        const leidos = [];
        for (let n = 1; n <= paginas; n++) {
            alProgreso(`Es una foto: preparando la página ${n}…`);
            const pagina = await doc.getPage(n);
            const vista = pagina.getViewport({ scale: 1 });
            const escala = Math.min(3, objetivo / vista.width);
            const v = pagina.getViewport({ scale: escala });
            const lienzo = document.createElement('canvas');
            lienzo.width = Math.round(v.width); lienzo.height = Math.round(v.height);
            await pagina.render({ canvasContext: lienzo.getContext('2d'), viewport: v }).promise;
            leidos.push(await ocr(prepararImagen(lienzo, lienzo.width, lienzo.height, objetivo), n, paginas, alProgreso));
        }
        return { texto: leidos.join('\n'), como: 'ocr', paginas };
    }
    alProgreso('Preparando la foto…');
    const bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
    const texto = await ocr(prepararImagen(bitmap, bitmap.width, bitmap.height, objetivo), 1, 1, alProgreso);
    bitmap.close?.();
    return { texto, como: 'ocr', paginas: 1 };
}
