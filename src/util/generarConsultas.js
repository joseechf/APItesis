
const TABLAS_PERMITIDAS = new Set([
  'Flora',
  'Imagen',
  'Utilidad',
  'NombreComun',
  'Origen',
  'crecimiento',
  'siembra'
]);

function validarTabla(tabla) {
  if (!TABLAS_PERMITIDAS.has(tabla)) {
    throw new Error(`Tabla no permitida: ${tabla}`);
  }
}

function validarCampos(campos) {
  if (!Array.isArray(campos)) {
    throw new Error('Campos debe ser un array');
  }

  campos.forEach(campo => {
    if (!/^[a-zA-Z0-9_]+$/.test(campo)) {
      throw new Error(`Campo inválido: ${campo}`);
    }
  });
}

function validarCampoId(campoId) {
  if (!/^[a-zA-Z0-9_]+$/.test(campoId)) {
    throw new Error(`CampoId inválido: ${campoId}`);
  }
}

const CONSULTA_FLORA_COMPLETA = `
SELECT
    f.*,
    STRING_AGG(DISTINCT TRIM(n.nombre_comun), '|')            AS nombre_comun,
    STRING_AGG(DISTINCT TRIM(o.origen), '|')                  AS origen,
    STRING_AGG(DISTINCT TRIM(u.utilidad), '|')                AS utilidad,
    STRING_AGG(DISTINCT i.url_foto || '@@' || i.estado, '|')  AS imagen
FROM Flora AS f
INNER JOIN sincronizacion AS s
    ON s.id = f.nombre_cientifico
    AND s.is_delete = FALSE
LEFT JOIN Imagen AS i
    ON f.nombre_cientifico = i.nombre_cientifico
LEFT JOIN Utilidad AS u
    ON f.nombre_cientifico = u.nombre_cientifico
LEFT JOIN NombreComun AS n
    ON f.nombre_cientifico = n.nombre_cientifico
LEFT JOIN Origen AS o
    ON f.nombre_cientifico = o.nombre_cientifico
GROUP BY f.nombre_cientifico;
`;

const CONSULTA_FLORA_BY_ID = `
SELECT
    f.*,
    STRING_AGG(DISTINCT TRIM(n.nombre_comun), '|')            AS nombre_comun,
    STRING_AGG(DISTINCT TRIM(o.origen), '|')                  AS origen,
    STRING_AGG(DISTINCT TRIM(u.utilidad), '|')                AS utilidad,
    STRING_AGG(DISTINCT i.url_foto || '@@' || i.estado, '|')  AS imagen
FROM Flora AS f
LEFT JOIN Imagen AS i
    ON f.nombre_cientifico = i.nombre_cientifico
LEFT JOIN Utilidad AS u
    ON f.nombre_cientifico = u.nombre_cientifico
LEFT JOIN NombreComun AS n
    ON f.nombre_cientifico = n.nombre_cientifico
LEFT JOIN Origen AS o
    ON f.nombre_cientifico = o.nombre_cientifico
WHERE f.nombre_cientifico = ANY($1)
GROUP BY f.nombre_cientifico;
`;


export function generarConsultaSelect(tabla, campos = null, campoId = null) {

  // CASOS ESPECIALES
  if (tabla === 'todas') {
    return CONSULTA_FLORA_COMPLETA;
  }

  if (tabla === 'todosById') {
    return CONSULTA_FLORA_BY_ID;
  }

  // VALIDACION
  validarTabla(tabla);
  validarCampos(campos);

  const camposTexto = campos.join(',');

  if (campoId) {
    validarCampoId(campoId);
    return `SELECT ${camposTexto} FROM ${tabla} WHERE ${campoId} = $1;`;
  }

  return `SELECT ${camposTexto} FROM ${tabla};`;
}

export function generarConsultaInsert(tabla, campos) {

  validarTabla(tabla);
  validarCampos(campos);

  const camposTexto = campos.join(',');
  const placeholders = campos.map((_, i) => `$${i + 1}`).join(',');

  return `INSERT INTO ${tabla} (${camposTexto})
          VALUES (${placeholders})
          RETURNING *;`;
}

export function generarConsultaDelete(tabla, campoId) {

  validarTabla(tabla);
  validarCampoId(campoId);

  return `DELETE FROM ${tabla}
          WHERE ${campoId} = $1
          RETURNING *;`;
}

export function generarConsultaUpdate(tabla, campos, campoId) {

  validarTabla(tabla);
  validarCampoId(campoId);
  
  validarCampos(campos);

  const setClause = campos
    .map((campo, i) => `${campo} = $${i + 1}`)
    .join(',');

  return `UPDATE ${tabla}
          SET ${setClause}
          WHERE ${campoId} = $${campos.length + 1}
          RETURNING *;`;
}
