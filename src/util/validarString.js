import { tablas } from "./detallesTabla.js";

const PATRON_VALIDO = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s.-]+$/;
const MAX_LENGTH = 100;

export default class ValidadorFlora {

    static validarString(val, campo) {
        if (val === null || val === undefined) return { ok: true, valor: null };

        if (typeof val !== 'string') return { ok: false, error: `${campo}: no es string` };

        const t = val.trim();

        if (!t) return { ok: false, error: `${campo}: vacío` };
        if (t.length > MAX_LENGTH) return { ok: false, error: `${campo}: >${MAX_LENGTH} chars` };
        if (!PATRON_VALIDO.test(t)) return { ok: false, error: `${campo}: chars inválidos` };

        return { ok: true, valor: t };
    }

    static validarInt(val, campo) {
        if (val === null || val === undefined) return { ok: true, valor: null };

        const n = typeof val === 'string' ? parseInt(val, 10) : val;

        if (!Number.isInteger(n) || (n !== 0 && n !== 1)) {
            return { ok: false, error: `${campo}: debe ser 0 o 1` };
        }

        return { ok: true, valor: n };
    }

    static validarValor(val, campo) {
        if (val === null || val === undefined) return { ok: true, valor: null };
        if (typeof val === 'boolean') return { ok: false, error: `${campo}: boolean no permitido` };
        const numerosbooleanos = ['da_sombra', 'salud_suelo', 'pionero', 'nativo_america', 'nativo_panama', 'nativo_azuero']
        if (numerosbooleanos.includes(campo)) {
            return this.validarInt(val, campo)
        } else {
            return this.validarString(val, campo)
        }
    }
    static validarNombre(fileName) {
        const regex = /^[a-zA-Z0-9_-]+_\d+\.jpg$/;
        if (typeof fileName !== 'string' || !regex.test(fileName)) {
            return false
        } else {
            return true
        }
    }
    static validarUrl(url) {
        if (typeof url !== 'string' || url.trim() === '') {
            return { ok: false, error: 'url invalida' };
        }
        const urlLimpia = url.trim();
        try {
            const parsed = new URL(urlLimpia);
            const baseUrl = process.env.PUBLIC_BASE_URL;
            if (!urlLimpia.startsWith(`${baseUrl}/imagenes/`)) {
                return { ok: false, error: 'url invalida' };
            }
            const nombreArchivo = parsed.pathname.split('/').pop();
            if (!this.validarNombre(nombreArchivo)) {
                return { ok: false, error: 'nombre del archivo incorrecto' };
            }

            return { ok: true, valor: urlLimpia };
        } catch {
            return { ok: false, error: 'url invalida' };
        }
    }

    static validarnc(nc) {
        const errores = [];

        if (nc === null || nc === undefined) {
            errores.push('nombre_cientifico: no puede ser null');
        } else if (typeof nc !== 'string') {
            errores.push('nombre_cientifico: debe ser un string');
        } else if (!PATRON_VALIDO.test(nc)) {
            errores.push('nombre_cientifico: caracteres invalidos');
        } else if (nc.length > 30 || nc.length < 2) {
            errores.push('nombre_cientifico: nombre muy largo o pequeño');
        }

        return {
            ok: errores.length === 0,
            errores,
            datos: errores.length === 0 ? nc.trim() : null
        };
    }

    static validar(obj) {
        const errores = [];
        const datos = { Flora: {}, listas: {} };
        const res = this.validarnc(obj.nombre_cientifico)
        if (res.ok) {
            datos.nombre_cientifico = res.datos
        } else {
            errores.push(...res.errores)
        }
        // recorrer tablas 
        for (const tabla of tablas) {

            const nombreTabla = Object.keys(tabla)[0];
            const campos = Object.values(tabla)[0];

            // FLORA (campos planos)
            if (nombreTabla === 'Flora') {
                for (const campo of campos) {
                    const r = this.validarValor(obj[campo], campo);
                    if (!r.ok) errores.push(r.error);
                    else datos.Flora[campo] = r.valor;
                }
                continue;
            }

            const lista = obj[nombreTabla] ?? [];

            // IMAGEN (multi-campo)
            if (nombreTabla === 'Imagen') {
                const imgs = [];

                for (let i = 0; i < lista.length; i++) {
                    const item = lista[i];

                    const url = this.validarUrl(item?.url_foto);
                    const est = this.validarString(item?.estado, `Imagen[${i}].estado`);

                    if (!url.ok) errores.push(url.error);
                    if (!est.ok) errores.push(est.error);

                    if (url.ok && est.ok) {
                        imgs.push({ url: url.valor, estado: est.valor });
                    }
                }

                datos.listas.Imagen = imgs;
                continue;
            }

            // TABLAS SIMPLES (1 campo)
            const campo = Array.isArray(campos) ? campos[0] : campos;
            const resultado = [];

            for (let i = 0; i < lista.length; i++) {
                const r = this.validarValor(lista[i]?.[campo], `${nombreTabla}[${i}].${campo}`);
                if (!r.ok) errores.push(r.error);
                else resultado.push({ [campo]: r.valor });
            }

            datos.listas[nombreTabla] = resultado;
        }

        return {
            ok: errores.length === 0,
            errores,
            datos: errores.length === 0 ? datos : null
        };
    }
}