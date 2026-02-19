import { calcularHash } from '../../util/sincronizacion/calcularhash.js';

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
