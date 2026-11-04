/**
 * La cuenta del precio, sin pantalla (se prueba con `node --test`).
 *
 * La regla sale del cuaderno de la tienda (pedido de marzo 2026): el precio por DOCENA
 * es el costo más un porcentaje que depende de la familia (o, para lo demás, del costo:
 * lo barato lleva más porcentaje). El precio SUELTO es la docena con un recargo, y lo
 * que solo se vende suelto (escaleras, cinta) lleva el porcentaje directo.
 *
 * La clave es la de su cuaderno: mes · costo («/» en vez del punto) · año · porcentaje.
 *   03 | 10 | 26 | 50  →  marzo, costó S/ 10, 2026, le suma 50 %.
 */

/** Familias con su regla. `palabras` sirve para reconocer la familia por el nombre. */
export const FAMILIAS_INICIALES = [
    { id: 'aros', nombre: 'Aros', palabras: ['aro'], docena: 70, suelto: 10, redondeoSuelto: 0.5, soloSuelto: false },
    { id: 'varillas', nombre: 'Varillas', palabras: ['varilla'], docena: 75, suelto: 20, redondeoSuelto: 0.5, soloSuelto: false },
    { id: 'ulas', nombre: 'Ulas', palabras: ['ula', 'hula'], docena: 35, suelto: 5, redondeoSuelto: 0.5, soloSuelto: false },
    { id: 'estacas', nombre: 'Estacas', palabras: ['estaca'], docena: 45, suelto: 7, redondeoSuelto: 0.5, soloSuelto: false },
    { id: 'vallas', nombre: 'Vallas', palabras: ['valla'], docena: 42, suelto: 22, redondeoSuelto: 0.5, soloSuelto: false },
    { id: 'escaleras', nombre: 'Escaleras', palabras: ['escalera'], docena: 65, suelto: 0, redondeoSuelto: 1, soloSuelto: true },
    { id: 'cintas', nombre: 'Cintas', palabras: ['cinta'], docena: 47, suelto: 0, redondeoSuelto: 1, soloSuelto: true },
];

/** Para lo que no es de ninguna familia: el porcentaje según lo que costó. */
export const ESCALERA_INICIAL = [
    { hasta: 4, docena: 70 },
    { hasta: 8, docena: 55 },
    { hasta: 16, docena: 45 },
    { hasta: null, docena: 47 },
];

export const REGLA_INICIAL = {
    familias: FAMILIAS_INICIALES,
    escalera: ESCALERA_INICIAL,
    sueltoOtros: 15,
    redondeoDocena: 0.1,
    redondeoSueltoOtros: 0.5,
    conFactura: true, // compra con factura y paga IGV (RMT o general): la ganancia se mide sin IGV
    tarjeta: 3, // % que cobra el POS (Culqi), solo para «si te paga con tarjeta»
};

const r2 = (n) => Math.round(n * 100) / 100;
/** Redondea al múltiplo más cercano (0.10, 0.50, 1.00). */
export const redondear = (n, paso) => (paso > 0 ? r2(Math.round(n / paso) * paso) : r2(n));

/** La familia por el nombre del producto («Valla fija 20 cm» → vallas). */
export function familiaDe(nombre, familias) {
    const t = ` ${String(nombre || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')} `;
    return familias.find((f) => f.palabras.some((p) => new RegExp(`[^a-z]${p}s?[^a-z]`).test(t))) || null;
}

/** El porcentaje que le toca: el del producto si se cambió, el de su familia, o el de la escalera. */
export function porcentajeDe(costo, familia, regla, propio = null) {
    if (propio != null && propio !== '' && Number.isFinite(Number(propio))) return Number(propio);
    if (familia) return familia.docena;
    const escalon = regla.escalera.find((e) => e.hasta == null || costo < e.hasta) || regla.escalera[regla.escalera.length - 1];
    return escalon.docena;
}

/**
 * Todo lo de un producto. `costo` es por unidad (con IGV si compró con factura);
 * `flete` es lo que le toca de flete a cada unidad.
 */
export function calcular({ costo, flete = 0, familia = null, propio = null }, regla) {
    const c = Number(costo);
    if (!(c > 0)) return null;
    const base = r2(c + (Number(flete) || 0));
    const pct = porcentajeDe(c, familia, regla, propio);
    const soloSuelto = Boolean(familia?.soloSuelto);
    const conPct = base * (1 + pct / 100);
    const docenaUnidad = soloSuelto ? null : redondear(conPct, regla.redondeoDocena);
    const recargo = familia ? familia.suelto : regla.sueltoOtros;
    const pasoSuelto = familia ? familia.redondeoSuelto : regla.redondeoSueltoOtros;
    const suelto = soloSuelto ? redondear(conPct, pasoSuelto) : redondear(docenaUnidad * (1 + recargo / 100), pasoSuelto);
    // Lo que se gana por unidad (vendiendo por docena, o suelto si solo va suelto).
    const venta = soloSuelto ? suelto : docenaUnidad;
    const ganas = r2(venta - base);
    // Con factura y pagando IGV, de lo ganado una parte es IGV que va a SUNAT: se mide sin él.
    const teQueda = regla.conFactura ? r2((venta - c) / 1.18 - (Number(flete) || 0)) : ganas;
    const conTarjeta = r2(teQueda - venta * (regla.tarjeta / 100));
    return {
        porcentaje: pct, costoConFlete: base, soloSuelto,
        docenaUnidad, docena: docenaUnidad == null ? null : r2(docenaUnidad * 12),
        suelto, ganas, ganasSuelto: r2(suelto - base), teQueda, conTarjeta,
        margenReal: venta > 0 ? Math.round((teQueda / (regla.conFactura ? venta / 1.18 : venta)) * 100) : 0,
    };
}

/** La clave del cuaderno: «03 10 26 50». */
export function clave(costo, porcentaje, fecha = new Date()) {
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const anio = String(fecha.getFullYear()).slice(-2);
    const c = Number(costo);
    const texto = Number.isInteger(c) ? String(c) : String(r2(c)).replace('.', '/');
    return `${mes} ${texto} ${anio} ${Math.round(porcentaje)}`;
}

/** Flete por unidad: lo que costó el flete entre todas las unidades que llegaron. */
export function fletePorUnidad(fleteTotal, productos) {
    const total = Number(fleteTotal) || 0;
    if (total <= 0) return 0;
    const unidades = productos.reduce((s, p) => s + (Number(p.cantidad) > 0 ? Number(p.cantidad) : 0), 0);
    return unidades > 0 ? total / unidades : 0;
}

/**
 * Varios productos pegados (de una lista, una factura copiada, un WhatsApp). Una línea
 * por producto: el último número es el costo; «x 36» o «36 und» es la cantidad.
 *   «Valla fija 20 cm 10»      → Valla fija 20 cm · costo 10
 *   «Aro 20cm 1.20 x 36»       → Aro 20cm · costo 1.20 · 36 unidades
 *   «Ula 65 cm  S/ 9,50  24u»  → Ula 65 cm · costo 9.50 · 24 unidades
 */
export function leerPegado(texto) {
    const salida = [];
    for (const cruda of String(texto || '').split(/\r?\n/)) {
        let linea = cruda.replace(/\t/g, ' ').trim();
        if (!linea) continue;
        let cantidad = null;
        const cant = linea.match(/(?:\bx\s*(\d+)\b|\b(\d+)\s*(?:und|unid|unidades|u|pzas?|piezas?)\b\.?)/i);
        if (cant) {
            cantidad = Number(cant[1] || cant[2]);
            linea = (linea.slice(0, cant.index) + ' ' + linea.slice(cant.index + cant[0].length)).trim();
        }
        const numeros = [...linea.matchAll(/(?:s\/\.?\s*)?(\d+(?:[.,]\d{1,2})?)/gi)];
        if (!numeros.length) continue;
        const ultimo = numeros[numeros.length - 1];
        const costo = Number(ultimo[1].replace(',', '.'));
        const nombre = linea.slice(0, ultimo.index).replace(/[-–:·|]+\s*$/, '').replace(/s\/\.?\s*$/i, '').trim();
        if (!(costo > 0)) continue;
        salida.push({ nombre: nombre || `Producto ${salida.length + 1}`, costo, cantidad });
    }
    return salida;
}

/** El texto para copiar (WhatsApp, cuaderno). */
export function textoParaCopiar(filas, fecha = new Date()) {
    const s = (n) => `S/ ${Number(n).toFixed(2)}`;
    return filas.map(({ nombre, costo, r }) => {
        const partes = [nombre];
        if (r.docena != null) partes.push(`docena ${s(r.docena)} (${s(r.docenaUnidad)} c/u)`);
        partes.push(`suelto ${s(r.suelto)}`);
        partes.push(`clave ${clave(costo, r.porcentaje, fecha)}`);
        return partes.join(' · ');
    }).join('\n');
}
