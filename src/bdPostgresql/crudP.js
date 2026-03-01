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
        console.log('--- SELECT INICIO ---')
        console.log('Consulta:', consulta)
        console.log('Atributo:', atributo)

        const cliente = await conectar()

        if (atributo != null) {
            respuesta = await cliente.query(consulta, [atributo])
        } else {
            respuesta = await cliente.query(consulta)
        }

        console.log('Filas obtenidas:', respuesta.rowCount)
        console.log('--- SELECT FIN OK ---')

        return respuesta

    } catch (error) {
        console.error('--- ERROR EN SELECT ---')
        console.error('Consulta que falló:', consulta)
        console.error('Error completo:', error)

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
        console.log('--- INSERT INICIO ---')
        console.log('Consulta:', consulta)
        console.log('Valores:', atributos)

        const cliente = await conectar()

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
    }
}


export async function insertFloraCompleta(cliente, fila) {

    const sync = new TablaSyncRemote(cliente.pool)

    try {
        console.log('========== INSERT FLORA COMPLETA ==========')
        console.log('Nombre científico:', fila.nombre_cientifico)
        console.log('Fila completa recibida:', fila)

        const tablaFlora = tablas.find(t => t.tabla === 'Flora')

        if (!tablaFlora) {
            throw new Error('No se encontró configuración para tabla Flora')
        }

        const filaFlora = {}

        for (const campo of tablaFlora.campos) {
            if (fila[campo] !== undefined) {
                filaFlora[campo] = fila[campo]
            }
        }

        console.log('Campos Flora filtrados:', filaFlora)

        const camposFlora = ['nombre_cientifico', ...Object.keys(filaFlora)]
        const valoresFlora = [fila.nombre_cientifico, ...Object.values(filaFlora)]

        console.log('Campos a insertar en Flora:', camposFlora)
        console.log('Valores a insertar en Flora:', valoresFlora)

        let consulta = generarConsultaInsert(tablaFlora.tabla, camposFlora)

        console.log('Consulta Flora generada:', consulta)

        await cliente.query(consulta, valoresFlora)

        console.log('Insert Flora OK')

        for (const tabla of tablas) {

            if (tabla.tabla === 'Flora') continue

            const datosArray = fila[tabla.tabla] ?? []

            console.log(`Procesando tabla hija: ${tabla.tabla}`)
            console.log('Datos recibidos:', datosArray)

            if (!Array.isArray(datosArray) || datosArray.length === 0) {
                console.log('Sin datos, se omite tabla:', tabla.tabla)
                continue
            }

            console.log('Borrando registros previos en:', tabla.tabla)

            await cliente.query(
                `DELETE FROM ${tabla.tabla} WHERE nombre_cientifico = $1`,
                [fila.nombre_cientifico]
            )

            console.log('Delete previo OK')

            consulta = generarConsultaInsert(
                tabla.tabla,
                [...tabla.campos, 'nombre_cientifico']
            )

            console.log('Consulta generada para tabla hija:', consulta)

            for (const dato of datosArray) {

                console.log('Insertando fila en', tabla.tabla)
                console.log('Dato:', dato)

                await cliente.query(
                    consulta,
                    [...Object.values(dato), fila.nombre_cientifico]
                )
            }

            console.log('Tabla hija procesada OK:', tabla.tabla)
        }

        console.log('Registrando sincronización...')
        await sync.registrarUpsert(cliente, fila)
        console.log('Sync registrada OK')

        console.log('========== FIN INSERT FLORA COMPLETA OK ==========')

        return { ok: true }

    } catch (error) {

        console.error('========== ERROR EN INSERT FLORA COMPLETA ==========')
        console.error('Nombre científico:', fila?.nombre_cientifico)
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


export async function deleteByIdSinc(nombre_cientifico) {
    const cliente = await conectar();
    const sync = new TablaSyncRemote();

    try {
        await cliente.query('BEGIN');

        await sync.registrarBorrado(cliente, nombre_cientifico);

        await cliente.query('COMMIT');
        return { ok: true };

    } catch (error) {
        await cliente.query('ROLLBACK');
        return { ok: false, error };
    } finally {
        cliente.release();
    }
}



export async function update(consulta, atributos) {
    try {
        console.log('--- UPDATE INICIO ---')
        console.log('Consulta:', consulta)
        console.log('Valores:', atributos)

        const cliente = await conectar()

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
    }
}



export async function updateFlora(cliente, fila, nombre_cientifico) {

    const sync = new TablaSyncRemote(cliente.pool)

    try {

        console.log('========== UPDATE FLORA COMPLETA ==========')
        console.log('Nombre científico:', nombre_cientifico)
        console.log('Fila recibida:', fila)

        await cliente.query('BEGIN')
        console.log('BEGIN OK')

        const tablaFlora = tablas.find(t => t.tabla === 'Flora')

        if (!tablaFlora) {
            throw new Error('No se encontró configuración de tabla Flora')
        }

        const filaFiltrada = {}

        for (const campo of tablaFlora.campos) {
            if (fila[campo] !== undefined) {
                filaFiltrada[campo] = fila[campo]
            }
        }

        console.log('Campos filtrados para Flora:', filaFiltrada)

        if (Object.keys(filaFiltrada).length > 0) {
            console.log('Actualizando tabla Flora...')
            await updateTablaSimple(
                cliente,
                tablaFlora.tabla,
                filaFiltrada,
                nombre_cientifico
            )
            console.log('Update Flora OK')
        } else {
            console.log('No hay campos para actualizar en Flora')
        }

        for (const tabla of tablas) {

            if (tabla.tabla === 'Flora') continue

            const datosArray = fila[tabla.tabla]

            console.log(`Procesando tabla hija: ${tabla.tabla}`)
            console.log('Datos recibidos:', datosArray)

            if (!Array.isArray(datosArray)) {
                console.log('No es array, se omite:', tabla.tabla)
                continue
            }

            await auxiliarUpdate(
                cliente,
                tabla.campos,
                datosArray,
                nombre_cientifico,
                tabla.tabla
            )

            console.log('Tabla hija actualizada:', tabla.tabla)
        }

        const especieCompleta = {
            ...fila,
            nombre_cientifico
        }

        console.log('Registrando sincronización...')
        await sync.registrarUpsert(cliente, especieCompleta)
        console.log('Sync OK')

        await cliente.query('COMMIT')
        console.log('COMMIT OK')
        console.log('========== FIN UPDATE FLORA OK ==========')

        return { ok: true }

    } catch (error) {

        console.error('========== ERROR EN UPDATE FLORA ==========')
        console.error('Nombre científico:', nombre_cientifico)
        console.error('Error completo:', error)

        await cliente.query('ROLLBACK')
        console.error('ROLLBACK ejecutado')

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
    console.log('Tabla:', tabla)
    console.log('Atributos recibidos:', atributos)

    let consulta = generarConsultaDelete(tabla, 'nombre_cientifico')

    try {

        if (Array.isArray(atributos)) {

            console.log('Eliminando registros previos...')
            console.log('Consulta DELETE:', consulta)
            console.log('Valor nombre_cientifico:', nombre_cientifico)

            await cliente.query(
                consulta,
                [nombre_cientifico]
            )

            console.log('DELETE OK')

            consulta = generarConsultaInsert(
                tabla,
                [...campos, 'nombre_cientifico']
            )

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


