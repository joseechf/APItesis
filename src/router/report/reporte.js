import express from 'express'
import { select } from '../../bdPostgresql/crudP.js'

const reporte = express.Router()
reporte.use(express.json())

reporte.get('/getReporte', async (req, res) => {
    const consulta = []
    const fila = []
    const tipo = ['cantidad_siembra','mejor_usuario_sembrador','cantidad_planta_sembrada','promedio_salud','promedio_altura','peor_afeccion','porcentaje_reforestacion']
    try {
        //obtiene la siembra que tiene mayor cantidad de arboles internamente (o sea por siembra)
        consulta[0] = 'select SUM(cantidad) AS cant_siembra from siembra as s inner join sincronizacion as sinc on s.nombre_cientifico = sinc.id where sinc.is_delete != TRUE;'
        //agrupa por cual usuario a hecho más siembras, ya sea que en una sola siembra plantó varios arboles o hizo varias siembras de 1 arbol
        consulta[1] = 'select s.usuario from siembra as s inner join sincronizacion as sinc on s.nombre_cientifico = sinc.id where sinc.is_delete != TRUE GROUP BY s.usuario ORDER BY SUM(cantidad) DESC LIMIT 1;'
        // cantidad de veces que se ha sembrado la misma planta, pero solo por siembra
        consulta[2] = 'select nombre_cientifico, SUM(cantidad) as cantidad from siembra as s inner join sincronizacion as sinc on s.nombre_cientifico = sinc.id where sinc.is_delete != TRUE GROUP BY nombre_cientifico ORDER BY cantidad DESC;'
        // porcentaje de salud de cada especie, trabaja a nivel de siembra no de cantidad de plantas por siembra
        consulta[3] = 'select nombre_cientifico, ROUND(SUM(porcentaje_salud * cantidad) / SUM(cantidad),2) as salud from reporte_reforestacion as r inner join sincronizacion as sinc on r.nombre_cientifico = sinc.id where sinc.is_delete != TRUE group by nombre_cientifico;'
        //promedio de crecimiento de cada especie a nivel de siembra no de cantidad de plantas en esa siembra
        consulta[4] = 'select nombre_cientifico, ROUND(AVG(altura_promedio)) AS promedio_altura from reporte_reforestacion as r inner join sincronizacion as sinc on r.nombre_cientifico = sinc.id where sinc.is_delete != TRUE GROUP BY nombre_cientifico ORDER BY promedio_altura DESC;'
        // afeccion que mas ataca
        consulta[5] = "select afeccion, COUNT(*) AS cantidad_casos FROM crecimiento as c inner join siembra as s on c.id_siembra = s.id inner join sincronizacion as sinc on s.nombre_cientifico = sinc.id where sinc.is_delete != TRUE AND afeccion <> 'Sin afeccion' GROUP BY afeccion ORDER BY cantidad_casos DESC LIMIT 1;"
        // obtener porcentaje de reforestacion por distrito
        consulta[6] = "select distrito, ROUND(((SUM(SQRT(cantidad)* cobertura)/area)*100)::numeric,5) || '%' as reforestacion from reporte_reforestacion as r inner join sincronizacion as sinc on r.nombre_cientifico = sinc.id where sinc.is_delete != TRUE group by distrito,area order by reforestacion desc;"
        for(let i = 0; i < 7; i++){
            const data = await select(consulta[i])
            const row = {[tipo[i]] : data.data}
            fila.push(row)
        }
        const reporte = generarReporte(fila)
        res.status(200).json({'reporte': reporte})
    } catch (error) {
        res.status(400).json({error})
    }
})

function generarReporte(datos) {
    let reporte = "--- REPORTE DE GESTION ECOAZUERO --- \n\n"
    datos.forEach(item => {
        const key = Object.keys(item)[0]
        const valores = item[key]
        if(!valores || valores.length === 0){
            reporte += `No hay datos disponibles para ${key}.\n\n`
            return
        }
        switch (key) {
            case 'cantidad_siembra':
                if(valores[0].cant_siembra != null){
                    reporte += `Actualmente contamos con un total de ${valores[0].cant_siembra} siembras registradas. \n`
                }
                break;
            case 'mejor_usuario_sembrador':
                if(valores[0].usuario != null){
                    reporte += `El colaborador más activo en el campo es ${valores[0].usuario}.\n`
                }
                break;
            case 'cantidad_planta_sembrada':
                reporte += `Distribución por especie: \n`
                valores.forEach( v => {
                    if(v.nombre_cientifico != null && v.cantidad != null){
                        reporte += `${v.nombre_cientifico}: ${v.cantidad} especímenes.\n`
                    }
                })
                reporte += '\n'
                break;
            case 'promedio_salud':
                valores.forEach( v => {
                    if(v.nombre_cientifico != null && v.salud != null){
                        reporte += `La salud promedio observada para la especie ${v.nombre_cientifico} es del ${v.salud}%.\n`
                    }
                })
                reporte += '\n'
                break;
            case 'promedio_altura':
                valores.forEach( v => {
                    if(v.nombre_cientifico != null && v.promedio_altura != null){
                        reporte += `El crecimiento vertical medio de ${v.nombre_cientifico} se sitúa en ${v.promedio_altura} cm.\n`
                    }
                })
                reporte += '\n'
                break;
            case 'peor_afeccion':
                valores.forEach( v => {
                    if(v.afeccion != null && v.cantidad_casos != null){
                        reporte += `La afección más frecuente es ${v.afeccion}, con ${v.cantidad_casos} casos registrados. \n`
                    }
                })
                reporte += '\n'
                break;
            case 'porcentaje_reforestacion':
                valores.forEach( v => {
                    if(v.distrito != null && v.reforestacion != null){
                        reporte += `El porcentaje de reforestación del distrito ${v.distrito} es ${v.reforestacion}. \n`
                    }
                })
                reporte += '\n'
                break;
            default:
                reporte += `No hay datos de ${key}.\n\n`
                break
        }
    })
    return reporte
}

export default reporte