

import { calcularHash } from '../../util/sincronizacion/calcularhash.js';
import { conectar } from "../../bdPostgresql/crudP.js";



export class TablaSyncRemote {
    constructor() { }

    async obtenerPendientes(ultSinc = null) {

        await this.eliminarHuerfanos()

        const cliente = await conectar();

        try {

            let query = 'SELECT * FROM sincronizacion';
            const values = [];

            if (ultSinc !== null) {
                query += ' WHERE last_upd >= $1';
                values.push(ultSinc);
            }

            const { rows } = await cliente.query(query, values);


            return rows;

        } finally {
            cliente.release();
        }
    }

    async eliminarHuerfanos() {
        const cliente = await conectar();
        try {
            const query = `
            DELETE FROM sincronizacion s
            WHERE NOT EXISTS (
                SELECT 1
                FROM Flora f
                WHERE f.nombre_cientifico = s.id
            )
        `;
            await cliente.query(query);
        } finally {
            cliente.release();
        }
    }

    async registrarSync({ cliente, id, fila, usuario }) {

        const hash = calcularHash(fila);

        const { rows } = await cliente.query(
            'SELECT version FROM sincronizacion WHERE id = $1 LIMIT 1',
            [id]
        );


        if (rows.length === 0) {

            await cliente.query(
                `
                INSERT INTO sincronizacion
                (id, is_new, is_update, is_delete, hash, version, usuario, last_upd)
                VALUES ($1, TRUE, FALSE, FALSE, $2, 1, $3, NOW())
                `,
                [id, hash, usuario]
            );

        } else {
            const versionActual = rows[0].version ?? 1;
            const nuevaVersion = versionActual + 1;

            await cliente.query(
                `
                UPDATE sincronizacion SET
                  is_new = FALSE,
                  is_update = TRUE,
                  is_delete = FALSE,
                  hash = $2,
                  version = $3,
                  usuario = $4,
                  last_upd = NOW()
                WHERE id = $1
                `,
                [id, hash, nuevaVersion, usuario]
            );

        }

    }

    async registrarUpsert(cliente, especie, correo) {


        return this.registrarSync({
            cliente,
            id: especie.nombre_cientifico,
            fila: especie,
            usuario: correo,
        });
    }

    async registrarBorrado(cliente, id, correo) {
        await cliente.query(
            `
        INSERT INTO sincronizacion
        (id, is_new, is_update, is_delete, hash, version, "usuario, last_upd)
        VALUES ($1, FALSE, FALSE, TRUE, '', 1, $2, NOW())
        ON CONFLICT (id) DO UPDATE SET
            is_new = FALSE,
            is_update = FALSE,
            is_delete = TRUE,
            hash = '',
            usuario = $2,
            version = sincronizacion.version + 1,
            last_upd = NOW()
        `,
            [id, correo]
        );
    }

    async limpiarSincronizacion(cliente) {

        console.log('================ LIMPIAR TABLA SINCRONIZACION ================');

        const { rowCount } = await cliente.query('DELETE FROM sincronizacion');

        console.log('Filas eliminadas:', rowCount);
        console.log('================ FIN LIMPIEZA ================');
    }
}