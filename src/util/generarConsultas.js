const TABLAS_PERMITIDAS = new Set([
    'Flora',
    'Imagen',
    'Utilidad',
    'NombreComun',
    'Origen',
    'crecimiento',
    'siembra'
])

function validarTabla(tabla) {
    if(!TABLAS_PERMITIDAS.has(tabla)){
        throw new Error(`Tabla no permitida: ${tabla}`)
    }
}

function validarCampos(campos) {
    if(!Array.isArray(campos)){
        throw new Error('Campos debe ser un array')
    }
    campos.forEach(campo => {
        if(!/^[a-zA-Z0-9_]+$/.test(campo)){
            throw new Error(`Campo inválido: ${campo}`)
        }
    })
}

function validarCampoId(campoId){
    if(!/^[a-zA-Z0-9_]+$/.test(campoId)){
        throw new Error(`Campo id inválido: ${campoId}`)
    }
}

const CONSULTA_FLORA_COMPLETA = `
    SELECT f.*, 
    coalesce((
        select json_agg(json_build_object('nombre_comun', n.nombre_comun))
        from NombreComun n
        where n.nombre_cientifico = f.nombre_cientifico
    ), '[]'::json
    ) AS "NombreComun",
    coalesce((
        select json_agg(json_build_object('origen', o.origen))
        from Origen o
        where o.nombre_cientifico = f.nombre_cientifico
    ), '[]'::json
    ) AS "Origen",
    coalesce((
        select json_agg(json_build_object('utilidad', u.utilidad))
        from Utilidad u
        where u.nombre_cientifico = f.nombre_cientifico
    ), '[]'::json
    ) AS "Utilidad",
    coalesce((
        select json_agg(json_build_object('url_foto',i.url_foto,'estado',i.estado))
        from Imagen i
        where i.nombre_cientifico = f.nombre_cientifico
    ), '[]'::json
    ) AS "Imagen"
    FROM Flora f
    INNER JOIN sincronizacion s
    ON s.id = f.nombre_cientifico AND s.is_delete = FALSE;
`


const CONSULTA_FLORA_BY_ID = `
     SELECT f.*, 
    coalesce((
        select json_agg(json_build_object('nombre_comun', n.nombre_comun))
        from NombreComun n
        where n.nombre_cientifico = f.nombre_cientifico
    ), '[]'::json
    ) AS "NombreComun",
    coalesce((
        select json_agg(json_build_object('origen', o.origen))
        from Origen o
        where o.nombre_cientifico = f.nombre_cientifico
    ), '[]'::json
    ) AS "Origen",
    coalesce((
        select json_agg(json_build_object('utilidad', u.utilidad))
        from Utilidad u
        where u.nombre_cientifico = f.nombre_cientifico
    ), '[]'::json
    ) AS "Utilidad",
    coalesce((
        select json_agg(json_build_object('url_foto',i.url_foto,'estado',i.estado))
        from Imagen i
        where i.nombre_cientifico = f.nombre_cientifico
    ), '[]'::json
    ) AS "Imagen"
    FROM Flora f
    WHERE f.nombre_cientifico = ANY($1);
`
export function generarConsultaSelect(tabla, campos = null, campoId = null){
    //casos especiales
    if(tabla === 'todas'){
        return CONSULTA_FLORA_COMPLETA
    }
    if(tabla === 'todoById'){
        return CONSULTA_FLORA_BY_ID
    }
    
    // validacion
    validarTabla(tabla)
    validarCampoId(campos)

    const camposTexto = campos.join(',')

    if(campoId){
        validarCampoId(campoId)
        return `SELECT ${camposTexto} FROM ${tabla} WHERE ${campoId} = $1`
    }
    return `SELECT ${camposTexto} FROM ${tabla};`
}

export function generarConsultaInsert(tabla, campos){
    validarTabla(tabla)
    validarCampos(campos)

    const camposTexto = campos.join(',')
    const placeholders = campos.map((_,i) => `$${i + 1}`).join(',')
    return `INSERT INTO ${tabla} (${camposTexto}) VALUES (${placeholders}) RETURNING*;`
}

export function generarConsultaDelete(tabla, campoId){
    validarTabla(tabla)
    validarCampoId(campoId)

    return `DELETE FROM ${tabla} WHERE ${campoId} = $1 RETURNING *;`
}

export function generarConsultaUpdate(tabla,campos,campoId){
    validarTabla(tabla)
    validarCampoId(campoId)
    validarCampos(campos)

    const setClause = campos.map((campo,i) => `${campo} = $${i + 1}`).join(',')
    
    return `UPDATE ${tabla} SET ${setClause} WHERE ${campoId} = $${campos.length + 1} RETURNING*;`
}