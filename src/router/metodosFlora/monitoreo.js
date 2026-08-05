import express from "express"
import {Router} from "express"
import{ select } from "../../bdPostgresql/crudP.js"
import dotenv from "dotenv"
import "../../util/validarData.js"

dotenv.config()

const monitoreo = Router()
monitoreo.use(express.json())

monitoreo.get('/getsiembra', async (req,res) => {
    try {
        const consulta = `
            SELECT jsonb_build_object(
                'type','FeatureCollection',
                'features',jsonb_agg(feature)
            )FROM (
                SELECT json_build_object(
                'type', 'Feature',
                'properties', jsonb_build_object(
                    'id', s.id,
                    'nombre cientifico - scientific name', s.nombre_cientifico,
                    'fecha siembra - sowing date', s.fecha_siembra,
                    'usuario - user', s.usuario,
                    'cantidad - amount', s.cantidad,
                    'distrito - distric',s.distrito,
                    'crecimiento - growth', (
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'Fecha - Date',c.fecha,
                                'Altura promedio - Average height', c.altura_promedio,
                                'Porcentaje salud - Health percentage', c.porcentaje_salud,
                                'Afeccion - Condition', c.afeccion
                            )
                        )
                            FROM crecimiento c WHERE c.id_siembra = s.id
                    )
                ),
                'geometry', ST_AsGeoJSON(s.coordenadas)::jsonb
            ) AS feature FROM siembra s inner join sincronizacion as sinc on s.nombre_cientifico = sinc.id where is_delete != TRUE
        ) features;
        `
        const result = await select(consulta)
        const json = result?.data?.[0]?.jsonb_build_object
        if(!json){
            return res.status(404).json({
                ok: false,
                status: 404,
                error: 'datos no encontrados'
            })
        }
        console.log('=== siembra ====')
        return res.status(200).json(json)
    } catch (error) {
        res.status(500).send('Error')
    }
})

monitoreo.get('/getterreno', async (req, res) => {
    try {
        const consulta = `
            SELECT jsonb_build_object(
                'type','FeatureCollection',
                'features',jsonb_agg(feature)
            )FROM (
                SELECT json_build_object(
                'type', 'Feature',
                'properties', jsonb_build_object(
                    'id', t.id,
                    'Dueño - owner', t.dueno,
                    'Tamaño - Size', t.tamano,
                    'Inicio reforestacion - Reforestation begins', t.inicio_reforestacion
                    ),
                'geometry', ST_AsGeoJSON(t.coordenadas)::jsonb
            ) AS feature FROM terreno t
        ) features;
        `
        const result = await select(consulta)
        const json = result?.data?.[0]?.jsonb_build_object
        if(!json){
            return res.status(404).json({
                ok: false,
                status: 404,
                error: 'datos no encontrados'
            })
        }
        console.log('=== terrenos ====')
        return res.status(200).json(json)
    } catch (error) {
        res.status(500).send('Error')
    }
})

export default monitoreo