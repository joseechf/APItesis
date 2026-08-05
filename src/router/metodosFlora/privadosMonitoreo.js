import express from "express"
import {insert} from "../../bdPostgresql/crudP.js"
import { generarConsultaInsert } from "../../util/generarConsultas.js"
import path from "path"
import { fileURLToPath } from "url"
import dotenv from "dotenv"
import {ValidarCrecimiento, ValidarSiembra, ValidarTerreno} from "../../util/validarData.js"
import { type } from "os"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const Siembra = express.Router()
Siembra.use(express.json())


async function insertarGenerico({req,res,tabla,validar,generarConsulta,obtenerValores,}) {
    
    const {fila} = req.body
    const validado = validar(fila)
    
    if(!validado.ok){
        const salida = {
            ok: false,
            status: 400,
            error: {
                type: 'validation',
                field: 'fila',
                message: Array.isArray(validado.errores) 
                    ? validado.errores.join(', ')
                    : validado.message,
                details: validado.errores
            }
        }
        return res.status(400).json(salida)
    }
    try {
        const consulta = generarConsulta()
        const valores = obtenerValores(fila)
        const respuesta = await insert(consulta,valores)

        if(!respuesta.ok) {
            const salida = {
                ok: false,
                status: respuesta.status || 500,
                error: respuesta.error
            }
            return res.status(salida.status).json(salida)
        }
        const salida = {
                ok: true,
                status: 200,
                data: respuesta.data
            }
            return res.status(200).json(salida)
    } catch (error) {
        const salida = {
                ok: false,
                status: 500,
                error: {
                    type: 'server',
                    message: error.message
                }
            }
            return res.status(salida.status).json(salida)
    }
}

Siembra.post('/insertCrecimiento', async (req, res) => {
    console.log("====== insert crecimiento =======")
    await insertarGenerico({
        req,res,tabla: 'crecimiento',
        validar:(fila) => ValidarCrecimiento.validar(fila),
        generarConsulta: () => generarConsultaInsert(
            'crecimiento',
            ['id_siembra','fecha','altura_promedio','porcentaje_salud','afeccion',]
        ),
        obtenerValores: (fila) => [fila.id_siembra, fila.fecha, fila.altura_promedio,fila.porcentaje_salud,fila.afeccion,],
    });
});

Siembra.post('/insertSiembra', async (req, res) => {
    console.log("====== insert siembra =======")
    await insertarGenerico({
        req,res,tabla: 'siembra',
        validar:(fila) => ValidarSiembra.validar(fila),
        generarConsulta: () => `
            INSERT INTO siembra (nombre_cientifico,fecha_siembra,usuario,cantidad,distrito,coordenadas)
            VALUES
            ($1,$2,$3,$4,$5,ST_SetSRID(ST_MakePoint($6,$7),4326))RETURNING *;
        `,
        obtenerValores: (fila) => [fila.nombre_cientifico, fila.fecha_siembra, fila.usuario,fila.cantidad,fila.distrito,fila.coordenadas[0],fila.coordenadas[1],],
    });
});

Siembra.post('/insertTerreno', async (req, res) => {
    console.log("====== insert terreno =======")
    await insertarGenerico({
        req,res,tabla: 'terreno',
        validar:(fila) => ValidarTerreno.validar(fila),
        generarConsulta: () => `
            INSERT INTO terreno 
            (dueno,tamano,inicio_reforestacion,coordenadas)
            VALUES
            ($1,$2,$3,ST_SetSRID(ST_GeomFromGeoJSON($4),4326))RETURNING *;
        `,
        obtenerValores: (fila) => [fila.dueno, fila.tamano, fila.inicio_reforestacion,fila.coordenadas],
    });
});

export default Siembra 

