import express from "express";
import { Router } from "express";
import { select } from "../../bdPostgresql/crudP.js";
import { generarConsultaSelect } from "../../util/generarConsultas.js";
import formatearEspecieParaDTO from '../../util/formatoToDto.js';
import dotenv from 'dotenv'


dotenv.config()

const routerPublicFlora = Router()
routerPublicFlora.use(express.json())




routerPublicFlora.get('/getflora', async (req, res) => {

    console.log('========== GET /getflora ==========')

    try {

        const consulta = generarConsultaSelect('todas')

        //console.log('Consulta generada:', consulta)

        const respuesta = await select(consulta)

        //  Validar si select devolvió error estructurado
        if (!respuesta || respuesta.ok === false) {

            console.error('Error proveniente de select():', respuesta)

            return res.status(500).json({
                ok: false,
                origen: 'select',
                error: respuesta?.errorFormateado ?? 'Error desconocido en select'
            })
        }

        if (!respuesta.rows) {

            console.error('respuesta.rows es undefined:', respuesta)

            return res.status(500).json({
                ok: false,
                error: 'respuesta.rows undefined'
            })
        }

        console.log('Cantidad de filas obtenidas:', respuesta.rowCount)

        const dtos = respuesta.rows.map(f => {
            try {
                return formatearEspecieParaDTO(f)
            } catch (e) {
                console.error('Error formateando fila:', f)
                console.error('Error DTO:', e)
                throw e
            }
        })

        dtos.map((registro) => {
            console.log('registro =============', registro)
        })

        console.log('========== FIN GET OK ==========')

        //res.json({ ok: true, respuesta: dtos })
        res.status(200).json({ ok: true, data: dtos })

    } catch (error) {

        console.error('========== ERROR EN GET /getflora ==========')
        console.error('Error completo:', error)

        res.status(400).json({
            ok: false,
            message: error.message
        })
    }
})

export default routerPublicFlora