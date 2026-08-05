import {conectar} from "../../bdPostgresql/crudP.js"

export class TablaSyncRemote {

    async obtenerPendientes(ultSinc = null){
        await this.eliminarHuerfanos()
        const cliente = await conectar()
        try {
            let query = 'SELECT * FROM sincronizacion'
            const values = []
            if(ultSinc !== null){
                query += ' WHERE last_upd > $1'
                values.push(ultSinc)
            }
            const {rows} = await cliente.query(query, values)
            console.log('\n metadatos de registros pendienes: ')
            console.dir(rows,{depth: null})
            return rows
        } finally {
            cliente.release()
        }
    }

    async eliminarHuerfanos(){
        const cliente = await conectar()
        try {
            const query =`DELETE FROM sincronizacion s WHERE NOT EXISTS (
                SELECT 1 FROM Flora f WHERE f.nombre_cientifico = s.id
            )`
            await cliente.query(query)
        } finally {
            cliente.release()
        }
    }

    async registrarSync({cliente, id, fila, usuario,versionLocal = null}){
        const { rows } = await cliente.query(
            'SELECT version FROM sincronizacion WHERE id = $1 LIMIT 1',[id]
        )
        const vLocal = versionLocal ?? 1
        if(rows.length === 0){
            await cliente.query(
                `
                    INSERT INTO sincronizacion (id, is_new,is_update,is_delete, version, usuario, last_upd)
                    VALUES ($1,TRUE, FALSE, FALSE, $2,$3,NOW())
                `, [id,vLocal,usuario]
            )
        } else {
            const versionActual = rows[0].version ?? 1
            const nuevaVersion = versionLocal != null ? versionLocal : versionActual + 1
            console.log('registrarSync: ',id,versionActual,nuevaVersion)
            await cliente.query(
                `
                UPDATE sincronizacion SET 
                is_new = FALSE,
                is_update = TRUE,
                is_delete = FALSE,
                version = $2,
                usuario = $3,
                last_upd = NOW() WHERE id = $1
                `,[id,nuevaVersion,usuario]
            )
        }
    }

    async registrarUpdate(cliente,especie,correo,versionLocal = null){
        console.log('registrar Update ',especie.nombre_cientifico)
        return this.registrarSync({
            cliente,
            id:especie.nombre_cientifico,
            fila: especie,
            usuario: correo,
            versionLocal: versionLocal
        })
    }

    async registrarBorrado(cliente,id,correo){
        await cliente.query(
            `
                INSERT INTO sincronizacion (id,is_new,is_update,is_delete,version,usuario,last_upd)
                VALUES ($1, FALSE, FALSE,TRUE,1,$2,NOW()) ON CONFLICT (id)
                DO UPDATE SET 
                is_new = FALSE,
                is_update = FALSE,
                is_delete = TRUE,
                usuario = $2,
                version = sincronizacion.version + 1,
                last_upd = NOW()
                `, [id, correo]
        )
    }

    async limpiarSincronizacion(cliente) {
        const { rowCount } = await cliente.query('DELETE FROM sincronizacion')
    }
}