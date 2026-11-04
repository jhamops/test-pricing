// node --test   (sin dependencias)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REGLA_INICIAL as R, calcular, clave, familiaDe, fletePorUnidad, leerPegado, redondear, textoParaCopiar } from './precios.js';

const fam = (nombre) => familiaDe(nombre, R.familias);
const precio = (nombre, costo, extra = {}) => calcular({ costo, familia: fam(nombre), ...extra }, R);

test('reconoce la familia por el nombre', () => {
    assert.equal(fam('Valla fija 20 cm').id, 'vallas');
    assert.equal(fam('Aro 40cm').id, 'aros');
    assert.equal(fam('ULA 65 cm').id, 'ulas');
    assert.equal(fam('Porta estaca plana').id, 'estacas');
    assert.equal(fam('Escalera 10P modal').id, 'escaleras');
    assert.equal(fam('Cinta demarcatoria').id, 'cintas');
    assert.equal(fam('Silbato'), null);
    assert.equal(fam('Cuaderno Aroma'), null, '«aro» dentro de otra palabra no cuenta');
});

test('los precios del cuaderno de marzo salen igual (o a 10 céntimos)', () => {
    // [nombre, costo, docena c/u del cuaderno]
    const cuaderno = [
        ['Valla fija 30 cm', 12, 17.0], ['Valla fija 40 cm', 13, 18.5], ['Valla fija 50 cm', 14, 20.0],
        ['Aro 30 cm', 1.9, 3.2], ['Aro 50 cm', 2.7, 4.6], ['Ula 55 cm', 8.5, 11.5], ['Ula 65 cm', 9.5, 12.9],
        ['Varilla 1.00', 2.6, 4.6], ['Porta estaca plana', 9.6, 14.0],
    ];
    for (const [n, c, esperado] of cuaderno) {
        const r = precio(n, c);
        assert.ok(Math.abs(r.docenaUnidad - esperado) <= 0.11, `${n}: ${r.docenaUnidad} vs ${esperado}`);
        assert.equal(r.docena, Math.round(r.docenaUnidad * 12 * 100) / 100);
    }
});

test('las escaleras van solo sueltas, con el porcentaje directo', () => {
    const r = precio('Escalera 10P modal', 24);
    assert.equal(r.docena, null);
    assert.equal(r.suelto, 40);
    assert.equal(precio('Escalera 6P PVC', 18).suelto, 30);
    assert.equal(precio('Cinta demarcatoria', 42).suelto, 62); // como en el cuaderno
});

test('lo que no es de ninguna familia usa la escalera por costo', () => {
    assert.equal(precio('Silbato', 2).porcentaje, 70);
    assert.equal(precio('Cono 30 cm', 6).porcentaje, 55);
    assert.equal(precio('Pelota', 12).porcentaje, 45);
    assert.equal(precio('Red de vóley', 42).porcentaje, 47);
});

test('el porcentaje propio de un producto manda', () => {
    assert.equal(precio('Valla fija 20 cm', 10, { propio: 50 }).docenaUnidad, 15);
});

test('lo que le queda: con factura se descuenta el IGV', () => {
    const r = precio('Valla fija 20 cm', 10, { propio: 50 });
    assert.equal(r.ganas, 5);
    assert.equal(r.teQueda, 4.24); // (15 - 10) / 1.18
    assert.equal(calcular({ costo: 10, propio: 50 }, { ...R, conFactura: false }).teQueda, 5);
    assert.equal(r.conTarjeta, 3.79); // 4.24 - 3 % de 15
});

test('el flete se reparte entre las unidades y sube el precio', () => {
    assert.equal(fletePorUnidad(60, [{ cantidad: 12 }, { cantidad: 18 }]), 2);
    assert.equal(fletePorUnidad(60, [{ cantidad: null }]), 0);
    const r = precio('Valla fija 20 cm', 10, { propio: 50, flete: 2 });
    assert.equal(r.costoConFlete, 12);
    assert.equal(r.docenaUnidad, 18);
});

test('la clave del cuaderno', () => {
    const marzo = new Date(2026, 2, 26);
    assert.equal(clave(10, 50, marzo), '03 10 26 50');
    assert.equal(clave(9.6, 45, marzo), '03 9/6 26 45');
    assert.equal(clave(1.2, 75, marzo), '03 1/2 26 75');
});

test('pegar varios productos de una vez', () => {
    const l = leerPegado('Valla fija 20 cm 10\nAro 20cm 1.20 x 36\n\nUla 65 cm  S/ 9,50  24u\nsin precio\nEscalera 6P - 18');
    assert.deepEqual(l, [
        { nombre: 'Valla fija 20 cm', costo: 10, cantidad: null },
        { nombre: 'Aro 20cm', costo: 1.2, cantidad: 36 },
        { nombre: 'Ula 65 cm', costo: 9.5, cantidad: 24 },
        { nombre: 'Escalera 6P', costo: 18, cantidad: null },
    ]);
});

test('redondeos y texto para copiar', () => {
    assert.equal(redondear(12.76, 0.5), 13);
    assert.equal(redondear(4.59, 0.1), 4.6);
    const r = precio('Valla fija 20 cm', 10, { propio: 50 });
    assert.equal(textoParaCopiar([{ nombre: 'Valla 20', costo: 10, r }], new Date(2026, 2, 1)),
        'Valla 20 · docena S/ 180.00 (S/ 15.00 c/u) · suelto S/ 18.50 · clave 03 10 26 50');
});
