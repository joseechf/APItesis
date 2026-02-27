/*import { calcularHash } from '../../util/sincronizacion/calcularhash.js';

export class TablaSyncRemote {
    constructor() { }

    async obtenerPendientes(cliente) {
        const { rows } = await cliente.query(
            'SELECT * FROM sincronizacion'
        );
        return rows;
    }

    async registrarSync({ cliente, id, fila, device }) {

        const hash = calcularHash(fila);

        const { rows } = await cliente.query(
            'SELECT version FROM sincronizacion WHERE id = $1 LIMIT 1',
            [id]
        );

        if (rows.length === 0) {
            // INSERT
            await cliente.query(
                `
        INSERT INTO sincronizacion
        (id, is_new, is_update, is_delete, hash, version, device, last_upd)
        VALUES ($1, TRUE, FALSE, FALSE, $2, 1, $3, NOW())
        `,
                [id, hash, device]
            );
        } else {
            // UPDATE
            const versionActual = rows[0].version ?? 1;

            await cliente.query(
                `
        UPDATE sincronizacion SET
          is_new = FALSE,
          is_update = TRUE,
          is_delete = FALSE,
          hash = $2,
          version = $3,
          device = $4,
          last_upd = NOW()
        WHERE id = $1
        `,
                [id, hash, versionActual + 1, device]
            );
        }
    }

    async registrarUpsert(cliente, especie) {
        return this.registrarSync({
            cliente,
            id: especie.nombre_cientifico,
            fila: especie,
            device: 'api',
        });
    }

    async registrarBorrado(cliente, id) {
        await cliente.query(
            `
        INSERT INTO sincronizacion
        (id, is_new, is_update, is_delete, hash, version, device, last_upd)
        VALUES ($1, FALSE, FALSE, TRUE, '', 1, 'api', NOW())
        ON CONFLICT (id) DO UPDATE SET
            is_new = FALSE,
            is_update = FALSE,
            is_delete = TRUE,
            hash = '',
            version = sincronizacion.version + 1,
            last_upd = NOW()
        `,
            [id]
        );
    }

    async limpiarSincronizacion(cliente) {
        await cliente.query('DELETE FROM sincronizacion');
    }
}
*/

import { calcularHash } from '../../util/sincronizacion/calcularhash.js';
import { conectar } from "../../bdPostgresql/crudP.js";



export class TablaSyncRemote {
    constructor() { }

    async obtenerPendientes(ultSinc = null) {

        console.log('================ OBTENER PENDIENTES SYNC ================');

        const cliente = await conectar();

        try {

            let query = 'SELECT * FROM sincronizacion';
            const values = [];

            if (ultSinc !== null) {
                query += ' WHERE last_upd >= $1';
                values.push(ultSinc);
            }

            const { rows } = await cliente.query(query, values);

            console.log('Total pendientes encontrados:', rows.length);
            console.log('IDs pendientes:', rows.map(r => r.id));

            return rows;

        } finally {
            cliente.release();
        }
    }

    async registrarSync({ cliente, id, fila, device }) {

        console.log('================ REGISTRAR SYNC ================');
        console.log('ID:', id);
        console.log('Device:', device);
        console.log('Fila recibida:', JSON.stringify(fila, null, 2));

        const hash = calcularHash(fila);
        console.log('Hash calculado:', hash);

        const { rows } = await cliente.query(
            'SELECT version FROM sincronizacion WHERE id = $1 LIMIT 1',
            [id]
        );

        console.log('Resultado búsqueda previa:', rows);

        if (rows.length === 0) {
            console.log('🆕 No existe registro previo → INSERT version 1');

            await cliente.query(
                `
                INSERT INTO sincronizacion
                (id, is_new, is_update, is_delete, hash, version, device, last_upd)
                VALUES ($1, TRUE, FALSE, FALSE, $2, 1, $3, NOW())
                `,
                [id, hash, device]
            );

            console.log('✅ INSERT ejecutado correctamente');
        } else {
            const versionActual = rows[0].version ?? 1;
            const nuevaVersion = versionActual + 1;

            console.log('🔄 Registro existente → UPDATE');
            console.log('Versión actual:', versionActual);
            console.log('Nueva versión:', nuevaVersion);

            await cliente.query(
                `
                UPDATE sincronizacion SET
                  is_new = FALSE,
                  is_update = TRUE,
                  is_delete = FALSE,
                  hash = $2,
                  version = $3,
                  device = $4,
                  last_upd = NOW()
                WHERE id = $1
                `,
                [id, hash, nuevaVersion, device]
            );

            console.log('✅ UPDATE ejecutado correctamente');
        }

        console.log('================ FIN REGISTRAR SYNC ================');
    }

    async registrarUpsert(cliente, especie) {

        console.log('================ REGISTRAR UPSERT ================');
        console.log('Especie recibida:', especie?.nombre_cientifico);

        return this.registrarSync({
            cliente,
            id: especie.nombre_cientifico,
            fila: especie,
            device: 'api',
        });
    }

    async registrarBorrado(cliente, id) {

        console.log('================ REGISTRAR BORRADO ================');
        console.log('ID a borrar:', id);

        await cliente.query(
            `
            INSERT INTO sincronizacion
            (id, is_new, is_update, is_delete, hash, version, device, last_upd)
            VALUES ($1, FALSE, FALSE, TRUE, '', 1, 'api', NOW())
            ON CONFLICT (id) DO UPDATE SET
                is_new = FALSE,
                is_update = FALSE,
                is_delete = TRUE,
                hash = '',
                version = sincronizacion.version + 1,
                last_upd = NOW()
            `,
            [id]
        );

        console.log('🗑 Borrado registrado (soft delete remoto)');
        console.log('================ FIN REGISTRAR BORRADO ================');
    }

    async limpiarSincronizacion(cliente) {

        console.log('================ LIMPIAR TABLA SINCRONIZACION ================');

        const { rowCount } = await cliente.query('DELETE FROM sincronizacion');

        console.log('Filas eliminadas:', rowCount);
        console.log('================ FIN LIMPIEZA ================');
    }
}