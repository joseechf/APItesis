import express from "express";
import { Router } from "express";
import { conectar, select } from "../bdPostgresql/crudP.js";
import { generarConsultaSelect, generarConsultaInsert } from "../util/generarConsultas.js";


const routerAdmin = Router()
routerAdmin.use(express.json())

routerAdmin.get('/getRegSiembra', async (req, res) => {
    console.log('inicia obtener RegSiembra  ')
    try {
        //let consulta = generarConsultaSelect(campos,'Flora')
        let consulta = generarConsultaSelect('RegistroSembrado')
        console.log(consulta)
        const respuesta = await select(consulta)
        //console.log(respuesta)
        const fila = respuesta.rows
        console.log(fila)
        if (fila != null) {
            res.json({ ok: true, respuesta: fila })
        } else {
            throw new Error('respuesta vacia de la consulta')
        }
    } catch (error) {
        res.json({ ok: false, respuesta: error.message })
    }
})

/*routerAdmin.post('/insertRegSiembra', async (req, res) => {
    console.log('insert reg siembra')
    const { fila } = req.body
    let cliente;
    try {
        cliente = await conectar()
    } catch (error) {
        return res.status(400).send(error.message)
    }
    try {
        const fechaSembrado = fila.fechaPlantacion
        if (!fechaSembrado) {
            return res.status(400).json({
                ok: false,
                error: 'fechaSembrado es requerido'
            });
        }
        const idUsuarioFinal =
            fila.idUsuario ?? null
        let camposPrincipales = null
        let valoresPrincipales = []
        if (idUsuarioFinal != null) {
            camposPrincipales = 'idUsuario_fk, fechaSembrado'
            valoresPrincipales = [
                idUsuarioFinal,
                fechaSembrado
            ]
        } else {
            camposPrincipales = ' fechaSembrado'
            valoresPrincipales = [
                fechaSembrado
            ]
        }


        //desde Sembrable_RegistroSembrado llegamos a Sembrable por Flora
        const relaciones = fila.Sembrable_RegistroSembrado ?? []
        for (const r of relaciones) {
            const consulta = `
                        SELECT s.idSembrable
                        FROM Flora f
                        INNER JOIN Sembrable s 
                        ON s.nombreCientifico = f.nombreCientifico
                        WHERE f.nombreCientifico = $1
                    `;

            const resultado = await select(consulta, [r.nombreCientifico]);

            if (resultado.rowCount == 0 || resultado.length === 0) {
                throw new Error(
                    `No se encontró sembrable para ${r.nombreCientifico}`
                );
            }
            console.log(resultado)
            r.sembrable_fk = resultado[0].idsembrable;
        }



        await cliente.query('BEGIN')
        const resultado = await insertGenerico(cliente, {
            tablaPrincipal: 'RegistroSembrado',
            camposPrincipales: camposPrincipales,
            valoresPrincipales: valoresPrincipales,

            relaciones: [
                {
                    tabla: 'Sembrable_RegistroSembrado',
                    campos: `
                            sembrable_fk,
                            registroSembrado_fk,
                            cantidadSembrado,
                            coordenadas,
                            estado
                        `,
                    filas: relaciones,
                    mapValores: (r, registro) => [
                        r.sembrable_fk,        // $1
                        registro.idregistrosembrado, // $2
                        r.cantidadSembrado,        // $3
                        JSON.stringify({ lat: r.lat, lng: r.lng }), // $4
                        r.estado                   // $5
                    ]
                }
            ]
        })

        if (!resultado.ok) {
            await cliente.query('ROLLBACK')
            return res.json(resultado)
        }

        await cliente.query('COMMIT')
        res.json({ ok: true })

    } catch (error) {
        console.log(error)
        await cliente.query('ROLLBACK')
        res.json({ ok: false, error: error.message })
    } finally {
        cliente.release()
    }
})
*/

routerAdmin.post('/insertRegSiembra', async (req, res) => {
    console.log('insert reg siembra');
    const { fila } = req.body;
    let cliente;
    try {
        cliente = await conectar();
    } catch (err) {
        return res.status(400).send(err.message);
    }

    try {
        /* ---------- 1.  Validaciones rápidas ---------- */
        const fechaSembrado = fila.fechaPlantacion;
        if (!fechaSembrado) {
            return res.status(400).json({ ok: false, error: 'fechaSembrado es requerido' });
        }
        const relaciones = fila.Sembrable_RegistroSembrado ?? [];
        if (!relaciones.length) {
            return res.status(400).json({ ok: false, error: 'Debe enviar al menos un SembrableRegistro' });
        }

        /* ---------- 2.  Preparar campos del INSERT principal ---------- */
        const idUsuarioFinal = fila.idUsuario ?? null;
        const camposPrincipales = idUsuarioFinal != null
            ? 'idUsuario_fk, fechaSembrado'
            : 'fechaSembrado';
        const valoresPrincipales = idUsuarioFinal != null
            ? [idUsuarioFinal, fechaSembrado]
            : [fechaSembrado];

        /* ---------- 3.  Transacción ---------- */
        await cliente.query('BEGIN');

        /* 3.a  INSERT RegistroSembrado (usando tu helper) */
        const consReg = generarConsultaInsert('RegistroSembrado', camposPrincipales);
        const { rows: [{ idregistrosembrado }] } = await cliente.query(consReg, valoresPrincipales);

        /* 3.b  Por cada SembrableRegistro: obtener idSembrable e insertar relación */
        for (const r of relaciones) {
            /* ---- obtener idSembrable ---- */
            const consSem = generarConsultaSelect(
                'Sembrable',
                'idSembrable',
                'nombreCientifico'
            );
            const selRes = await select(consSem, r.nombreCientifico); // usa tu helper
            if (!selRes || selRes.rowCount === 0) {
                throw new Error(`No existe Sembrable para nombreCientifico=${r.nombreCientifico}`);
            }
            const idSembrable = selRes.rows[0].idsembrable;
            if (idSembrable == null) {
                console.log(`id Sembrable no encontrado con la especie `)
                //continue
            }
            console.log('sembrable_fk: ', idSembrable)
            /* ---- INSERT relación (usando tu helper) ---- */
            const consRel = generarConsultaInsert(
                'Sembrable_RegistroSembrado',
                'sembrable_fk, registroSembrado_fk, cantidadSembrado, coordenadas, estado'
            );
            await cliente.query(
                consRel,
                [
                    idSembrable,
                    idregistrosembrado,
                    r.cantidadSembrado,
                    r.lng,   // lon (x)
                    r.lat,   // lat (y)
                    r.estado
                ]
            );
        }

        await cliente.query('COMMIT');
        res.json({ ok: true });

    } catch (error) {
        console.error(error);
        await cliente.query('ROLLBACK');
        res.json({ ok: false, error: error.message });
    } finally {
        cliente.release();
    }
});




export default routerAdmin