import express from "express";
import { Router } from "express";
import { conectar, select, deleteByIdSinc, updateFlora, insertFloraCompleta } from "../../bdPostgresql/crudP.js";
import { generarConsultaSelect, generarConsultaDelete } from "../../util/generarConsultas.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import dotenv from 'dotenv'

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
    console.log(' obtener segun id ')
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.json({ ok: true, respuesta: [] });
    }
    try {
        const consulta = generarConsultaSelect('todosById');
        const respuesta = await select(consulta, ids);
        res.json({ ok: true, respuesta: respuesta.rows });
    } catch (error) {
        res.status(400).send(error.message);
    }
});

routerPrivadoFlora.post('/getsincronizacion', async (req, res) => {
    console.log(' obtener metadatos sinc ')
    const { ultSinc } = req.body;
    try {
        const consulta = `SELECT * FROM sincronizacion WHERE last_upd >= $1`;
        const respuesta = await select(consulta, [ultSinc]);
        console.log('metadatos sincronizacion: ', respuesta.rows)
        res.json({ ok: true, respuesta: respuesta.rows });
    } catch (error) {
        res.status(400).send(error.message);
    }
});


routerPrivadoFlora.post('/insertflora', async (req, res) => {
    console.log('inicia insertar flora  ')
    const { filas } = req.body;
    console.log('TOTAL FILAS:', filas.length);
    let cliente;
    try {
        cliente = await conectar()
    } catch (error) {
        console.log(error)
        return res.status(500).send("Error al conectar con la base de datos");
    }
    try {
        let resultado
        await cliente.query("BEGIN");
        for (let fila of filas) {
            console.log('IDX:', filas.indexOf(fila), 'CIENTIFICO:', fila.nombre_cientifico);

            console.log('fila: ', fila);
            resultado = await insertFloraCompleta(cliente, fila)
            console.log('proceso', resultado)
        }
        await cliente.query("COMMIT");
        console.log('finalizado : ', resultado)
        res.json(resultado)
    } catch (error) {
        if (cliente) await cliente.query('ROLLBACK');
        res.status(400).send(error.message)
    }
    finally {
        if (cliente) cliente.release?.();
    }
})

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

routerPrivadoFlora.patch('/update/:nombreCientifico', async (req, res) => {
    const { nombreCientifico: claveNombre } = req.params
    const { filas } = req.body
    if (!claveNombre || !Array.isArray(filas) || filas.length === 0) {
        return res.status(400).send("Faltan datos requeridos: nombre científico o filas");
    }
    console.log(filas)
    let cliente;
    try {
        cliente = await conectar()
    } catch (error) {
        console.log(error)
        return res.status(500).send("Error al conectar con la base de datos");
    }
    try {
        let resultado
        for (let fila of filas) {
            console.log('fila: ', fila)
            resultado = await updateFlora(cliente, fila, claveNombre)
            if (!resultado.ok) {
                throw new Error(`Error al actualizar: ${JSON.stringify(resultado.errorFormateado)}`);
            }
            console.log('proceso', resultado)
        }
        console.log('finalizado : ', resultado)
        res.json({ ok: true, message: "Actualización completada" });
    } catch (error) {
        if (cliente) await cliente.query('ROLLBACK');
        res.status(400).json({ ok: false, error: error.message });
    }
})

export default routerPrivadoFlora