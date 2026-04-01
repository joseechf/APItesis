import express from "express";
import { Router } from "express";
import { conectar, select, deleteByIdSinc, updateFlora, insertFloraCompleta } from "../../bdPostgresql/crudP.js";
import { generarConsultaSelect } from "../../util/generarConsultas.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import dotenv from 'dotenv'
import "../../util/validarString.js";
import ValidadorFlora from "../../util/validarString.js";

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
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        console.log('IDs inválidos o vacíos')
        return res.json({ ok: true, data: [] });
    }
    const idsValidados = [];
    for (let i = 0; i < ids.length; i++) {
        const resultado = ValidadorFlora.validarnc(ids[i]);
        if (!resultado.ok) {
            console.log(`400 --- Error en id ${i}: ${resultado.errores.join(', ')}`)
            return res.status(400).json({
                ok: false,
                message: `Error en id ${i}: ${resultado.errores.join(', ')}`
            });
        }
        idsValidados.push(resultado.datos);
    }
    try {
        console.log('Cantidad de IDs:', idsValidados.length)

        const consulta = generarConsultaSelect('todosById')
        console.log('Consulta generada:', consulta)

        const respuesta = await select(consulta, idsValidados)

        if (!respuesta || respuesta.ok === false) {
            console.error('Error proveniente de select():', respuesta)

            return res.status(500).json({
                ok: false,
                origen: 'select',
                error: respuesta?.errorFormateado
            });
        }
        console.log('Filas obtenidas:', respuesta.rowCount)
        console.log('========== FIN OK ==========')
        return res.status(200).json({
            ok: true,
            data: respuesta.rows
        });
    } catch (error) {
        console.error('ERROR EN /getflora/porids')
        console.error(error)
        return res.status(500).json({
            ok: false,
            message: error.message
        });
    }
});

routerPrivadoFlora.post('/getsincronizacion', async (req, res) => {

    console.log('========== POST /getsincronizacion ==========')
    console.log('Body recibido:', req.body)

    const { ultSinc } = req.body;

    try {

        console.log('Ultima sincronización enviada por cliente:', ultSinc)

        const tablaSync = new TablaSyncRemote();

        const respuesta = await tablaSync.obtenerPendientes(ultSinc);

        console.log('Cantidad de registros pendientes:', respuesta?.length ?? 0)

        console.log('========== FIN OK ==========')

        res.status(200).json({ ok: true, data: respuesta })

    } catch (error) {

        console.error('ERROR EN /getsincronizacion')
        console.error(error);

        res.status(500).json({ ok: false, message: error.message });
    }
});


routerPrivadoFlora.post('/insertflora', async (req, res) => {

    console.log('========== POST /insertflora ==========')

    const { filas } = req.body;
    const { email } = req.auth;
    console.log('usuario: ', email)
    console.dir(filas, { depth: null, colors: true });

    if (!Array.isArray(filas) || filas.length === 0) {
        console.log('No hay filas para insertar')
        return res.json({ ok: true });
    }

    const filasValidadas = [];

    for (let i = 0; i < filas.length; i++) {
        const resultado = ValidadorFlora.validar(filas[i]);

        if (!resultado.ok) {
            console.log(`400 ---  Error en la fila ${i}: ${resultado.errores.join(', ')}`)
            return res.status(400).json({
                ok: false,
                message: `Error en la fila ${i}: ${resultado.errores.join(', ')}`
            });
        }

        filasValidadas.push(resultado.datos);
    }

    let cliente;

    try {
        cliente = await conectar()
        console.log('Conexión a BD OK')
    } catch (error) {
        console.error('Error al conectar:', error)
        return res.status(500).send("Error al conectar con la base de datos");
    }

    try {

        await cliente.query("BEGIN");
        console.log('BEGIN OK');

        for (const datosLimpios of filasValidadas) {
            await insertFloraCompleta(cliente, datosLimpios, email);
        }

        await cliente.query("COMMIT");
        console.log('COMMIT OK')

        console.log('========== FIN INSERT OK ==========')

        res.status(200).json({ ok: true });

    } catch (error) {

        console.error(error)

        if (cliente) {
            await cliente.query('ROLLBACK');
            console.error('ROLLBACK ejecutado')
        }
        res.status(error.statusCode || 500).json({ ok: false, message: error.message })

    } finally {

        if (cliente) {
            cliente.release?.();
            console.log('Conexión liberada')
        }
    }
});

routerPrivadoFlora.post('/insertImagen', upload.single('imagen'), (req, res) => {
    console.log('insertando imagen ...');
    if (!req.file) {
        return res.status(400).json({
            ok: false,
            message: 'No se subió ninguna imagen'
        });
    }
    try {
        const buffer = req.file.buffer;
        const nombreCientifico = req.body.nombreCientifico;
        const resultado = ValidadorFlora.validarnc(nombreCientifico);
        if (!resultado.ok) {
            return res.status(400).json({
                ok: false,
                message: resultado.errores
            });
        }
        const nombreLimpio = resultado.datos;
        const esJpg =
            buffer[0] === 0xff &&
            buffer[1] === 0xd8 &&
            buffer[buffer.length - 2] === 0xff &&
            buffer[buffer.length - 1] === 0xd9;
        if (!esJpg) {
            return res.status(400).json({
                ok: false,
                message: 'El archivo no es un JPG válido'
            });
        }
        const MAX_SIZE = 5 * 1024 * 1024;
        if (buffer.length > MAX_SIZE) {
            return res.status(400).json({
                ok: false,
                message: 'Imagen demasiado grande (máx 5MB)'
            });
        }
        const nombre = `${nombreLimpio}_${Date.now()}.jpg`;
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
        console.log('la url:', url);
        return res.status(200).json({
            ok: true,
            data: url
        });
    } catch (e) {
        console.error('Error al guardar imagen:', e.message);
        return res.status(500).json({
            ok: false,
            message: e.message
        });
    }
});

routerPrivadoFlora.delete('/deleteImagen', (req, res) => {
    const { fileName } = req.body;

    try {

        if (!ValidadorFlora.validarNombre(fileName)) {
            return { ok: false, error: 'nombre del archivo incorrecto' };
        }
        const ROOT_PATH = path.join(__dirname, '../../../..');
        const carpetaImagenes = path.join(ROOT_PATH, 'public', 'imagenes');
        const filePath = path.join(carpetaImagenes, fileName);
        if (!filePath.startsWith(carpetaImagenes)) {
            return res.status(400).json({
                ok: false,
                message: 'Ruta inválida'
            });
        }

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return res.status(200).json({ ok: true });
        }
        return res.status(404).json({
            ok: false,
            message: 'Archivo no encontrado'
        });

    } catch (e) {

        console.error('Error borrando imagen:', e.message);

        return res.status(500).json({
            ok: false,
            message: e.message
        });
    }
});


routerPrivadoFlora.delete('/softdelete/:nombreCientifico', async (req, res) => {

    console.log('========== DELETE /softdelete ==========')

    const { nombreCientifico } = req.params;
    const { email } = req.auth;
    console.log('usuario: ', email)
    const resultado = ValidadorFlora.validarnc(nombreCientifico);

    if (!resultado.ok) {
        return res.status(400).json({
            ok: false,
            message: resultado.errores
        });
    }

    try {

        const resp = await deleteByIdSinc(resultado.datos, email);

        console.log('Respuesta deleteByIdSinc:', resp)

        if (!resp || resp.ok === false) {
            console.error('Error lógico en delete:', resp)

            return res.status(500).json({
                ok: false,
                message: resp?.errorFormateado ?? 'Error desconocido'
            });
        }

        console.log('Soft delete ejecutado correctamente')
        console.log('========== FIN DELETE OK ==========')

        return res.status(200).json({
            ok: true,
            message: 'soft-delete correcto'
        });

    } catch (error) {

        console.error('ERROR EN DELETE /softdelete')
        console.error(error)

        return res.status(500).json({
            ok: false,
            message: error.message
        });
    }
});

routerPrivadoFlora.patch('/update/:nombreCientifico', async (req, res) => {

    console.log('========== PATCH /update ==========')
    const { email } = req.auth;
    console.log('usuario: ', email)
    const { nombreCientifico: claveNombre } = req.params;
    const valNombre = ValidadorFlora.validarnc(claveNombre);
    if (!valNombre.ok) {
        return res.status(400).json({ ok: false, message: 'Nombre inválido' });
    }

    const { fila } = req.body;
    console.dir(fila, { depth: null, colors: true });

    if (!fila || typeof fila !== 'object') {
        console.log('Validación fallida');
        return res.status(400).json({
            ok: false,
            message: "Faltan datos requeridos: nombre científico o fila"
        });
    }

    const resultadoValidacion = ValidadorFlora.validar(fila);

    if (!resultadoValidacion.ok) {
        console.log(`400 --- Error en la fila: ${resultadoValidacion.errores.join(', ')}`);
        return res.status(400).json({
            ok: false,
            message: `Error en la fila: ${resultadoValidacion.errores.join(', ')}`
        });
    }

    let cliente;

    try {
        cliente = await conectar();
        console.log('Conexión BD OK');
    } catch (error) {
        console.error('Error conectando BD:', error);
        return res.status(500).send("Error al conectar con la base de datos");
    }

    try {

        await cliente.query("BEGIN");

        const resultado = await updateFlora(cliente, fila, claveNombre, email);

        if (!resultado || resultado.ok === false) {
            console.error('Error en updateFlora:', resultado);

            const error = new Error(
                `Error al actualizar: ${JSON.stringify(resultado?.errorFormateado)}`
            );
            error.statusCode = 400;
            throw error;
        }

        console.log('Fila actualizada correctamente');

        await cliente.query("COMMIT");
        console.log('COMMIT OK');
        console.log('========== FIN UPDATE OK ==========');

        res.status(200).json({ ok: true, message: "Actualización completada" });

    } catch (error) {

        console.error('ERROR EN PATCH /update');
        console.error(error);

        if (cliente) {
            await cliente.query('ROLLBACK');
            console.error('ROLLBACK ejecutado');
        }

        res.status(error.statusCode || 500).json({
            ok: false,
            message: error.message
        });

    } finally {
        if (cliente) {
            cliente.release?.();
            console.log('Conexión liberada');
        }
    }
});

export default routerPrivadoFlora