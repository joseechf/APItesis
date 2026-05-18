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
        const respuesta = await select(consulta)
        // ERROR DESDE CRUDP
        if (!respuesta.ok) {
            console.error('ERROR EN SELECT')
            console.error(respuesta.error)
            return res.status(respuesta.status).json(respuesta)
        }
        // DTO
        const dtos = respuesta.data.map(fila =>
            formatearEspecieParaDTO(fila)
        )
        console.log('Cantidad de filas:', dtos.length)
        console.log('========== FIN GET OK ==========')
        return res.status(200).json({
            ok: true,
            status: 200,
            data: dtos
        })
    } catch (error) {
        console.error('========== ERROR EN GET /getflora ==========')
        console.error(error)
        return res.status(500).json({
            ok: false,
            status: 500,
            error: {
                type: 'server',
                message: error.message
            }
        })
    }
})

export default routerPublicFlora