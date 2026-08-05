import express from "express"
import { Router } from "express"
import {conectar, select, deleteByIdSinc, updateFlora, insertFloraCompleta} from "../../bdPostgresql/crudP.js";
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import multer from "multer"
import dotenv from "dotenv"
import { ValidadorFlora } from "../../util/validarData.js" 
import {TablaSyncRemote} from "../sincronizacion/metodoSinc.js"
import { generarConsultaSelect } from "../../util/generarConsultas.js";
import { error } from "console";
import { type } from "os";

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config()

const routerPrivadoFlora = Router()
routerPrivadoFlora.use(express.json())

const storage = multer.memoryStorage() // guardar en ram no en disco
const upload = multer({
    storage,
    limits: {fileSize: 5 * 1024 * 1024}, //5mb
})

routerPrivadoFlora.post('/getflora/porids', async (req,res) => {
    console.log(" ========== getflora por id ===========")
    const {ids} = req.body

    if(!Array.isArray(ids) || ids.length === 0){
        const salida = {
            ok: true,
            status: 200,
            data: []
        }
        console.log('ids invalidos  ',salida)
        return res.status(200).json(salida)
    }
    const idsValidados = []
    for(let i = 0; i< ids.length; i++){
        const resultado = ValidadorFlora.validarnc(ids[i])

        if(!resultado.ok){
            const salida = {
                ok: false,
                status: 400,
                error: {
                    type: 'validation',
                    field: `ids[${i}]`,
                    message: resultado.errores
                }
            }
            return res.status(400).json(salida)
        }
        idsValidados.push(resultado.valor)
    }
    try {
        const consulta = generarConsultaSelect('todoById')
        const respuesta = await select(consulta, idsValidados)

        if(!respuesta.ok){
            const salida = {
                ok: false,
                status:  respuesta.status || 500,
                error: respuesta.error
            }
            return res.status(salida.status).json(salida)
        }

        const salida = {
                ok: true,
                status: 200,
                data: respuesta.data
            }
        console.log('\n registros por id: ')
        for(const e of salida.data){
            console.log(e.nombre_cientifico)
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
            console.dir(salida,{depth: null})
        return res.status(500).json(salida)
    }
})

routerPrivadoFlora.post('/getsincronizacion', async (req, res) => {
    const {ultSinc} = req.body
    try {
        const tableSync = new TablaSyncRemote()
        const respuesta = await tableSync.obtenerPendientes(ultSinc)
        const salida = {
            ok: true,
            status: 200,
            data: respuesta
        }
        console.log('\n resultado del metodo getsincronizacion: ')
        console.dir(salida,{depth: null})
        console.log('\n fin getsincronizacion \n')
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
        return res.status(500).json(salida)
    }
})

routerPrivadoFlora.post('/insertflora', async(req, res) => {
    const {fila, version} = req.body
    const {email} = req.auth 
    if(fila == null){
        const salida = {
            ok: true,
            status: 200,
            data: null
        }
        return res.status(200).json(salida)
    }
    const resultado = ValidadorFlora.validar(fila)
    if(!resultado.ok) {
        const salida = {
            ok: false,
            status: 422,
            type: 'validation',
            message: resultado.errores
        }
        console.log(salida)
        return res.status(422).json(salida)
    }

    let cliente
    
    try {
    cliente = await conectar()
    await cliente.query('BEGIN')
    const respuesta = await insertFloraCompleta(cliente, resultado.datos, email, version)
    
    if(!respuesta.ok){
        await cliente.query('ROLLBACK')
        console.log(respuesta.error)
        const salida = {
            ok: false,
            status: respuesta.status || 500,
            type: respuesta?.error.type,
            message: respuesta?.error.message ?? 'Error desconocido'
        }
        return res.status(salida.status).json(salida)
    }
    await cliente.query('COMMIT')
    const salida = {
            ok: true,
            status: 200,
            data: null
        }

        return res.status(200).json(salida)
    } catch (error) {
        if(cliente){
            await cliente.query('ROLLBACK')
        }
        const salida = {
            ok: false,
            status: error.statusCode || 500,
            type: 'server',
            message: error.message
        }
        return res.status(salida.status).json(salida)
    } finally {
        if(cliente) {
            cliente.release?.()
        }
    }
})

routerPrivadoFlora.post('/insertImagen',upload.single('imagen'),(req,res) => {
    console.log('insertando imagen')
    if(!req.file){
        return res.status(422).json({
            ok: false,
            message: 'No se subio ninguna imagen',
            type: 'validation'
        });
    }
    try {
        const buffer = req.file.buffer
        const nombreCientifico = req.body.nombreCientifico
        const resultado = ValidadorFlora.validarnc(nombreCientifico)
        if(!resultado.ok){
            return res.status(422).json({
                ok: false,
                message: resultado.errores,
                type: 'validation'
            })
        }
        const nombreLimpio = resultado.valor
        const esJpg = 
            buffer[0] === 0xff &&
            buffer[1] === 0xd8 &&
            buffer[buffer.length - 2] === 0xff &&
            buffer[buffer.length - 1] === 0xd9
        if(!esJpg){
            return res.status(422).json({
                ok: false,
                message: 'El archivo no es un JPG valido',
                type: 'validation'
            })
        }
        const MAX_sIZE = 5 * 1024 * 1024
        if(buffer.length > MAX_sIZE){
            return res.status(422).json({
                ok: false,
                message: 'Imagen demasiado grande (MAX 5MB)',
                type: 'validation'
            });
        }
        const nombreArchivo = `${nombreLimpio}_${Date.now()}.jpg`
        const nombre = nombreArchivo.replaceAll(' ','')
        const ROOT_PATH = path.join(__dirname, '../../../..')
        const dir = path.join(ROOT_PATH,'public','imagenes')
        const file = path.join(dir, nombre)
        if(!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true})
        }
        fs.writeFileSync(file, buffer)
        const baseUrl = process.env.PUBLIC_BASE_URL.replace(/\/$/,'')
        if(!baseUrl){
            throw new Error('PUBLIC_BASE_URL no esta definida')
        }
        const imagenUrl = `${baseUrl}/imagenes/${nombre}`
        const salida = {
            ok: true,
            status: 200,
            data: imagenUrl
        }
        console.log(salida)
        return res.status(200).json(salida)
    } catch (error) {
        const salida = {
            ok: false,
            status: 500,
            type: 'server',
            message: error.message
        }
        console.log(salida)
        return res.status(500).json(salida)
    }
})

routerPrivadoFlora.delete('/deleteImagen',(req,res) => {
    console.log('\n eliminando imagen ')
    const {fileName} = req.body

    try {
        if(!ValidadorFlora.validarNombre(fileName)){
            const salida = {
                ok: false,
                status: 400,
                error: {
                    type: 'nombre_imagen',
                    message: 'Nombre de imagen incorrecta'
                }
            }
            return res.status(400).json(salida)
        }
        const ROOT_PATH = path.join(__dirname,'../../../..')
        const carpetaImagenes = path.join(ROOT_PATH, 'public', 'imagenes')
        const filePath = path.join(carpetaImagenes, fileName)
        if(!filePath.startsWith(carpetaImagenes)){
            const salida = {
                ok: false,
                status: 400,
                error: {
                    type: 'Validation',
                    message: 'Ruta invalida'
                }
            }
            console.log(salida)
            return res.status(400).json(salida)
        }

        if(fs.existsSync(filePath)){
            fs.unlinkSync(filePath)
            return res.status(200).json({ok: true})
        }
        return res.status(404).json(salida)
    } catch (error) {
        const salida = {
                ok: false,
                status: 500,
                error: {
                    type: 'server',
                    message: error.message
                }
            }
            console.log(salida)
            return res.status(500).json(salida)
    }
})

routerPrivadoFlora.delete('/softdelete/:nombreCientifico', async (req, res) => {
    const {nombreCientifico} = req.params
    const {email} = req.auth
    const resultado = ValidadorFlora.validarnc(nombreCientifico)

    console.log('eliminando ',nombreCientifico)

    if(!resultado.ok) {
        const salida = {
            ok: false,
            status: 422,
            type: 'validation',
            message: resultado.errores
        }
        console.log(salida)
        return res.status(422).json(salida)
    }

    try {
       const resp = await deleteByIdSinc(nombreCientifico, email)
       if(!resp || !resp.ok){
         const salida = {
                ok: false,
                status: resp?.status || 500,
                type: resp?.error.type,
                message: resp?.error.message ?? 'Error desconocido'
            }
            console.log(salida)
            return res.status(salida.status).json(salida) 
       } 
       const salida = {
        ok: resp.ok,
        status: 200,
        data: {
            message: 'soft-delete correcto'
        }
       }
       console.log(salida)
       return res.status(200).json(salida)
    } catch (error) {
        const salida = {
                ok: false,
                status: 500,
                type: 'server',
                message: error.message
            }
            console.log(salida)
            return res.status(500).json(salida) 
    }
})


routerPrivadoFlora.patch('/update/:nombreCientifico', async (req, res) => {
    const {nombreCientifico: claveNombre} = req.params
    const {email} = req.auth
    const {fila, version} = req.body

    const resultadoN = ValidadorFlora.validarnc(claveNombre)

    if(!resultadoN.ok){
        console.log(resultadoN)
         const salida = {
                ok: false,
                status: 422,
                type: 'validation',
                message: resultadoN.errores
            }
            return res.status(422).json(salida)
    }

    if(!fila || typeof fila !== 'object'){
        const salida = {
                ok: false,
                status: 422,
                type: 'validation',
                message: 'faltan datos requeridos'
            }
            return res.status(422).json(salida) 
    }

    const resultadoValidacion = ValidadorFlora.validar(fila)

    if(!resultadoValidacion.ok){
        const salida = {
                ok: false,
                status: 422,
                type: 'validation',
                message: resultadoValidacion.errores
            }
            return res.status(422).json(salida) 
    }

    const resultadofila = {...resultadoValidacion.datos.Flora,...resultadoValidacion.datos.listas}
    let cliente
    try {
       cliente = await conectar()
       await cliente.query('BEGIN')
       const resultado = await updateFlora(
        cliente,resultadofila,resultadoN.valor,email,version
       )

       if(!resultado || !resultado.ok){
        await cliente.query('ROLLBACK') 
        const salida = {
            ok: false,
            status: resultado?.status || 500,
            type: resultado?.error.type,
            message: resultado?.error.message ?? 'Error desconocido'
        }
        return res.status(salida.status).json(salida) 
       }
       
       await cliente.query('COMMIT')
       const salida = {
        ok: true,
        status: 200,
        data: {
            message: 'Actualizacion completada'
        }
       }
       return res.status(200).json(salida)
    } catch (error) {
        if(cliente){
            await cliente.query('ROLLBACK')
        }
        const salida = {
                ok: false,
                status: error.statusCode || 500,
                type: 'server',
                message: error.message
            }
            console.log(error)
            return res.status(salida.status).json(salida) 
    } finally {
        if(cliente){
            cliente.release?.()
        }
    }
})


export default routerPrivadoFlora