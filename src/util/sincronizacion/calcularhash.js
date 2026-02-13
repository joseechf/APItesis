/*import crypto from "crypto";

export function calcularHash(fila) {
    const mapa = construirMapaHash(fila);
    const normalizado = normalizarMapa(mapa);
    return crypto.createHash('sha256').update(normalizado).digest('hex');
}

function normalizarMapa(obj) {
    return JSON.stringify(obj, Object.keys(obj).sort());
}

function construirMapaHash(fila) {
    return {
        id: fila.nombreCientifico,
        flora: {
            nombreCientifico: fila.nombreCientifico,
            daSombra: fila.daSombra,
            florDistintiva: fila.florDistintiva,
            frutaDistintiva: fila.frutaDistintiva,
            saludSuelo: fila.saludSuelo,
            huespedes: fila.huespedes,
            formaCrecimiento: fila.formaCrecimiento,
            pionero: fila.pionero,
            polinizador: fila.polinizador,
            ambiente: fila.ambiente,
            nativoAmerica: fila.nativoAmerica,
            nativoPanama: fila.nativoPanama,
            nativoAzuero: fila.nativoAzuero,
            estrato: fila.estrato,
        },
        nombreComun: fila.nombreComun ?? [],
        origen: fila.origen ?? [],
        utilidad: fila.utilidad ?? [],
    };
}*/
import crypto from 'crypto';

export function calcularHash(fila) {
    const copia = { ...fila };
    delete copia.Imagen;

    const ordenado = Object.keys(copia)
        .sort()
        .reduce((acc, k) => {
            acc[k] = copia[k];
            return acc;
        }, {});

    return crypto
        .createHash('sha256')
        .update(JSON.stringify(ordenado))
        .digest('hex');
}
