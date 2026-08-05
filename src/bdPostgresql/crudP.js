import inicializar from "./inicializar.js"
import { generarConsultaInsert, generarConsultaUpdate, generarConsultaDelete } from "../util/generarConsultas.js"
import { TablaSyncRemote } from "../router/sincronizacion/metodoSinc.js"
import {tablas} from "../util/detallesTabla.js"

function crearErrorDB(error){
    return {
        type: 'database',
        code: error.code,
        table: error.table,
        constraint: error.constraint,
        detail: error.detail,
        message: error.message,
    }
}

export async function conectar() {
    const respuesta = await inicializar()
    if(respuesta.status !== 200){
        throw respuesta.error
    }
    return respuesta.data
}

export async function select(consulta, atributo = null) {
    let cliente
    try {
        cliente = await conectar()
        let respuesta
        if( atributo != null){
            respuesta = await cliente.query(consulta, [atributo])
        }else{
            respuesta = await cliente.query(consulta)
        }
        return {
            ok: true,
            status:200,
            data: respuesta.rows
        }
    } catch (error) {
        return {
            ok: false,
            status: 500,
            error: crearErrorDB(error)
        }
    } finally {
        if(cliente){
            cliente.release()
        }
    }
}

export async function insert(consulta, atributos) {
    let cliente
    try {
        cliente = await conectar()
        const respuesta = await cliente.query(consulta, atributos)

        return {
            ok: true,
            status: 201,
            data: respuesta.rows[0]
        }
    } catch (error) {
        return {
            ok: false,
            status: 500,
            error: crearErrorDB(error)
        }
    } finally {
        if(cliente){
            cliente.release()
        }
    }
}

export async function insertFloraCompleta(cliente, datosLimpios,correo,version = null) {
    const sync = new TablaSyncRemote(cliente.pool)
    try {
        const tablaFlora = tablas.find(t => 'Flora' in t)
        const camposFlora = ['nombre_cientifico', ...Object.keys(datosLimpios.Flora)]
        const atributo = [datosLimpios.nombre_cientifico, ...Object.values(datosLimpios.Flora)]
        let consulta = generarConsultaInsert(Object.keys(tablaFlora)[0],camposFlora)
        const result = await cliente.query(consulta,atributo)
        for(const tabla of tablas){
            const nombreTabla = Object.keys(tabla)[0]
            const camposTabla = Object.values(tabla)[0]
            if(nombreTabla === 'Flora') continue

            const datosArray = datosLimpios.listas[nombreTabla] ?? []

            if(!Array.isArray(datosArray) || datosArray.length === 0){
                continue
            }

            await cliente.query(
                `DELETE FROM ${nombreTabla} WHERE nombre_cientifico = $1`,
                [datosLimpios.nombre_cientifico]
            )

            const campos = Array.isArray(camposTabla) ? camposTabla : [camposTabla]
            const consulta = generarConsultaInsert(
                nombreTabla,
                [...campos,'nombre_cientifico']
            )

            for(const dato of datosArray){
                await cliente.query(
                    consulta,
                    [...Object.values(dato),datosLimpios.nombre_cientifico]
                )
            }
        }
        await sync.registrarUpdate(cliente, datosLimpios, correo, version)

        return {ok: true, status: 200}
    } catch (error) {
        return {
            ok: false,
            status: 500,
            error: crearErrorDB(error)
        }
    }
}

export async function deleteById(consulta, atributo) {
    let cliente
    try {
        cliente = await conectar()
        const respuesta = await cliente.query(consulta, [atributo])
        return{ok: true, status: 200, data: respuesta}
    } catch (error) {
        return {
            ok: false,
            status: 500,
            error: crearErrorDB(error)
        }
    } finally {
        if(cliente){
            cliente.release()
        }
    }
}

export async function deleteByIdSinc(nombre_cientifico, correo){
    let cliente
    const sync = new TablaSyncRemote()

    try {
        cliente = await conectar()
        await cliente.query('BEGIN')
        await sync.registrarBorrado(cliente, nombre_cientifico,correo)
        await cliente.query('COMMIT')
        return {ok: true, status: 200}
        
    } catch (error) {
        if(cliente){
            await cliente.query('ROLLBACK')
        }
        return {
            ok: false,
            status: 500,
            error: crearErrorDB(error)
        }
    } finally {
        if(cliente){
            cliente.release()
        }
    }
}

export async function updateFlora(cliente, fila, nombre_cientifico, correo,version = null){
    const sync = new TablaSyncRemote(cliente.pool)
    try {
        const tablaFlora = tablas.find(t => 'Flora' in t)
        var filaFiltrada = {}

        for(const campo of tablaFlora.Flora){
            if(fila[campo] !== undefined){
                filaFiltrada[campo] = fila[campo]
            }
        }
        if(Object.keys(filaFiltrada).length !== 0) await updateTablaSimple(cliente, 'Flora',filaFiltrada, nombre_cientifico)
        
        for(const tabla of tablas) {
            const nombreTabla = Object.keys(tabla)[0]
            const camposTabla = Object.values(tabla)[0]
            if(nombreTabla === 'Flora') continue

            const datosArray = fila[nombreTabla]

            if(!Array.isArray(datosArray)){
                continue
            }
            const campos = Array.isArray(camposTabla) ? camposTabla : [camposTabla]
            await auxiliarUpdate(cliente,campos,datosArray,nombre_cientifico,nombreTabla)
        }
        const especieCompleta = {
            ...fila, nombre_cientifico
        }
        await sync.registrarUpdate(cliente, especieCompleta, correo,version)
        return {ok: true, status: 200}

    } catch (error) {
        return {
            ok: false,
            status: 500,
            error: crearErrorDB(error)
        }
    }
}

async function updateTablaSimple(cliente, tabla, filaFiltrada, nombre_cientifico){
    const consulta = generarConsultaUpdate(
        tabla, Object.keys(filaFiltrada),'nombre_cientifico'
    )
    try {
        await cliente.query(
            consulta, [...Object.values(filaFiltrada),nombre_cientifico]
        )
    } catch (error) {
        throw error
    }
}

async function auxiliarUpdate(cliente, campos, atributos, nombre_cientifico, tabla) {
    let consulta = generarConsultaDelete(tabla, 'nombre_cientifico')
    try {
        if(Array.isArray(atributos)){
            await cliente.query(
                consulta,[nombre_cientifico]
            )
            if(atributos.length){
                consulta = generarConsultaInsert(tabla,
                    [...campos,'nombre_cientifico']
                )
            }
            for(const atributo of atributos){
                await cliente.query(
                    consulta,
                    [...Object.values(atributo),nombre_cientifico]
                )
            }
        }
    } catch (error) {
        throw error
    }    
}