
import crypto from 'crypto';

export function calcularHash(fila) {
    const copia = { ...fila };
    delete copia.Imagen;
    console.log('voy a hashear: ', copia)
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
