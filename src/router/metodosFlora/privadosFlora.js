import express from "express";
import { Router } from "express";
import { conectar, select, deleteByIdSinc, updateFlora, insertFloraCompleta } from "../../bdPostgresql/crudP.js";
import { generarConsultaSelect } from "../../util/generarConsultas.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import dotenv from 'dotenv'
import { ValidadorFlora } from "../../util/validarData.js";

import { TablaSyncRemote } from '../sincronizacion/metodoSinc.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config()

const routerPrivadoFlora = Router()
routerPrivadoFlora.use(express.json())


const storage = multer.memoryStorage(); //guardar en ram no en disco 
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

routerPrivadoFlora.post('/getflora/porids', async (req, res) => {
    console.log('========== POST /getflora/porids ==========')
    console.log('BODY COMPLETO:', req.body)

    const { ids } = req.body

    if (!Array.isArray(ids) || ids.length === 0) {
        const salida = {
            ok: true,
            status: 200,
            data: []
        }

        console.log('IDs inválidos o vacíos:', salida)
        return res.status(200).json(salida)
    }

    const idsValidados = []

    for (let i = 0; i < ids.length; i++) {
        const resultado = ValidadorFlora.validarnc(ids[i])

        if (!resultado.ok) {
            const salida = {
                ok: false,
                status: 400,
                error: {
                    type: 'validation',
                    field: `ids[${i}]`,
                    message: resultado.errores
                }
            }

            console.error('ERROR VALIDACIÓN:', salida)
            return res.status(400).json(salida)
        }

        idsValidados.push(resultado.valor)
    }

    try {
        console.log('Cantidad de IDs:', idsValidados.length)

        const consulta = generarConsultaSelect('todosById')
        console.log('Consulta generada:', consulta)

        const respuesta = await select(consulta, idsValidados)

        if (!respuesta.ok) {
            const salida = {
                ok: false,
                status: respuesta.status || 500,
                error: respuesta.error
            }

            console.error('ERROR SELECT:', salida)
            return res.status(salida.status).json(salida)
        }

        const salida = {
            ok: true,
            status: 200,
            data: respuesta.data
        }

        console.log('Filas obtenidas:', salida.data.length)
        console.log('========== FIN OK ==========')

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

        console.error('ERROR EN /getflora/porids:', salida)
        return res.status(500).json(salida)
    }
})

routerPrivadoFlora.post('/getsincronizacion', async (req, res) => {
    console.log('========== POST /getsincronizacion ==========')
    console.log('Body recibido:', req.body)
    const { ultSinc } = req.body
    try {
        console.log('Última sincronización enviada por cliente:', ultSinc)
        const tablaSync = new TablaSyncRemote()
        const respuesta = await tablaSync.obtenerPendientes(ultSinc)
        const salida = {
            ok: true,
            status: 200,
            data: respuesta
        }
        console.log('Cantidad de registros pendientes:', salida.data?.length ?? 0)
        console.log('========== FIN OK ==========')

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
        console.error('ERROR EN /getsincronizacion:', salida)
        return res.status(500).json(salida)
    }
})


routerPrivadoFlora.post('/insertflora', async (req, res) => {
    console.log('========== POST /insertflora ==========')

    const { fila } = req.body
    const { email } = req.auth

    console.log('usuario:', email)
    console.dir(fila, { depth: null, colors: true })

    if (fila == null) {
        const salida = {
            ok: true,
            status: 200,
            data: null
        }

        console.log('No hay fila para insertar:', salida)
        return res.status(200).json(salida)
    }

    const resultado = ValidadorFlora.validar(fila)

    if (!resultado.ok) {
        const salida = {
            ok: false,
            status: 400,
            error: {
                type: 'validation',
                field: 'fila',
                message: resultado.errores
            }
        }

        console.error('ERROR VALIDACIÓN:', salida)
        return res.status(400).json(salida)
    }

    let cliente

    try {
        cliente = await conectar()
        console.log('Conexión a BD OK')

        await cliente.query('BEGIN')

        const respuesta = await insertFloraCompleta(cliente, resultado.datos, email)

        if (!respuesta.ok) {
            await cliente.query('ROLLBACK')

            const salida = {
                ok: false,
                status: respuesta.status || 500,
                error: respuesta.error
            }

            console.error('ERROR INSERT FLORA COMPLETA:', salida)
            console.error('ROLLBACK ejecutado')

            return res.status(salida.status).json(salida)
        }

        await cliente.query('COMMIT')
        console.log('COMMIT OK')

        const salida = {
            ok: true,
            status: 200,
            data: null
        }

        console.log('========== FIN INSERT OK ==========')
        return res.status(200).json(salida)

    } catch (error) {
        if (cliente) {
            await cliente.query('ROLLBACK')
            console.error('ROLLBACK ejecutado')
        }

        const salida = {
            ok: false,
            status: error.statusCode || 500,
            error: {
                type: 'server',
                message: error.message
            }
        }

        console.error('ERROR EN /insertflora:', salida)
        return res.status(salida.status).json(salida)

    } finally {
        if (cliente) {
            cliente.release?.()
        }
    }
})

routerPrivadoFlora.post('/insertImagen', upload.single('imagen'), (req, res) => {
    console.log('insertando imagen ...');
    if (!req.file) {
        return res.status(400).json({
            ok: false,
           error: { message: 'No se subió ninguna imagen'}
        });
    }
    try {
        const buffer = req.file.buffer;
        const nombreCientifico = req.body.nombreCientifico;
        const resultado = ValidadorFlora.validarnc(nombreCientifico);
        if (!resultado.ok) {
            console.log(resultado.errores)
            return res.status(400).json({
                ok: false,
                error: {message: resultado.errores}
            });
        }
        const nombreLimpio = resultado.valor;
        const esJpg =
            buffer[0] === 0xff &&
            buffer[1] === 0xd8 &&
            buffer[buffer.length - 2] === 0xff &&
            buffer[buffer.length - 1] === 0xd9;
        if (!esJpg) {
            return res.status(400).json({
                ok: false,
                error: {message: 'El archivo no es un JPG válido'}
            });
        }
        const MAX_SIZE = 5 * 1024 * 1024;
        if (buffer.length > MAX_SIZE) {
            return res.status(400).json({
                ok: false,
                message: 'Imagen demasiado grande (máx 5MB)'
            });
        }
        const nombreArchivo = `${nombreLimpio}_${Date.now()}.jpg`;
        const nombre = nombreArchivo.replaceAll(' ','')
        const ROOT_PATH = path.join(__dirname, '../../../..');
        const dir = path.join(ROOT_PATH, 'public', 'imagenes');
        const file = path.join(dir, nombre);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(file, buffer);
        console.log('archivo guardado en:', file);
        const baseUrl = process.env.PUBLIC_BASE_URL;
        if (!baseUrl) {
            throw new Error('PUBLIC_BASE_URL no está definida');
        }
        const url = `${baseUrl}/imagenes/${nombre}`;
        const salida = {
            ok: true,
            status: 200,
            data: url
        }
        console.log('imagen bien insertada ==== la url:', url);
        return res.status(200).json(salida)
    } catch (e) {
        const salida = {
            ok: false,
            status: 500,
            error: {
                type: 'server',
                message: error.message
            }
        }
        console.error('ERROR EN insertImagen:', salida)
        return res.status(500).json(salida)
    }
});

routerPrivadoFlora.delete('/deleteImagen', (req, res) => {
    const { fileName } = req.body;

    try {
        if (!ValidadorFlora.validarNombre(fileName)) {
            const salida = {
                ok: false,
                status: 400,
                error: {
                    type: 'validation',
                    field: 'nombre_imagen',
                    message: 'Nombre de imagen incorrecta'
                }
            }
            console.error('ERROR VALIDACIÓN:', salida)
            return res.status(400).json(salida)
        }
        const ROOT_PATH = path.join(__dirname, '../../../..');
        const carpetaImagenes = path.join(ROOT_PATH, 'public', 'imagenes');
        const filePath = path.join(carpetaImagenes, fileName);
        if (!filePath.startsWith(carpetaImagenes)) {
            const salida = {
                ok: false,
                status: 400,
                error: {
                    type: 'validation',
                    field: 'fileName',
                    message: 'Ruta inválida'
                }
            }
            console.error('ERROR VALIDACIÓN:', salida)
            return res.status(400).json(salida)
        }

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return res.status(200).json({ ok: true });
        }
        onsole.error('ERROR ARCHIVO NO ENCONTRADO:', salida)
        return res.status(404).json(salida)

    }  catch (error) {
        const salida = {
            ok: false,
            status: 500,
            error: {
                type: 'server',
                message: error.message
            }
        }

        console.error('ERROR EN /deleteImagen:', salida)
        return res.status(500).json(salida)
    }
});


routerPrivadoFlora.delete('/softdelete/:nombreCientifico', async (req, res) => {
    console.log('========== DELETE /softdelete ==========')

    const { nombreCientifico } = req.params
    const { email } = req.auth

    console.log('usuario:', email)

    const resultado = ValidadorFlora.validarnc(nombreCientifico)

    if (!resultado.ok) {
        const salida = {
            ok: false,
            status: 400,
            error: {
                type: 'validation',
                field: 'nombreCientifico',
                message: resultado.errores,
            }
        }

        console.error('ERROR VALIDACIÓN:', salida)
        return res.status(400).json(salida)
    }

    try {
        const resp = await deleteByIdSinc(resultado.valor, email)

        console.log('Respuesta deleteByIdSinc:', resp)

        if (!resp || !resp.ok) {
            const salida = {
                ok: false,
                status: resp?.status || 500,
                error: resp?.error || {
                    type: 'server',
                    message: 'Error desconocido'
                }
            }

            console.error('ERROR LÓGICO EN DELETE:', salida)
            return res.status(salida.status).json(salida)
        }

        const salida = {
            ok: true,
            status: 200,
            data: {
                message: 'soft-delete correcto'
            }
        }

        console.log('Soft delete ejecutado correctamente:', salida)
        console.log('========== FIN DELETE OK ==========')

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

        console.error('ERROR EN DELETE /softdelete:', salida)
        return res.status(500).json(salida)
    }
})

routerPrivadoFlora.patch('/update/:nombreCientifico', async (req, res) => {
    console.log('========== PATCH /update ==========')

    const { email } = req.auth
    const { nombreCientifico: claveNombre } = req.params
    const { fila } = req.body

    console.log('usuario:', email)
    console.dir(fila, { depth: null, colors: true })

    const valNombre = ValidadorFlora.validarnc(claveNombre)

    if (!valNombre.ok) {
        const salida = {
            ok: false,
            status: 400,
            error: {
                type: 'validation',
                field: 'nombreCientifico',
                message: valNombre.errores,
            }
        }

        console.error('ERROR VALIDACIÓN:', salida)
        return res.status(400).json(salida)
    }

    if (!fila || typeof fila !== 'object') {
        const salida = {
            ok: false,
            status: 400,
            error: {
                type: 'validation',
                field: 'fila',
                message: 'Faltan datos requeridos: fila'
            }
        }

        console.error('ERROR VALIDACIÓN:', salida)
        return res.status(400).json(salida)
    }

    const resultadoValidacion = ValidadorFlora.validar(fila)

    if (!resultadoValidacion.ok) {
        const salida = {
            ok: false,
            status: 400,
            error: {
                type: 'validation',
                field: 'fila',
                message: resultadoValidacion.errores,
            }
        }

        console.error('ERROR VALIDACIÓN:', salida)
        return res.status(400).json(salida)
    }

    const resultadofila = {...resultadoValidacion.datos.Flora,...resultadoValidacion.datos.listas}

    let cliente

    try {
        cliente = await conectar()
        console.log('Conexión BD OK')

        await cliente.query('BEGIN')

        const resultado = await updateFlora(
            cliente,
            resultadofila,
            valNombre.valor,
            email
        )

        if (!resultado || !resultado.ok) {
            await cliente.query('ROLLBACK')

            const salida = {
                ok: false,
                status: resultado?.status || 500,
                error: resultado?.error || {
                    type: 'server',
                    message: 'Error desconocido al actualizar'
                }
            }

            console.error('ERROR EN updateFlora:', salida)
            console.error('ROLLBACK ejecutado')

            return res.status(salida.status).json(salida)
        }

        await cliente.query('COMMIT')

        const salida = {
            ok: true,
            status: 200,
            data: {
                message: 'Actualización completada'
            }
        }

        console.log('Fila actualizada correctamente:', salida)
        console.log('COMMIT OK')
        console.log('========== FIN UPDATE OK ==========')

        return res.status(200).json(salida)

    } catch (error) {
        if (cliente) {
            await cliente.query('ROLLBACK')
            console.error('ROLLBACK ejecutado')
        }

        const salida = {
            ok: false,
            status: error.statusCode || 500,
            error: {
                type: 'server',
                message: error.message
            }
        }

        console.error('ERROR EN PATCH update:', salida)
        return res.status(salida.status).json(salida)

    } finally {
        if (cliente) {
            cliente.release?.()
            console.log('Conexión liberada')
        }
    }
})

export default routerPrivadoFlora