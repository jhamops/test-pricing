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
        { hasta: 5, pct: 57 },
        { hasta: 20, pct: 42 },
        { hasta: 60, pct: 47 },
        { hasta: 150, pct: 37 },
        { hasta: null, pct: 27 },
    ],
    docenaHasta: 18, // lo que cuesta menos que esto se vende por docena y suelto
    recargoSuelto: 15, // el suelto, este % más que la unidad por docena
    redondeoAlSolDesde: 10, // desde este precio se redondea al sol (antes, a 10 céntimos)
    terminaEn8Desde: 100, // desde este precio termina en 8
    ajustes: { competencia: -10, rentable: 15 }, // puntos que se restan o suman al %
    conFactura: true, // compra con factura y paga IGV: la ganancia se mide sin IGV
    // La comisión del POS (Culqi) va SIEMPRE dentro del precio, pague como pague: el
    // precio se divide entre (1 − 3 %), así lo que queda después de la comisión es exacto.
    tarjeta: 3,
    tarjetaSiempre: true,
};

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
    if (x >= regla.terminaEn8Desde) return terminadoEn8(x);
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
export function calcular({ costo, flete = 0, ajuste = 'normal' }, regla) {
    const c = Number(costo);
    if (!(c > 0)) return null;
    const f = Number(flete) || 0;
    const base = r2(c + f);
    const pct = porcentajeDe(c, regla, ajuste);
    const comisionPct = (Number(regla.tarjeta) || 0) / 100;
    const t = regla.tarjetaSiempre === false ? 0 : comisionPct;
    // Costo + ganancia, y encima lo que se lleva la tarjeta (dividiendo, no sumando).
    const conPct = (base * (1 + pct / 100)) / (1 - t);
    const porDocena = c < regla.docenaHasta;
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
 * Varios productos pegados (de una lista, una factura copiada, un WhatsApp). Una línea
 * por producto: el último número es el costo; «x 36» o «36 und» es la cantidad.
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
        if (r.porDocena) partes.push(`docena ${s(r.docena)} (${s(r.docenaUnidad)} c/u)`, `suelto ${s(r.suelto)}`);
        else partes.push(`precio ${s(r.suelto)}`);
        partes.push(`clave ${clave(costo, r.porcentaje, fecha)}`);
        return partes.join(' · ');
    }).join('\n');
}
