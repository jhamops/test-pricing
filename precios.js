/**
 * La cuenta del precio, sin pantalla (se prueba con `node --test`).
 *
 * Una regla GENERAL, como piensa quien pone los precios (no producto por producto):
 *
 * 1. Cuánto le sumas depende de lo que te costó: a lo barato, más porcentaje (si no,
 *    no ganas nada en soles); a lo caro, menos (ya ganas bastante en soles).
 * 2. Lo barato se vende por docena (precio por unidad) y suelto, un poco más caro.
 * 3. Cómo se redondea depende del precio: lo barato a 10 céntimos, lo mediano al sol,
 *    y lo caro termina en 8 (98 en vez de 100): ya trae su rebaja y no se rebaja más.
 * 4. Un producto con mucha competencia lleva menos; uno que se vende solo, más.
 *
 * La clave es la del cuaderno: mes · costo («/» en vez del punto) · año · porcentaje.
 *   03 | 10 | 26 | 50  →  marzo, costó S/ 10, 2026, le suma 50 %.
 */

export const REGLA_INICIAL = {
    // Si costó menos que `hasta`, le sumas `pct` % de GANANCIA. El último no tiene tope.
    // (La comisión de tarjeta va aparte y siempre: ver `tarjeta`.)
    escalera: [
        // De 5 en 5 (los botones que ella toca), ajustados con sus 38 precios reales
        // (`precios-reales.js`): error medio 5.1 %. Es solo el SUGERIDO: ella elige.
        { hasta: 5, pct: 60 },
        { hasta: 20, pct: 40 },
        { hasta: 60, pct: 50 },
        { hasta: 150, pct: 40 },
        { hasta: null, pct: 25 },
    ],
    porDocenaOn: true, // ¿se saca precio por docena? (opcional)
    docenaHasta: 18, // lo que cuesta menos que esto se vende por docena y suelto
    recargoSuelto: 15, // el suelto, este % más que la unidad por docena
    redondeoAlSolDesde: 10, // desde este precio se redondea al sol (antes, a 10 céntimos)
    terminaEn8On: true, // ¿lo caro termina en 8? (opcional: es decisión de cada negocio)
    terminaEn8Desde: 100, // desde este precio termina en 8
    ajustes: { competencia: -10, rentable: 15 }, // puntos que se restan o suman al %
    conFactura: true, // compra con factura y paga IGV: la ganancia se mide sin IGV
    // La comisión del POS (Culqi) va SIEMPRE dentro del precio, pague como pague: el
    // precio se divide entre (1 − 3 %), así lo que queda después de la comisión es exacto.
    tarjeta: 3,
    tarjetaSiempre: true,
};

/** Los porcentajes que se tocan: de 5 en 5, de 15 a 85 (y aparte, cualquiera). */
export const PORCENTAJES = Array.from({ length: 15 }, (_, i) => 15 + i * 5);

const r2 = (n) => Math.round(n * 100) / 100;
/** Al múltiplo más cercano (0.10, 0.50, 1). */
export const redondear = (n, paso) => r2(Math.round(r2(n / paso)) * paso);

/** El número terminado en 8 más cercano: 203.85 → 208, 196.25 → 198, 337.50 → 338. */
export function terminadoEn8(x) {
    const abajo = Math.floor((x - 8) / 10) * 10 + 8;
    const arriba = abajo + 10;
    return x - abajo <= arriba - x ? abajo : arriba;
}

/** El precio redondeado como lo haría ella, según cuánto es. */
export function redondearPrecio(x, regla) {
    if (regla.terminaEn8On !== false && x >= regla.terminaEn8Desde) return terminadoEn8(x);
    if (x >= regla.redondeoAlSolDesde) return Math.round(x);
    return redondear(x, 0.1);
}

/** El escalón que le toca a ese costo (su índice y su %). */
export function escalonDe(costo, regla) {
    const i = regla.escalera.findIndex((e) => e.hasta == null || costo < e.hasta);
    return i < 0 ? regla.escalera.length - 1 : i;
}

/** El % para ese costo, con el ajuste del producto (normal, competencia, rentable). */
export function porcentajeDe(costo, regla, ajuste = 'normal') {
    const base = regla.escalera[escalonDe(costo, regla)].pct;
    const extra = ajuste === 'competencia' ? regla.ajustes.competencia : ajuste === 'rentable' ? regla.ajustes.rentable : 0;
    return Math.max(0, base + extra);
}

/**
 * Todo lo de un producto. `costo` es por unidad (con IGV si compró con factura);
 * `flete` es lo que le toca de flete a cada unidad.
 */
export function calcular({ costo, flete = 0, ajuste = 'normal', pct: elegido = null, docena = null }, regla) {
    const c = Number(costo);
    if (!(c > 0)) return null;
    const f = Number(flete) || 0;
    const base = r2(c + f);
    // El que eligió (tocando un botón o escribiéndolo) manda; si no, el sugerido.
    const pct = elegido != null && elegido !== '' && Number.isFinite(Number(elegido)) ? Number(elegido) : porcentajeDe(c, regla, ajuste);
    const comisionPct = (Number(regla.tarjeta) || 0) / 100;
    const t = regla.tarjetaSiempre === false ? 0 : comisionPct;
    // Costo + ganancia; el flete se suma tal cual (no se le gana encima, como en su
    // cuaderno: 100 + 30 % + 2 de flete = 132); y encima lo que se lleva la tarjeta
    // (dividiendo, no sumando: la comisión se cobra sobre el precio final).
    const conPct = (c * (1 + pct / 100) + f) / (1 - t);
    // Por docena (por mayor) lo decide ella en cada producto; sin decirlo, la regla vieja por costo.
    const porDocena = docena != null ? Boolean(docena) : regla.porDocenaOn !== false && c < regla.docenaHasta;
    let docenaUnidad = null, suelto;
    if (porDocena) {
        docenaUnidad = redondear(conPct, 0.1);
        suelto = redondear(docenaUnidad * (1 + regla.recargoSuelto / 100), 0.5);
        if (suelto <= docenaUnidad) suelto = r2(docenaUnidad + 0.5);
    } else {
        suelto = redondearPrecio(conPct, regla);
    }
    const venta = porDocena ? docenaUnidad : suelto;
    const comision = r2(venta * t);
    const ganas = r2(venta - base - comision);
    // Con factura y pagando IGV, de lo cobrado una parte es IGV que va a SUNAT: se mide sin él.
    const teQueda = regla.conFactura ? r2((venta - c) / 1.18 - f - comision) : ganas;
    return {
        porcentaje: pct, costoConFlete: base, porDocena, sinRedondear: r2(conPct), comision,
        docenaUnidad, docena: porDocena ? r2(docenaUnidad * 12) : null,
        suelto, ganas, ganasSuelto: r2(suelto - base - r2(suelto * t)), teQueda,
        // Si le pagan en efectivo o Yape, la comisión no se cobra: le queda eso de más.
        enEfectivo: r2(teQueda + comision),
        // Si la comisión NO va en el precio: lo que queda cuando sí pagan con tarjeta.
        conTarjeta: r2(teQueda - venta * (t ? 0 : comisionPct)),
    };
}

/** Flete por unidad de UN producto: el flete que pagaste por él entre las unidades (o todo, si no dices cuántas). */
export const fleteDelProducto = (fleteTotal, cantidad) => {
    const total = Number(fleteTotal) || 0;
    if (total <= 0) return 0;
    return total / (Number(cantidad) > 0 ? Number(cantidad) : 1);
};

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
 * Varios productos de una vez: escritos, dictados, copiados de un WhatsApp, de una
 * factura o de columnas de Excel. Una línea por producto.
 *
 * - El precio de compra es el último número (lo que va pegado a «cm», «kg», «ml»… es parte del nombre).
 * - Cantidad: «x 24», «24 und», «por 24», o el número al empezar la línea («24 Cono 3.50»).
 * - Si la línea trae el total (factura: cantidad · precio · total), el total se descarta.
 * - «doc» o «docena» al final marca que lo vende por docena; «42 la docena» es el precio
 *   de la docena (se divide entre 12).
 * - «flete 5» es el flete de ese producto.
 * - Columnas de Excel con títulos (Producto · Cantidad · Costo) se leen por su título.
 */
const MEDIDA = String.raw`(?:cm|mm|mts?|m|metros?|cent[ií]metros?|kg|kilos?|gr?s?|gramos?|ml|lts?|l|litros?|oz|pulg(?:adas)?|w|v|mah|gb|p)\b`;
const UNIDADES = String.raw`(?:und|unds|unid|unidades|uds?|u|pzas?|piezas?|pqtes?|paquetes?)\b\.?`;
const NUMERO = /(?<![\w.,°/#-])(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:[.,]\d+)?)(?![\w°%]|[.,]\d)/g;
const aNumero = (t) => Number(/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t) ? t.replace(/,/g, '') : t.replace(',', '.'));
const casi = (a, b) => Math.abs(a - b) <= Math.max(0.05, b * 0.01);

function quitar(linea, m) {
    return linea.slice(0, m.index) + ' '.repeat(m[0].length) + linea.slice(m.index + m[0].length);
}

function leerLinea(cruda) {
    let l = ` ${cruda.replace(/\t/g, '  ')} `;
    // Lo dictado: «3 soles 50» → 3.50; «a 3 soles» → 3.
    l = l.replace(/(\d+)\s*soles?\s*(?:con\s*)?(\d{1,2})\b(?!\s*c[eé]ntimos?\s*\d)/gi, (_, s, c) => `${s}.${c.padStart(2, '0')}`)
        .replace(/(\d+)\s*soles?\b/gi, '$1')
        .replace(/(\d+)\s*c[eé]ntimos?\b/gi, (_, c) => `0.${c.padStart(2, '0')}`)
        .replace(/\bS\s*\/\s*\.?/gi, '  ').replace(/\bc\s*\/\s*u\b\.?/gi, '   ').replace(/\bPEN\b/g, '   ');

    let cantidad = null, docena = false, flete = '', docenaEsPrecio = false, m;
    // flete 5
    if ((m = l.match(/\bflete\s*:?\s*(\d+(?:[.,]\d+)?)/i))) { flete = String(aNumero(m[1])); l = quitar(l, m); }
    // «42 la docena», «docena a 42», «x docena 42» → el precio es de la docena
    if ((m = l.match(/(\d+(?:[.,]\d+)?)\s*(?:la|x|por|el)\s*(?:docena|doc|dz)\b\.?/i))) {
        docena = true; docenaEsPrecio = true; l = quitar(l, { index: m.index + m[1].length, 0: m[0].slice(m[1].length) });
    } else if ((m = l.match(/\b(?:la\s*)?(?:docena|doc|dz)\b\.?\s*(?:a|en|:)?\s*(?=\d)/i))) {
        docena = true; docenaEsPrecio = true; l = quitar(l, m);
    } else if ((m = l.match(/\b(?:x\s*|por\s*)?(?:docena|doc|dz)\b\.?/i))) { docena = true; l = quitar(l, m); }
    // cantidad: «x 24», «24 und», «por 24»
    if ((m = l.match(new RegExp(String.raw`\bx\s*(\d+)\b(?![.,]\d)|(?<![\w.,])(\d+)\s*${UNIDADES}|\bpor\s+(\d+)\b(?![.,]\d)(?!\s*${MEDIDA})`, 'i')))) {
        cantidad = Number(m[1] || m[2] || m[3]); l = quitar(l, m);
    }
    // Los números que quedan, sin los que son medida del producto («30 cm», «2 kg»)
    const nums = [...l.matchAll(NUMERO)].filter((x) => !new RegExp(String.raw`^\s*${MEDIDA}`, 'i').test(l.slice(x.index + x[0].length)))
        .map((x) => ({ x, v: aNumero(x[1]) }));
    if (!nums.length) return null;
    let costo = null;
    const usar = (n) => { l = quitar(l, n.x); };
    const ultimo = nums[nums.length - 1];
    // Factura: … cantidad precio total
    if (nums.length >= 2 && cantidad && casi(cantidad * nums[nums.length - 2].v, ultimo.v)) {
        costo = nums[nums.length - 2].v; usar(nums[nums.length - 2]); usar(ultimo);
    } else if (nums.length >= 3 && !cantidad) {
        const [a, b] = [nums[nums.length - 3], nums[nums.length - 2]];
        if (casi(a.v * b.v, ultimo.v) && (Number.isInteger(a.v) || Number.isInteger(b.v))) {
            const [q, p] = Number.isInteger(a.v) && (!Number.isInteger(b.v) || a.x.index < b.x.index) ? [a, b] : [b, a];
            cantidad = q.v; costo = p.v; usar(a); usar(b); usar(ultimo);
        }
    }
    if (costo == null) {
        costo = ultimo.v; usar(ultimo);
        // «24 Cono 30 cm 3.50»: el número del principio es la cantidad
        const primero = nums[0];
        if (!cantidad && nums.length >= 2 && Number.isInteger(primero.v) && !l.slice(0, primero.x.index).trim()) { cantidad = primero.v; usar(primero); }
    }
    if (docenaEsPrecio) costo = Math.round((costo / 12) * 10000) / 10000;
    const nombre = l.replace(/\s+/g, ' ').trim()
        .replace(/^[-–:·|,;*•.\s]+|[-–:·|,;=*•\s]+$/g, '')
        .replace(/\s+(?:a|de|en|al|x|por)$/i, '').replace(/^(?:a|de)\s+/i, '').trim();
    if (!(costo > 0)) return null;
    return { nombre, costo, cantidad: cantidad > 0 ? cantidad : null, docena, flete };
}

/** Columnas de Excel con títulos: ¿dónde está cada cosa? */
function columnasDeTitulos(linea) {
    const celdas = linea.split('\t').map((c) => c.trim().toLowerCase());
    if (celdas.length < 2 || celdas.some((c) => /\d/.test(c))) return null;
    const busca = (re) => celdas.findIndex((c) => re.test(c));
    const col = {
        nombre: busca(/producto|descrip|nombre|art[ií]culo|detalle|item/),
        costo: busca(/costo|compra|p\.?\s*unit|precio|valor\s*unit/),
        cantidad: busca(/cant|unidades|und/),
        flete: busca(/flete/),
    };
    return col.costo >= 0 && col.nombre >= 0 ? col : null;
}

/** → { productos: [{ nombre, costo, cantidad, docena, flete }], sinPrecio: [líneas que no se entendieron] } */
export function leerLista(texto) {
    const productos = [], sinPrecio = [];
    const lineas = String(texto || '').split(/\r?\n/).filter((x) => x.trim());
    const col = lineas.length && lineas[0].includes('\t') ? columnasDeTitulos(lineas[0]) : null;
    for (const linea of col ? lineas.slice(1) : lineas) {
        let p = null;
        if (col) {
            const c = linea.split('\t');
            const n = (i) => (i >= 0 && c[i] != null ? aNumero(String(c[i]).replace(/S\s*\/\s*\.?|\s/gi, '')) : NaN);
            const costo = n(col.costo);
            if (costo > 0) p = { nombre: String(c[col.nombre] || '').trim(), costo, cantidad: n(col.cantidad) > 0 ? n(col.cantidad) : null, docena: false, flete: n(col.flete) > 0 ? String(n(col.flete)) : '' };
        } else p = leerLinea(linea);
        if (p) productos.push({ ...p, nombre: p.nombre || `Producto ${productos.length + 1}` });
        else sinPrecio.push(linea.trim());
    }
    return { productos, sinPrecio };
}

export const leerPegado = (texto) => leerLista(texto).productos;

/** El texto para copiar (WhatsApp, cuaderno). */
export function textoParaCopiar(filas, fecha = new Date()) {
    const s = (n) => `S/ ${Number(n).toFixed(2)}`;
    return filas.map(({ nombre, costo, r }) => {
        const partes = [nombre];
        if (r.porDocena) partes.push(`docena ${s(r.docena)} (${s(r.docenaUnidad)} c/u)`, `suelto ${s(r.suelto)}`);
        else partes.push(`precio ${s(r.suelto)}`);
        partes.push(`clave ${clave(costo, r.porcentaje, fecha)}`);
        return partes.join(' · ');
    }).join('\n');
}

/** El flete por unidad de cada producto: el suyo (entre sus unidades) + su parte del de toda la compra. */
export function fleteDe(p, productos, fleteGlobal) {
    const global = Number(p.cantidad) > 0 ? fletePorUnidad(fleteGlobal, productos) : 0;
    return fleteDelProducto(p.flete, p.cantidad) + global;
}

/**
 * La hoja de Excel: una fila por producto y, al final, los totales de la compra.
 * Números como números (para que se pueda sumar en Excel), no como texto.
 */
export const COLUMNAS_EXCEL = [
    'Producto', 'Precio de compra', 'Cantidad', 'Flete c/u', 'Costo con flete', '% ganancia', 'Tarjeta %',
    'Docena c/u', 'Docena (x12)', 'Precio suelto', 'Ganas c/u', 'Te queda c/u (sin IGV)', 'Clave',
];
export function filasExcel(productos, regla, fleteGlobal = 0, fecha = new Date()) {
    const tarjeta = regla.tarjetaSiempre === false ? 0 : Number(regla.tarjeta) || 0;
    const filas = [];
    let invertido = 0, ganas = 0, queda = 0, conCantidad = 0;
    for (const p of productos) {
        const r = calcular({ costo: p.costo, pct: p.pct, docena: Boolean(p.docena), flete: fleteDe(p, productos, fleteGlobal) }, regla);
        if (!r) continue;
        const n = Number(p.cantidad) > 0 ? Number(p.cantidad) : null;
        const ganaUnidad = r.porDocena ? r.ganas : r.ganasSuelto;
        filas.push([
            p.nombre, r2(Number(p.costo)), n, r2(r.costoConFlete - Number(p.costo)), r.costoConFlete, r.porcentaje, tarjeta,
            r.porDocena ? r.docenaUnidad : null, r.porDocena ? r.docena : null, r.suelto, ganaUnidad, r.teQueda,
            clave(p.costo, r.porcentaje, fecha),
        ]);
        if (n) {
            conCantidad += 1;
            invertido += r.costoConFlete * n;
            ganas += ganaUnidad * n;
            queda += r.teQueda * n;
        }
    }
    const totales = conCantidad
        ? { invertido: r2(invertido), ganas: r2(ganas), queda: r2(queda) }
        : null;
    return { columnas: COLUMNAS_EXCEL, filas, totales };
}
