import express from "express";
import { Router } from "express";
import { conectar, select, deleteByIdSinc, updateFlora, insertFloraCompleta } from "../../bdPostgresql/crudP.js";
import { generarConsultaSelect } from "../../util/generarConsultas.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import dotenv from 'dotenv'

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
    console.log('Body recibido:', req.body)

    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
        console.log('IDs inválidos o vacíos')
        return res.json({ ok: true, respuesta: [] });
    }

    try {

        console.log('Cantidad de IDs:', ids.length)

        const consulta = generarConsultaSelect('todosById')
        console.log('Consulta generada:', consulta)

        const respuesta = await select(consulta, ids)

        if (!respuesta || respuesta.ok === false) {
            console.error('Error proveniente de select():', respuesta)
            return res.status(500).json({
                ok: false,
                origen: 'select',
                error: respuesta?.errorFormateado
            })
        }

        console.log('Filas obtenidas:', respuesta.rowCount)

        console.log('========== FIN OK ==========')
        res.json({ ok: true, respuesta: respuesta.rows });

    } catch (error) {

        console.error('ERROR EN /getflora/porids')
        console.error(error)

        res.status(400).json({ ok: false, message: error.message });
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

        res.json({ ok: true, respuesta });

    } catch (error) {

        console.error('ERROR EN /getsincronizacion')
        console.error(error);

        res.status(400).json({ ok: false, message: error.message });
    }
});


routerPrivadoFlora.post('/insertflora', async (req, res) => {

    console.log('========== POST /insertflora ==========')

    const start = Date.now()

    const { filas } = req.body;

    console.log('Cantidad de filas recibidas:', filas?.length)

    if (!Array.isArray(filas) || filas.length === 0) {
        console.log('No hay filas para insertar')
        return res.json({ ok: true });
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
        console.log('BEGIN OK')

        let resultado;

        for (let i = 0; i < filas.length; i++) {

            const fila = filas[i]

            console.log(`Procesando fila ${i + 1}/${filas.length}`)
            console.log('Nombre científico:', fila?.nombre_cientifico)

            resultado = await insertFloraCompleta(cliente, fila)

            if (!resultado || resultado.ok === false) {
                console.error('Error en insertFloraCompleta:', resultado)
                throw new Error('Error insertando flora completa')
            }
        }

        await cliente.query("COMMIT");
        console.log('COMMIT OK')

        console.log('Tiempo total (ms):', Date.now() - start)
        console.log('========== FIN INSERT OK ==========')

        res.json(resultado)

    } catch (error) {

        console.error('ERROR EN /insertflora')
        console.error(error)

        if (cliente) {
            await cliente.query('ROLLBACK');
            console.error('ROLLBACK ejecutado')
        }

        res.status(400).json({ ok: false, message: error.message })

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
        return res.status(400).json({ ok: false, error: 'No se subió ninguna imagen' });
    }

    // JPG únicamente
    const tiposPermitidos = ['image/jpeg', 'image/jpg'];
    if (!tiposPermitidos.includes(req.file.mimetype)) {
        return res.status(400).json({
            ok: false,
            error: 'Solo se permiten imágenes JPG/JPEG',
        });
    }

    try {
        const buffer = req.file.buffer;
        const nombreCientifico = req.body.nombreCientifico;

        if (!nombreCientifico || typeof nombreCientifico !== 'string') {
            return res.status(400).json({ ok: false, error: 'nombre_nientifico requerido' });
        }

        // Fuerza .jpg
        const nombre = `${nombreCientifico}_${Date.now()}.jpg`;

        const ROOT_PATH = path.join(__dirname, '../../../..');
        const dir = path.join(ROOT_PATH, 'public', 'imagenes');
        const file = path.join(dir, nombre);

        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        fs.writeFileSync(file, buffer);
        console.log('archivo guardado en:', file);

        const baseUrl = process.env.PUBLIC_BASE_URL;
        if (!baseUrl) {
            throw new Error('PUBLIC_BASE_URL no está definida');
        }
        const url = `${baseUrl}/imagenes/${nombre}`;

        console.log('la url:', url);

        res.json({ ok: true, url });
    } catch (e) {
        console.error('Error al guardar imagen:', e.message);
        res.status(500).json({ ok: false, error: e.message });
    }
});

routerPrivadoFlora.delete('/deleteImagen', (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ ok: false, error: 'Falta url' });

    try {
        const parsed = new URL(url);
        const fileName = path.basename(parsed.pathname);
        const ROOT_PATH = path.join(__dirname, '../../../..');
        const filePath = path.join(ROOT_PATH, 'public', 'imagenes', fileName);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return res.json({ ok: true });
        }
        res.status(404).json({ ok: false, error: 'Archivo no encontrado' });
    } catch (e) {
        console.error('Error borrando imagen:', e.message);
        res.status(500).json({ ok: false, error: e.message });
    }
});

// comentado porque de momento nadie debe poder eliminar por completo un registro
/* 
routerPrivadoFlora.delete('/delete/:nombreCientifico', async (req, res) => {
    console.log('inicia eliminacion...')
    const { nombreCientifico } = req.params
    try {
        let consulta = generarConsultaDelete('Flora', 'nombre_cientifico')
        let resp = await deleteByIdSinc(consulta, nombreCientifico)
        if (resp.rowCount === 0) {
            return res.status(404).json({
                ok: false,
                message: 'Usuario no encontrado'
            });
        }
        if (!resp.ok) {
            console.log('problemas usuario: ', resp)
            throw resp
        }
        res.json({ ok: true });
    } catch (error) {
        res.status(400).send(error.message)
    }
})
*/

routerPrivadoFlora.delete('/softdelete/:nombreCientifico', async (req, res) => {

    console.log('========== DELETE /softdelete ==========')

    const { nombreCientifico } = req.params;

    console.log('Nombre científico recibido:', nombreCientifico)

    if (!nombreCientifico) {
        console.log('Parámetro vacío')
        return res.status(400).json({ ok: false, message: 'Nombre científico requerido' });
    }

    try {

        const resp = await deleteByIdSinc(nombreCientifico);

        console.log('Respuesta deleteByIdSinc:', resp)

        if (!resp || resp.ok === false) {
            console.error('Error lógico en delete:', resp)
            return res.status(500).json({
                ok: false,
                error: resp?.errorFormateado ?? 'Error desconocido'
            });
        }

        console.log('Soft delete ejecutado correctamente')
        console.log('========== FIN DELETE OK ==========')

        res.json({ ok: true });

    } catch (error) {

        console.error('ERROR EN DELETE /softdelete')
        console.error(error)

        res.status(400).json({ ok: false, message: error.message });
    }
});

routerPrivadoFlora.patch('/update/:nombreCientifico', async (req, res) => {

    console.log('========== PATCH /update ==========')

    const { nombreCientifico: claveNombre } = req.params
    const { filas } = req.body

    console.log('Nombre científico:', claveNombre)
    console.log('Cantidad de filas:', filas?.length)

    if (!claveNombre || !Array.isArray(filas) || filas.length === 0) {
        console.log('Validación fallida')
        return res.status(400).send("Faltan datos requeridos: nombre científico o filas");
    }

    let cliente;

    try {
        cliente = await conectar()
        console.log('Conexión BD OK')
    } catch (error) {
        console.error('Error conectando BD:', error)
        return res.status(500).send("Error al conectar con la base de datos");
    }

    try {

        await cliente.query("BEGIN");
        console.log('BEGIN OK')

        let resultado;

        for (let i = 0; i < filas.length; i++) {

            const fila = filas[i]

            console.log(`Procesando fila ${i + 1}/${filas.length}`)
            console.log('Contenido fila:', fila)

            resultado = await updateFlora(cliente, fila, claveNombre)

            if (!resultado || resultado.ok === false) {
                console.error('Error en updateFlora:', resultado)
                throw new Error(
                    `Error al actualizar fila ${i + 1}: ${JSON.stringify(resultado?.errorFormateado)}`
                );
            }

            console.log('Fila actualizada correctamente')
        }

        await cliente.query("COMMIT");
        console.log('COMMIT OK')
        console.log('========== FIN UPDATE OK ==========')

        res.json({ ok: true, message: "Actualización completada" });

    } catch (error) {

        console.error('ERROR EN PATCH /update')
        console.error(error)

        if (cliente) {
            await cliente.query('ROLLBACK');
            console.error('ROLLBACK ejecutado')
        }

        res.status(500).json({ ok: false, error: error.message });

    } finally {
        if (cliente) {
            cliente.release?.();
            console.log('Conexión liberada')
        }
    }
});

export default routerPrivadoFlora