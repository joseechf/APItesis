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
    let cliente
    try {

        cliente = await conectar()

        let respuesta

        if (atributo != null) {
            respuesta = await cliente.query(consulta, [atributo])
        } else {
            respuesta = await cliente.query(consulta)
        }

        return respuesta

    } catch (error) {

        console.error('--- ERROR EN SELECT ---')
        console.error(error)

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
        if (cliente) {
            cliente.release()
        }
    }
}

export async function insert(consulta, atributos) {
    let cliente
    try {
        console.log('--- INSERT INICIO ---')
        console.log('Consulta:', consulta)
        console.log('Valores:', atributos)

        cliente = await conectar()

        const respuesta = await cliente.query(consulta, atributos)

        console.log('Fila insertada:', respuesta.rows[0])
        console.log('--- INSERT FIN OK ---')

        return { ok: true, fila: respuesta.rows[0] }

    } catch (error) {
        console.error('--- ERROR EN INSERT ---')
        console.error('Consulta que falló:', consulta)
        console.error('Valores enviados:', atributos)
        console.error('Error completo:', error)

        const errorFormateado = {
            code: error.code,
            tablaAfectada: error.table,
            constraint: error.constraint,
            message: error.message,
        }

        return { ok: false, errorFormateado };
    } finally {
        if (cliente) {
            cliente.release()
        }
    }
}


export async function insertFloraCompleta(cliente, datosLimpios, correo) {

    const sync = new TablaSyncRemote(cliente.pool)
    try {
        const tablaFlora = tablas.find(t => 'Flora' in t)
        const camposFlora = ['nombre_cientifico', ...Object.keys(datosLimpios.Flora)]
        const atributos = [datosLimpios.nombre_cientifico, ...Object.values(datosLimpios.Flora)]
        let consulta = generarConsultaInsert(Object.keys(tablaFlora)[0], camposFlora)
        await cliente.query(consulta, atributos)

        for (const tabla of tablas) {

            const nombreTabla = Object.keys(tabla)[0]
            const camposTabla = Object.values(tabla)[0]

            if (nombreTabla === 'Flora') continue

            const datosArray = datosLimpios.listas[nombreTabla] ?? []

            if (!Array.isArray(datosArray) || datosArray.length === 0) {
                continue
            }

            await cliente.query(
                `DELETE FROM ${nombreTabla} WHERE nombre_cientifico = $1`,
                [datosLimpios.nombre_cientifico]
            )

            const campos = Array.isArray(camposTabla)
                ? camposTabla
                : [camposTabla]

            const consulta = generarConsultaInsert(
                nombreTabla,
                [...campos, 'nombre_cientifico']
            )

            for (const dato of datosArray) {
                await cliente.query(
                    consulta,
                    [...Object.values(dato), datosLimpios.nombre_cientifico]
                )
            }
        }

        await sync.registrarUpsert(cliente, datosLimpios, correo)


        return { ok: true }

    } catch (error) {

        console.error('========== ERROR EN INSERT FLORA COMPLETA ==========')

        throw error
    }
}


export async function deleteById(consulta, atributo) {
    let cliente
    try {
        cliente = await conectar()
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
    } finally {
        if (cliente) {
            cliente.release()
        }
    }
}


export async function deleteByIdSinc(nombre_cientifico, correo) {
    let cliente
    const sync = new TablaSyncRemote();

    try {
        cliente = await conectar();
        await cliente.query('BEGIN');

        await sync.registrarBorrado(cliente, nombre_cientifico, correo);

        await cliente.query('COMMIT');
        return { ok: true };

    } catch (error) {
        await cliente.query('ROLLBACK');
        return { ok: false, error };
    } finally {
        cliente.release();
    }
}

/*
export async function update(consulta, atributos) {
    let cliente
    try {
        console.log('--- UPDATE INICIO ---')
        console.log('Consulta:', consulta)
        console.log('Valores:', atributos)

        cliente = await conectar()

        const respuesta = await cliente.query(consulta, atributos)

        console.log('Filas afectadas:', respuesta.rowCount)
        console.log('--- UPDATE FIN OK ---')

        return { ok: true, respuesta };

    } catch (error) {

        console.error('--- ERROR EN UPDATE ---')
        console.error('Consulta que falló:', consulta)
        console.error('Valores enviados:', atributos)
        console.error('Error completo:', error)

        const errorFormateado = {
            code: error.code,
            tablaAfectada: error.table,
            constraint: error.constraint,
            message: error.message,
        }

        return { ok: false, errorFormateado };
    } finally {
        if (cliente) {
            cliente.release()
        }
    }
}*/



export async function updateFlora(cliente, fila, nombre_cientifico, correo) {

    const sync = new TablaSyncRemote(cliente.pool)

    try {

        console.log('========== UPDATE FLORA COMPLETA ==========')

        const tablaFlora = tablas.find(t => 'Flora' in t)

        if (!tablaFlora) {
            throw new Error('No se encontró configuración de tabla Flora')
        }

        const filaFiltrada = {}

        for (const campo of tablaFlora.Flora) {
            if (fila[campo] !== undefined) {
                filaFiltrada[campo] = fila[campo]
            }
        }

        console.log('Campos filtrados para Flora:', filaFiltrada)

        if (Object.keys(filaFiltrada).length > 0) {
            console.log('Actualizando tabla Flora...')
            await updateTablaSimple(cliente, 'Flora', filaFiltrada, nombre_cientifico)
            console.log('Update Flora OK')
        } else {
            console.log('No hay campos para actualizar en Flora')
        }

        for (const tabla of tablas) {

            const nombreTabla = Object.keys(tabla)[0]
            const camposTabla = Object.values(tabla)[0]

            if (nombreTabla === 'Flora') continue

            const datosArray = fila[nombreTabla]

            console.log(`Procesando tabla hija: ${nombreTabla}`)
            console.log('Datos recibidos:', datosArray)

            if (!Array.isArray(datosArray)) {
                console.log('No es array, se omite:', nombreTabla)
                continue
            }

            const campos = Array.isArray(camposTabla)
                ? camposTabla
                : [camposTabla]

            await auxiliarUpdate(
                cliente,
                campos,
                datosArray,
                nombre_cientifico,
                nombreTabla
            )

            console.log('Tabla hija actualizada:', nombreTabla)
        }

        const especieCompleta = {
            ...fila,
            nombre_cientifico
        }

        console.log('Registrando sincronización...')
        await sync.registrarUpsert(cliente, especieCompleta, correo)
        console.log('Sync OK')

        console.log('========== FIN UPDATE FLORA OK ==========')

        return { ok: true }

    } catch (error) {

        console.error('========== ERROR EN UPDATE FLORA ==========')
        console.error('Nombre científico:', nombre_cientifico)
        console.error('Error completo:', error)

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

    const consulta = generarConsultaUpdate(
        tabla,
        Object.keys(filaFiltrada),
        'nombre_cientifico'
    )

    console.log('--- updateTablaSimple ---')
    console.log('Tabla:', tabla)
    console.log('Consulta generada:', consulta)
    console.log('Valores:', [...Object.values(filaFiltrada), nombre_cientifico])

    try {

        const resultado = await cliente.query(
            consulta,
            [...Object.values(filaFiltrada), nombre_cientifico]
        )

        console.log('Filas afectadas:', resultado.rowCount)

    } catch (error) {

        console.error('ERROR en updateTablaSimple')
        console.error('Consulta:', consulta)
        console.error('Valores:', [...Object.values(filaFiltrada), nombre_cientifico])
        console.error('Error:', error)

        throw error
    }
}

async function auxiliarUpdate(cliente, campos, atributos, nombre_cientifico, tabla) {

    console.log('--- auxiliarUpdate ---')

    let consulta = generarConsultaDelete(tabla, 'nombre_cientifico')

    try {

        if (Array.isArray(atributos)) {

            await cliente.query(
                consulta,
                [nombre_cientifico]
            )

            console.log('DELETE OK')
            if (atributos.length) {
                consulta = generarConsultaInsert(
                    tabla,
                    [...campos, 'nombre_cientifico']
                )
            }

            console.log('Consulta INSERT generada:', consulta)

            for (const atributo of atributos) {

                console.log('Insertando atributo:', atributo)

                await cliente.query(
                    consulta,
                    [...Object.values(atributo), nombre_cientifico]
                )
            }

            console.log('Inserciones completadas en:', tabla)
        }

    } catch (error) {

        console.error('ERROR en auxiliarUpdate')
        console.error('Tabla:', tabla)
        console.error('Error:', error)

        throw error
    }
}


