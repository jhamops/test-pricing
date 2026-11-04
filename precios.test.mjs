// node --test   (sin dependencias)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REGLA_INICIAL as R, calcular, clave, escalonDe, fleteDelProducto, fletePorUnidad, leerPegado, porcentajeDe, redondearPrecio, terminadoEn8, textoParaCopiar } from './precios.js';
const SIN_TARJETA = { ...R, tarjetaSiempre: false };
import { DOCENA, SUELTO } from './precios-reales.js';

test('lo barato lleva más porcentaje y lo caro menos (la escalera)', () => {
    assert.equal(porcentajeDe(3, R), 58);
    assert.equal(porcentajeDe(12, R), 38);
    assert.equal(porcentajeDe(40, R), 52);
    assert.equal(porcentajeDe(100, R), 38);
    assert.equal(porcentajeDe(200, R), 31);
    assert.equal(escalonDe(5, R), 1, 'el borde es del escalón siguiente');
});

test('competencia resta y rentable suma', () => {
    assert.equal(porcentajeDe(12, R, 'competencia'), 28);
    assert.equal(porcentajeDe(12, R, 'rentable'), 53);
});

test('terminado en 8: el más cercano (ya trae su rebaja)', () => {
    assert.equal(terminadoEn8(203.85), 208);
    assert.equal(terminadoEn8(196.25), 198);
    assert.equal(terminadoEn8(208.75), 208);
    assert.equal(terminadoEn8(337.5), 338);
    assert.equal(terminadoEn8(100), 98);
});

test('el redondeo depende del precio', () => {
    assert.equal(redondearPrecio(4.36, R), 4.4); // lo barato, a 10 céntimos
    assert.equal(redondearPrecio(64.7, R), 65); // lo mediano, al sol
    assert.equal(redondearPrecio(129.6, R), 128); // lo caro, termina en 8
});

test('lo barato sale por docena y suelto; lo caro, un solo precio', () => {
    const r = calcular({ costo: 3 }, SIN_TARJETA);
    assert.equal(r.porDocena, true);
    assert.equal(r.docenaUnidad, 4.7); // 3 + 58 % = 4.74
    assert.equal(r.docena, 56.4);
    assert.equal(r.suelto, 5.5); // 4.70 + 15 % = 5.41 → 5.50
    const caro = calcular({ costo: 160 }, SIN_TARJETA);
    assert.equal(caro.porDocena, false);
    assert.equal(caro.docena, null);
    assert.equal(caro.suelto, 208); // 160 + 31 % = 209.60 → el terminado en 8 más cercano
});

test('la comisión de tarjeta va siempre dentro del precio (dividiendo, no sumando)', () => {
    const sin = calcular({ costo: 100 }, { ...SIN_TARJETA, terminaEn8Desde: 1e9 });
    const con = calcular({ costo: 100 }, { ...R, terminaEn8Desde: 1e9 });
    assert.equal(sin.sinRedondear, 138);
    assert.equal(con.sinRedondear, 142.27); // 138 / 0.97
    assert.equal(con.comision, 4.26); // 3 % de 142
    // Lo que gana es lo mismo que sin tarjeta, ya descontada la comisión (± el redondeo).
    assert.ok(Math.abs(con.ganas - sin.ganas) < 1, `${con.ganas} vs ${sin.ganas}`);
    // Si le pagan en efectivo, le queda la comisión de más.
    assert.equal(con.enEfectivo, Math.round((con.teQueda + con.comision) * 100) / 100);
});

test('sus 38 precios reales: la regla general se equivoca poco (y avisa si empeora)', () => {
    // Con la regla tal como sale por defecto (tarjeta adentro, docena, terminado en 8).
    const datos = [...DOCENA.map(([c, p]) => ({ c, p })), ...SUELTO.map(([c, p]) => ({ c, p }))];
    const errores = datos.map(({ c, p }) => {
        const r = calcular({ costo: c }, R);
        return Math.abs((r.porDocena ? r.docenaUnidad : r.suelto) - p) / p;
    });
    const medio = errores.reduce((a, b) => a + b, 0) / errores.length;
    assert.equal(datos.length, 38);
    assert.ok(medio <= 0.05, `error medio ${(medio * 100).toFixed(1)} %`);
    assert.ok(errores.filter((e) => e <= 0.08).length >= 29, 'al menos 29 de 38 a menos de 8 %');
    assert.ok(Math.max(...errores) <= 0.14, `el peor, ${(Math.max(...errores) * 100).toFixed(1)} %`);
});

test('lo que le queda: con factura se descuenta el IGV (y la comisión)', () => {
    const r = calcular({ costo: 160 }, SIN_TARJETA);
    assert.equal(r.ganas, 48);
    assert.equal(r.teQueda, 40.68); // 48 / 1.18
    assert.equal(calcular({ costo: 160 }, { ...SIN_TARJETA, conFactura: false }).teQueda, 48);
    const conTarjeta = calcular({ costo: 160 }, R); // 160 × 1.31 / 0.97 = 216.08 → 218
    assert.equal(conTarjeta.suelto, 218);
    assert.equal(conTarjeta.comision, 6.54);
    assert.equal(conTarjeta.teQueda, 42.61); // 58 / 1.18 − 6.54
});

test('el flete se reparte entre las unidades y sube el precio', () => {
    assert.equal(fletePorUnidad(60, [{ cantidad: 12 }, { cantidad: 18 }]), 2);
    assert.equal(fletePorUnidad(60, [{ cantidad: null }]), 0);
    assert.equal(calcular({ costo: 10, flete: 2 }, R).costoConFlete, 12);
    // Un solo producto: su flete entre sus unidades, o todo si no dice cuántas.
    assert.equal(fleteDelProducto(30, 12), 2.5);
    assert.equal(fleteDelProducto(8, null), 8);
    assert.equal(fleteDelProducto('', 5), 0);
});

test('la clave del cuaderno', () => {
    const marzo = new Date(2026, 2, 26);
    assert.equal(clave(10, 50, marzo), '03 10 26 50');
    assert.equal(clave(9.6, 45, marzo), '03 9/6 26 45');
});

test('pegar varios productos de una vez', () => {
    const l = leerPegado('Valla fija 20 cm 10 x 12\nAro 20cm 1.20 x 36\n\nUla 65 cm  S/ 9,50  24u\nsin precio\nEscalera 6P - 18');
    assert.deepEqual(l, [
        { nombre: 'Valla fija 20 cm', costo: 10, cantidad: 12 },
        { nombre: 'Aro 20cm', costo: 1.2, cantidad: 36 },
        { nombre: 'Ula 65 cm', costo: 9.5, cantidad: 24 },
        { nombre: 'Escalera 6P', costo: 18, cantidad: null },
    ]);
});

test('texto para copiar', () => {
    const marzo = new Date(2026, 2, 1);
    const t = textoParaCopiar([
        { nombre: 'Cono', costo: 3, r: calcular({ costo: 3 }, SIN_TARJETA) },
        { nombre: 'Guitarra', costo: 160, r: calcular({ costo: 160 }, SIN_TARJETA) },
    ], marzo);
    assert.equal(t, 'Cono · docena S/ 56.40 (S/ 4.70 c/u) · suelto S/ 5.50 · clave 03 3 26 58\nGuitarra · precio S/ 208.00 · clave 03 160 26 31');
});

test('el flete se suma tal cual, sin ganancia encima (su ejemplo: 100 + 30 % + 2 = 132)', () => {
    const suya = { ...SIN_TARJETA, escalera: [{ hasta: null, pct: 30 }], porDocenaOn: false, terminaEn8On: false };
    assert.equal(calcular({ costo: 100, flete: 2 }, suya).suelto, 132);
    // Con la tarjeta siempre adentro: 132 / 0.97 = 136.08 → 136.
    assert.equal(calcular({ costo: 100, flete: 2 }, { ...suya, tarjetaSiempre: true }).suelto, 136);
});

test('terminar en 8 es opcional', () => {
    assert.equal(redondearPrecio(203.85, R), 208);
    assert.equal(redondearPrecio(203.85, { ...R, terminaEn8On: false }), 204); // al sol
});

test('sacar precio por docena es opcional', () => {
    assert.equal(calcular({ costo: 3 }, R).porDocena, true);
    const sinDocena = calcular({ costo: 3 }, { ...R, porDocenaOn: false });
    assert.equal(sinDocena.porDocena, false);
    assert.equal(sinDocena.docena, null);
    assert.equal(sinDocena.suelto, 4.9); // 3 × 1.58 / 0.97 = 4.89 → un solo precio
});
