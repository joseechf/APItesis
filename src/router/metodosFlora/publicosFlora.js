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
    console.log('inicia obtener flora  ')
    try {
        let consulta = generarConsultaSelect('todas')
        const respuesta = await select(consulta)
        console.log('datos crudos: ', respuesta)
        const dtos = respuesta.rows.map(f => formatearEspecieParaDTO(f));
        console.log('despues formatear: ', dtos)
        res.json({ ok: true, respuesta: dtos })
    } catch (error) {
        res.status(400).send(error.message)
    }
})

export default routerPublicFlora