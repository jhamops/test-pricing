// node --test   (sin dependencias)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PORCENTAJES, REGLA_INICIAL as R, calcular, clave, escalonDe, fleteDelProducto, fletePorUnidad, leerPegado, porcentajeDe, redondearPrecio, terminadoEn8, textoParaCopiar } from './precios.js';
const SIN_TARJETA = { ...R, tarjetaSiempre: false };
import { DOCENA, SUELTO } from './precios-reales.js';

test('lo barato lleva más porcentaje y lo caro menos (la escalera)', () => {
    assert.equal(porcentajeDe(3, R), 60);
    assert.equal(porcentajeDe(12, R), 40);
    assert.equal(porcentajeDe(40, R), 50);
    assert.equal(porcentajeDe(100, R), 40);
    assert.equal(porcentajeDe(200, R), 25);
    assert.equal(escalonDe(5, R), 1, 'el borde es del escalón siguiente');
});

test('competencia resta y rentable suma', () => {
    assert.equal(porcentajeDe(12, R, 'competencia'), 30);
    assert.equal(porcentajeDe(12, R, 'rentable'), 55);
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
    assert.equal(r.docenaUnidad, 4.8); // 3 + 60 %
    assert.equal(r.docena, 57.6);
    assert.equal(r.suelto, 5.5); // 4.80 + 15 % = 5.52 → 5.50
    const caro = calcular({ costo: 160 }, SIN_TARJETA);
    assert.equal(caro.porDocena, false);
    assert.equal(caro.docena, null);
    assert.equal(caro.suelto, 198); // 160 + 25 % = 200 → el terminado en 8 más cercano
});

test('la comisión de tarjeta va siempre dentro del precio (dividiendo, no sumando)', () => {
    const sin = calcular({ costo: 100 }, { ...SIN_TARJETA, terminaEn8Desde: 1e9 });
    const con = calcular({ costo: 100 }, { ...R, terminaEn8Desde: 1e9 });
    assert.equal(sin.sinRedondear, 140);
    assert.equal(con.sinRedondear, 144.33); // 140 / 0.97
    assert.equal(con.comision, 4.32); // 3 % de 144
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
    assert.ok(medio <= 0.055, `error medio ${(medio * 100).toFixed(1)} %`);
    assert.ok(errores.filter((e) => e <= 0.08).length >= 29, 'al menos 29 de 38 a menos de 8 %');
    assert.ok(Math.max(...errores) <= 0.14, `el peor, ${(Math.max(...errores) * 100).toFixed(1)} %`);
});

test('lo que le queda: con factura se descuenta el IGV (y la comisión)', () => {
    const r = calcular({ costo: 160 }, SIN_TARJETA);
    assert.equal(r.ganas, 38);
    assert.equal(r.teQueda, 32.2); // 38 / 1.18
    assert.equal(calcular({ costo: 160 }, { ...SIN_TARJETA, conFactura: false }).teQueda, 38);
    const conTarjeta = calcular({ costo: 160 }, R); // 160 × 1.25 / 0.97 = 206.19 → 208
    assert.equal(conTarjeta.suelto, 208);
    assert.equal(conTarjeta.comision, 6.24);
    assert.equal(conTarjeta.teQueda, 34.44); // 48 / 1.18 − 6.24
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
    assert.equal(t, 'Cono · docena S/ 57.60 (S/ 4.80 c/u) · suelto S/ 5.50 · clave 03 3 26 60\nGuitarra · precio S/ 198.00 · clave 03 160 26 25');
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
    assert.equal(sinDocena.suelto, 4.9); // 3 × 1.60 / 0.97 = 4.95 → un solo precio
});

test('el porcentaje que ella toca manda (de 5 en 5, o cualquiera)', () => {
    assert.deepEqual([PORCENTAJES.length, PORCENTAJES[0], PORCENTAJES.at(-1)], [15, 15, 85]);
    // Su caso: costó 73, le pone 50 % → 110 (sin la tarjeta ni el 8, como su cuaderno).
    const suya = { ...SIN_TARJETA, terminaEn8On: false };
    assert.equal(calcular({ costo: 73, pct: 50 }, suya).suelto, 110);
    assert.equal(calcular({ costo: 73, pct: 50 }, suya).porcentaje, 50);
    assert.equal(calcular({ costo: 73, pct: 37 }, suya).porcentaje, 37); // uno aparte, cualquiera
    assert.equal(calcular({ costo: 73, pct: null }, suya).porcentaje, 40); // sin elegir: el sugerido
});
