// node --test   (sin dependencias)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PORCENTAJES, REGLA_INICIAL as R, calcular, clave, escalonDe, fleteDelProducto, fletePorUnidad, leerLista, leerPegado, porcentajeDe, redondearPrecio, terminadoEn8, textoParaCopiar } from './precios.js';
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
    const sin = { docena: false, flete: '' };
    assert.deepEqual(l, [
        { nombre: 'Valla fija 20 cm', costo: 10, cantidad: 12, ...sin },
        { nombre: 'Aro 20cm', costo: 1.2, cantidad: 36, ...sin },
        { nombre: 'Ula 65 cm', costo: 9.5, cantidad: 24, ...sin },
        { nombre: 'Escalera 6P', costo: 18, cantidad: null, ...sin },
    ]);
});

test('pegar: los ejemplos de la ventana dicen la verdad', () => {
    const [cono, pelota, silbato, factura] = leerPegado('Cono 30 cm 3.50\nPelota de vóley 18 x 6\nSilbato 28.80 la docena\n24 Cono 3.50 84.00');
    assert.deepEqual([cono.nombre, cono.costo, cono.cantidad], ['Cono 30 cm', 3.5, null]); // el 30 cm es del nombre
    assert.deepEqual([pelota.costo, pelota.cantidad], [18, 6]);
    assert.deepEqual([silbato.costo, silbato.docena], [2.4, true]); // 28.80 / 12
    assert.deepEqual([factura.nombre, factura.costo, factura.cantidad], ['Cono', 3.5, 24]); // el total se descarta
});

test('pegar: factura, Excel, dictado, flete y lo que no se entiende', () => {
    const f = leerPegado('24 UND CONO 30CM 3.50 84.00')[0];
    assert.deepEqual([f.costo, f.cantidad], [3.5, 24]);
    const d = leerPegado('Cono de 30 centímetros a 3 soles 50 por 24')[0];
    assert.deepEqual([d.nombre, d.costo, d.cantidad], ['Cono de 30 centímetros', 3.5, 24]);
    assert.equal(leerPegado('Mancuerna 2 kg 22 x 4 flete 8')[0].flete, '8');
    assert.equal(leerPegado('Silbato 2.40 doc')[0].docena, true);
    assert.equal(leerPegado('Guitarra 1,200.00')[0].costo, 1200);
    const excel = leerLista('Producto\tCantidad\tCosto\nCono 30 cm\t24\t3.50\nAro\t36\tS/ 1.20\nTotal\t\t');
    assert.deepEqual(excel.productos.map((p) => [p.nombre, p.cantidad, p.costo]), [['Cono 30 cm', 24, 3.5], ['Aro', 36, 1.2]]);
    assert.deepEqual(excel.saltadas, ['Total']);
    assert.deepEqual(leerLista('Cono 3.50\nnada que ver').sinPrecio, ['nada que ver']); // se avisa, no se pierde callado
});

test('pegar: Google Lens copia la tabla por columnas y se vuelven a armar las filas', () => {
    const lens = ['DISTRIBUIDORA DEPORTES SAC', 'RUC 20601234567', 'FACTURA ELECTRÓNICA', 'F001-000123',
        'Cant.', 'Descripción', 'P. Unit.', 'Importe',
        'Cono 30 cm naranja', 'Aro plástico 60 cm', 'Pelota de vóley N°5', 'Silbato metálico',
        '24', '36', '6', '12', '3.50', '1.20', '18.00', '2.40', '84.00', '43.20', '108.00', '28.80',
        'OP. GRAVADA 223.73', 'IGV 18% 40.27', 'TOTAL S/ 264.00'].join('\n');
    const { productos, sinPrecio } = leerLista(lens);
    assert.deepEqual(productos.map((p) => [p.nombre, p.cantidad, p.costo]), [
        ['Cono 30 cm naranja', 24, 3.5], ['Aro plástico 60 cm', 36, 1.2], ['Pelota de vóley N°5', 6, 18], ['Silbato metálico', 12, 2.4],
    ]);
    assert.deepEqual(sinPrecio, []);
    // Solo nombres y una columna de precios, sin cantidades.
    assert.deepEqual(leerPegado('Cono\nAro\nPelota\n3.50\n1.20\n18').map((p) => [p.nombre, p.costo]), [['Cono', 3.5], ['Aro', 1.2], ['Pelota', 18]]);
});

test('pegar: de una factura entera se saltan encabezado, totales y pie', () => {
    const { productos, sinPrecio, saltadas } = leerLista(['RUC: 20601234567', 'Fecha de emisión: 12/03/2026', 'CANT UM DESCRIPCIÓN P.UNIT IMPORTE',
        '24 NIU CONO 30 CM NARANJA 3.50 84.00', '36 NIU | ARO PLASTICO 60 CM | 1.20 | 43.20', 'TOTAL 127.20', 'Telf: 064 123456'].join('\n'));
    assert.deepEqual(productos.map((p) => [p.nombre, p.cantidad, p.costo]), [['CONO 30 CM NARANJA', 24, 3.5], ['ARO PLASTICO 60 CM', 36, 1.2]]);
    assert.deepEqual(sinPrecio, []);
    assert.equal(saltadas.length, 5);
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

test('la hoja de Excel: una fila por producto, números como números, y los totales', async () => {
    const { filasExcel, COLUMNAS_EXCEL } = await import('./precios.js');
    const marzo = new Date(2026, 2, 1);
    const productos = [
        { nombre: 'Scooter', costo: 85, cantidad: 2, flete: '4', pct: 45 },
        { nombre: 'Cono', costo: 3, cantidad: 24, flete: '', pct: 50, docena: true },
        { nombre: 'Sin cantidad', costo: 10, cantidad: null, flete: '', pct: 40 },
    ];
    const { columnas, filas, totales } = filasExcel(productos, SIN_TARJETA, 26, marzo);
    assert.deepEqual(columnas, COLUMNAS_EXCEL);
    assert.equal(filas.length, 3);
    // Scooter: su flete 4 / 2 = 2 c/u, más 26 / 26 unidades = 1 → 3 c/u; costo con flete 88.
    const [scooter, cono, sinCant] = filas;
    assert.deepEqual(scooter.slice(0, 7), ['Scooter', 85, 2, 3, 88, 45, 0]);
    assert.equal(scooter[9], calcular({ costo: 85, pct: 45, flete: 3 }, SIN_TARJETA).suelto);
    assert.equal(scooter[12], '03 85 26 45');
    assert.equal(typeof cono[8], 'number'); // la docena, como número
    assert.equal(cono[3], 1); // 26 / 26 unidades
    assert.equal(sinCant[2], null); // sin cantidad: celda vacía y sin flete de la compra
    assert.equal(sinCant[3], 0);
    assert.ok(totales && totales.invertido === 88 * 2 + 4 * 24, JSON.stringify(totales));
    // Sin ninguna cantidad no hay totales que mostrar.
    assert.equal(filasExcel([productos[2]], SIN_TARJETA).totales, null);
});

test('por docena solo si ella lo marca en ese producto', () => {
    assert.equal(calcular({ costo: 3, pct: 50, docena: false }, R).porDocena, false);
    assert.equal(calcular({ costo: 3, pct: 50, docena: false }, R).docena, null);
    assert.equal(calcular({ costo: 40, pct: 50, docena: true }, R).porDocena, true); // también lo caro, si lo vende por mayor
    assert.equal(calcular({ costo: 40, pct: 50, docena: true }, R).docena, Math.round(calcular({ costo: 40, pct: 50, docena: true }, R).docenaUnidad * 12 * 100) / 100);
});

test('pegar: lo leído de una foto se corrige con el importe (punto perdido, cantidad mal leída, basura)', () => {
    const ocr = [
        '_      24 NIU       CONO DE ENTRENAMIENTO 30 CM NARANJA      —_     350          84.00', // 3.50 sin punto
        '—    6 | NIU  — PELOTA DE VOLEY MIKASA N*5          —_    45.00   27000', // importe sin punto
        '|           38 Inu | ARO PLASTICO 60 CM        1.20               43.20', // 36 leído como 38
        'AlniU | MANCUERNA HEXAGONAL 5 KG          38.90 |             155.60', // la cantidad se perdió
        '"1', 'U', // restos de la cuadrícula
    ].join('\n');
    const { productos, sinPrecio } = leerLista(ocr);
    assert.deepEqual(productos.map((p) => [p.nombre, p.cantidad, p.costo]), [
        ['CONO DE ENTRENAMIENTO 30 CM NARANJA', 24, 3.5],
        ['PELOTA DE VOLEY MIKASA N*5', 6, 45],
        ['ARO PLASTICO 60 CM', 36, 1.2],
        ['MANCUERNA HEXAGONAL 5 KG', 4, 38.9],
    ]);
    assert.deepEqual(sinPrecio, []);
});


test('factura de natación: código, unidad antes de la cantidad, valor sin IGV y precio con IGV', () => {
    const t = ['ITEM CODIGO DESCRIPCION U.M. CANT. V.UNIT. P.UNIT. IMPORTE',
        '1 AR-1E033-101 LENTES DE NATACION ARENA COBRA ULTRA SWIPE NIU 12 52.54 62.00 744.00',
        '3 AR-005556-T28 JAMMER ARENA POWERSKIN ST 2.0 T-28 NIU 6 122.88 145.00 870.00', // la talla T-28 no es cantidad
        '5 AR-91662-20 GORRO DE NATACION ARENA CLASSIC SILICONA NIU 36 15.68 18.50 666.00'].join('\n');
    assert.deepEqual(leerPegado(t).map((p) => [p.nombre, p.cantidad, p.costo]), [
        ['LENTES DE NATACION ARENA COBRA ULTRA SWIPE', 12, 62], // el precio CON IGV (lo que pagó)
        ['JAMMER ARENA POWERSKIN ST 2.0 T-28', 6, 145],
        ['GORRO DE NATACION ARENA CLASSIC SILICONA', 36, 18.5],
    ]);
});

test('foto de factura: lo que no cuadra con el importe se marca para revisar, nunca entra callado', () => {
    // Líneas tal como las leyó Tesseract de una foto de WhatsApp y de una foto torcida.
    const t = ['> | 1|AR:1E033-101 LENTES DE NATACION ARENA COBRAULTRASWPE ÍNIU *— 12 5254! 6200 74400!', // puntos perdidos
        '" y   4 | AR-002755-T30 — JAMMER ARENA TEAM SOLID T-30    NU   6 5076| 5990 35940',
        '— 1 AR-16032-101 LENTES DE NATACION ARENA COBRA ULTRA SWIPE | NI   12 | sesa[ ezoo| -7e400)  |', // precios ilegibles
        '— | 6/AR-91008-90 | GORRO DE NATACION ARENA POLY JR     [NU | 24 |   e31| ssl 232») —*',
        '4 AR-002755-T30 JAMMER ARENA TEAM SOLID T-30   NIU   6   50.76 159.90   359.40 |', // la raya leída como «1»
        'G.v. 18% SI 542.84'].join('\n');
    const { productos } = leerLista(t, { foto: true });
    const v = productos.map((p) => [p.nombre, p.cantidad, p.costo, Boolean(p.dudoso)]);
    assert.deepEqual(v[0], ['LENTES DE NATACION ARENA COBRAULTRASWPE', 12, 62, false]);
    assert.deepEqual(v[1], ['JAMMER ARENA TEAM SOLID T-30', 6, 59.9, false]);
    assert.equal(v[2][3], true, 'ilegible: a revisar');
    assert.equal(v[3][3], true, 'S/ 232 no cuadra con nada: a revisar');
    assert.deepEqual(v[4], ['JAMMER ARENA TEAM SOLID T-30', 6, 59.9, false]);
    assert.equal(productos.length, 5, 'la línea del IGV no es producto');
});
