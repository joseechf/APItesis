import inicializar from "./inicializar.js";
import { generarConsultaInsert, generarConsultaUpdate, generarConsultaDelete } from '../util/generarConsultas.js';
import { TablaSyncRemote } from '../router/sincronizacion/metodoSinc.js'

import { tablas } from "../util/detallesTabla.js";

export async function conectar() {
    try {
        const respuesta = await inicializar()
        if (respuesta.status !== 200) {
            throw respuesta.error
        }
        const cliente = respuesta.data
        return cliente
    } catch (error) {
        console.log('PROBLEMA DE CONEXION CON BD: ', error)
        throw { ok: false, error }
    }
}

export async function select(consulta, atributo = null) {
    let respuesta
    try {
        const cliente = await conectar()
        if (atributo != null) {
            respuesta = await cliente.query(consulta, [atributo])
        } else {
            respuesta = await cliente.query(consulta)
        }
        return respuesta
    } catch (error) {
        const errorFormateado = {
            code: error.code,
            tablaAfectada: error.table,
            constraint: error.constraint,
            message: error.message,
        }
        return { ok: false, errorFormateado };
    }
}

export async function insert(consulta, atributos) {
    try {
        const cliente = await conectar()
        console.log('inicio insercion')
        const respuesta = await cliente.query(consulta, atributos)
        console.log('fin insercion')
        return { ok: true, fila: respuesta.rows[0] }
    } catch (error) {
        const errorFormateado = {
            code: error.code,
            tablaAfectada: error.table,
            constraint: error.constraint,
            message: error.message,
        }
        return { ok: false, errorFormateado };
    }
}

/*
export async function insertGenerico(cliente, config) {
    console.log('insert generico')
    const {
        tablaPrincipal,
        camposPrincipales,
        valoresPrincipales,
        relaciones = []
    } = config
    console.log(config)
    try {
        // INSERT principal
        const consultaPrincipal =
            generarConsultaInsert(tablaPrincipal, camposPrincipales)
        //console.log('consulta: ',consultaPrincipal, ' valores: ', valoresPrincipales)
        const { rows } = await cliente.query(
            consultaPrincipal,
            valoresPrincipales
        )

        const filaInsertada = rows[0]

        // INSERT relaciones
        for (const rel of relaciones) {
            const {
                tabla,
                campos,
                filas,
                mapValores
            } = rel
            console.log('rel: ', rel)
            if (!filas?.length) continue

            const consultaRel = generarConsultaInsert(tabla, campos)
            for (const fila of filas) {
                console.log(consultaRel)
                await cliente.query(
                    consultaRel,
                    mapValores(fila, filaInsertada)
                )
            }
        }

        return { ok: true, data: filaInsertada }

    } catch (error) {
        return {
            ok: false,
            errorFormateado: {
                code: error.code,
                table: error.table,
                constraint: error.constraint,
                message: error.message
            }
        }
    }
}*/




export async function insertFloraCompleta(cliente, fila) {
    const sync = new TablaSyncRemote(cliente.pool)

    try {

        const tablaFlora = tablas.find(t => t.tabla === 'Flora')

        const filaFlora = {}
        for (const campo of tablaFlora.campos) {
            if (fila[campo] !== undefined) {
                filaFlora[campo] = fila[campo]
            }
        }

        const camposFlora = ['nombre_cientifico', ...Object.keys(filaFlora)]
        const valoresFlora = [fila.nombre_cientifico, ...Object.values(filaFlora)]

        let consulta = generarConsultaInsert(tablaFlora.tabla, camposFlora)
        await cliente.query(consulta, valoresFlora)

        for (const tabla of tablas) {
            if (tabla.tabla === 'Flora' /*|| tabla.tabla === 'Imagen'*/) continue

            const datosArray = fila[tabla.tabla] ?? []
            if (!Array.isArray(datosArray) || datosArray.length === 0) continue

            // borrar previos
            await cliente.query(
                `DELETE FROM ${tabla.tabla} WHERE nombre_cientifico = $1`,
                [fila.nombre_cientifico]
            )

            consulta = generarConsultaInsert(
                tabla.tabla,
                [...tabla.campos, 'nombre_cientifico']
            )

            for (const dato of datosArray) {
                await cliente.query(
                    consulta,
                    [...Object.values(dato), fila.nombre_cientifico]
                )
            }
        }

        await sync.registrarUpsert(cliente, fila)

        return { ok: true }

    } catch (error) {
        return {
            ok: false,
            errorFormateado: {
                code: error.code,
                tablaAfectada: error.table,
                constraint: error.constraint,
                message: error.message,
            }
        }
    }
}




export async function deleteById(consulta, atributo) {
    try {
        const cliente = await conectar()
        const respuesta = await cliente.query(consulta, [atributo])
        return { ok: true, fila: respuesta }
    } catch (error) {
        const errorFormateado = {
            code: error.code,
            tablaAfectada: error.table,
            constraint: error.constraint,
            message: error.message,
        }
        return { ok: false, errorFormateado };
    }
}


export async function deleteByIdSinc(consulta, nombre_cientifico) {
    const cliente = await conectar()
    const sync = new TablaSyncRemote(cliente.pool)

    try {
        await cliente.query('BEGIN')

        await sync.registrarBorrado(cliente, nombre_cientifico)

        const respuesta = await cliente.query(
            consulta,
            [nombre_cientifico]
        )

        await cliente.query('COMMIT')
        return { ok: true, fila: respuesta }

    } catch (error) {
        await cliente.query('ROLLBACK')

        return {
            ok: false,
            errorFormateado: {
                code: error.code,
                tablaAfectada: error.table,
                constraint: error.constraint,
                message: error.message,
            }
        }
    } finally {
        cliente.release()
    }
}



export async function update(consulta, atributos) {
    try {
        const cliente = await conectar()
        const respuesta = await cliente.query(consulta, atributos)
        return { ok: true, respuesta };
    } catch (error) {
        const errorFormateado = {
            code: error.code,
            tablaAfectada: error.table,
            constraint: error.constraint,
            message: error.message,
        }
        return { ok: false, errorFormateado };
    }
}

/*export async function updateFlora(cliente, fila, nombre_cientifico) {
    try {
        let filaFiltrada = {}
        const tablaFlora = tablas.find(t => t.tabla === 'Flora')
        for (const campo of tablaFlora.campos) {
            if (fila[campo] !== undefined) {
                filaFiltrada[campo] = fila[campo]
            }
        }
        if (Object.keys(filaFiltrada).length > 0) {
            await updateTablaSimple(cliente, tablaFlora.tabla, filaFiltrada, nombre_cientifico)
        }
        for (const tabla of tablas) {
            if (tabla.tabla === 'Flora') continue
            const datosArray = fila[tabla.tabla] ?? [];
            if (!Array.isArray(datosArray) || datosArray.length == 0) continue
            await auxiliarUpdate(
                cliente,
                tabla.campos,
                datosArray,
                nombre_cientifico,
                tabla.tabla
            )
        }
        console.log('actualizacion Completa Flora terminada... ')
        return { ok: true }
    } catch (error) {
        const errorFormateado = {
            code: error.code,
            tablaAfectada: error.table,
            constraint: error.constraint,
            message: error.message,
        }
        return { ok: false, errorFormateado };
    }
}*/


export async function updateFlora(cliente, fila, nombre_cientifico) {
    const sync = new TablaSyncRemote(cliente.pool)

    try {
        await cliente.query('BEGIN')

        const tablaFlora = tablas.find(t => t.tabla === 'Flora')

        const filaFiltrada = {}
        for (const campo of tablaFlora.campos) {
            if (fila[campo] !== undefined) {
                filaFiltrada[campo] = fila[campo]
            }
        }

        if (Object.keys(filaFiltrada).length > 0) {
            await updateTablaSimple(
                cliente,
                tablaFlora.tabla,
                filaFiltrada,
                nombre_cientifico
            )
        }

        for (const tabla of tablas) {
            if (
                tabla.tabla === 'Flora' /*||
                tabla.tabla === 'Imagen'*/
            ) continue

            const datosArray = fila[tabla.tabla]
            if (!Array.isArray(datosArray)) continue

            await auxiliarUpdate(
                cliente,
                tabla.campos,
                datosArray,
                nombre_cientifico,
                tabla.tabla
            )
        }

        const especieCompleta = {
            ...fila,
            nombre_cientifico
        }

        await sync.registrarUpsert(cliente, especieCompleta)

        await cliente.query('COMMIT')
        console.log('actualizacion Completa Flora terminada...')
        return { ok: true }

    } catch (error) {
        await cliente.query('ROLLBACK')

        return {
            ok: false,
            errorFormateado: {
                code: error.code,
                tablaAfectada: error.table,
                constraint: error.constraint,
                message: error.message,
            }
        }
    }
}


async function updateTablaSimple(cliente, tabla, filaFiltrada, nombre_cientifico) {
    const consulta = generarConsultaUpdate(tabla, Object.keys(filaFiltrada), 'nombre_cientifico')
    console.log(consulta)
    try {
        await cliente.query(consulta, [...Object.values(filaFiltrada), nombre_cientifico]);
    } catch (error) {
        console.error(error)
        throw new Error(`PROBLEMA UPDATE: ${error.message}`);
    }
}

async function auxiliarUpdate(cliente, campos, atributos, nombre_cientifico, tabla) {
    console.log('atributos en auxiliar: ', atributos)
    let consulta = generarConsultaDelete(tabla, 'nombre_cientifico')
    try {
        if (Array.isArray(atributos)) {
            await cliente.query(
                consulta,
                [nombre_cientifico]
            )
            consulta = generarConsultaInsert(tabla, [...campos, 'nombre_cientifico'])
            for (const atributo of atributos) {
                await cliente.query(
                    consulta,
                    [...Object.values(atributo), nombre_cientifico]
                )
            }
        }
    } catch (error) {
        throw new Error(`PROBLEMA UPDATE: ${error.message}`);
    }
}


