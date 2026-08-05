import express from "express"
import {Router} from "express"
import {select} from "../../bdPostgresql/crudP.js"
import {generarConsultaSelect} from "../../util/generarConsultas.js"
import dotenv from "dotenv"

dotenv.config()

const routerPublicFlora = Router()
routerPublicFlora.use(express.json())

routerPublicFlora.get('/getflora', async (req,res) => {
    console.log("obteniendo registros publicos de flora\n")
    try {
        const consulta = generarConsultaSelect('todas')
        const respuesta = await select(consulta)
        if(!respuesta.ok){
            return res.status(respuesta.status).json(respuesta)
        }
        console.dir(respuesta,{depth:null,colors:true})
        return res.status(200).json({
            ok: true,
            status: 200,
            data: respuesta.data,
        })
    } catch (error) {
        console.log('\n error: \n',error)
        return res.status(502).json({
            ok: false,
            status: 502,
            message: error.message,
        })
    }
})

export default routerPublicFlora