/**
 * Sus precios reales, sacados de sus cuadernos (marzo y julio 2026): [costo, precio que puso].
 * Sirven para ajustar la escalera y como prueba: si se cambia la regla, se ve al momento
 * si empeora. Sin nombres a propósito: la regla es general.
 *   docena: lo que se vende por docena (el precio es por unidad, de la docena).
 *   suelto: lo que tiene un solo precio.
 * Se dejaron afuera dos dudosos (un código mal escrito y un precio corregido encima).
 */
export const DOCENA = [
    [1.0, 1.6], [1.2, 2.1], [1.5, 2.2], [1.6, 2.4], [1.9, 3.2], [2.5, 4.3], [2.6, 4.6], [2.7, 4.6],
    [2.8, 4.2], [3.0, 5.4], [3.5, 5.3], [3.8, 5.9], [3.9, 6.6], [3.9, 7.0], [8.5, 11.5], [9.0, 12.15],
    [9.5, 12.9], [9.6, 14.0], [10, 15], [12, 17], [13, 18.5], [14, 20], [16, 23.1],
];
export const SUELTO = [
    [18, 30], [24, 40], [42, 62], [44, 65], [44, 78], [47, 70], [48, 75], [58, 95],
    [73, 110], [87, 130], [95, 135], [151, 208], [157, 198], [167, 208], [250, 338],
];
