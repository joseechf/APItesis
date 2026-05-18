import express from "express";
import { Router } from "express";
import { select } from "../../bdPostgresql/crudP.js";
import dotenv from 'dotenv'
import "../../util/validarData.js";

dotenv.config()

const monitoreo = Router()
monitoreo.use(express.json())

monitoreo.get('/getsiembra', async (req, res) => {
    try {
        const consulta = `
            SELECT jsonb_build_object(
                'type', 'FeatureCollection',
                'features', jsonb_agg(feature)
            )
            FROM (
                SELECT jsonb_build_object(
                'type', 'Feature',
                'properties', jsonb_build_object(
                    'id', s.id,
                    'nombre_cientifico', s.nombre_cientifico,
                    'fecha_siembra', s.fecha_siembra,
                    'usuario', s.usuario,
                    'cantidad', s.cantidad,
                    'distrito', s.distrito,
                    'crecimiento', (
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'fecha', c.fecha,
                                'altura_promedio', c.altura_promedio,
                                'porcentaje_salud', c.porcentaje_salud,
                                'afeccion', c.afeccion
                            )
                        )
                        FROM crecimiento c
                        WHERE c.id_siembra = s.id
                    )
                ),
                'geometry', ST_AsGeoJSON(s.coordenadas)::jsonb
                ) AS feature
                FROM siembra s
            ) features;
            `;
        const result = await select(consulta);
        const json = result?.data?.[0]?.jsonb_build_object
        if (!json) {
            return res.status(404).json({
                ok: false,
                status: 404,
                error: 'datos no encontrados'
            })
        }
        return res.status(200).json(json)
    } catch (error) {
        console.error(error);
        res.status(500).send('Error');
    }
})

monitoreo.get('/getterreno', async (req, res) => {
    try {
        const consulta = `
            SELECT jsonb_build_object(
                'type', 'FeatureCollection',
                'features', jsonb_agg(feature)
            )
            FROM (
                SELECT jsonb_build_object(
                'type', 'Feature',
                'properties', jsonb_build_object(
                    'id', t.id,
                    'dueno', t.dueno,
                    'tamano', t.tamano,
                    'inicio_alquiler', t.inicio_alquiler,
                    'fin_alquiler', t.fin_alquiler,
                    'estado',
                        CASE 
                            WHEN fin_alquiler >= CURRENT_DATE THEN 'alquilado'
                            ELSE 'libre'
                        END
                ),
                'geometry', ST_AsGeoJSON(t.coordenadas)::jsonb
                ) AS feature
                FROM terreno t
            ) features;
            `;
        const result = await select(consulta);
        const json = result?.data?.[0]?.jsonb_build_object
        if (!json) {
            return res.status(404).json({
                ok: false,
                status: 404,
                error: 'datos no encontrados'
            })
        }
        return res.status(200).json(json)
    } catch (error) {
        console.error(error);
        res.status(500).send('Error');
    }
})

export default monitoreo