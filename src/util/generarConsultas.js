/*
const TABLAS_PERMITIDAS = new Set([
  'Flora',
  'Imagen',
  'Utilidad',
  'NombreComun',
  'Origen',
  'RegistroSembrado',
  'Sembrable',
  'Sembrable_RegistroSembrado',
  'Usuario'
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

const CONSULTA_REGISTRO_SEMBRADO = `
SELECT 
  rs.idRegistroSembrado,
  rs.idUsuario_fk,
  u.nombre,
  rs.fechaSembrado,
  json_agg(
    json_build_object(
      'nombreCientifico', f.nombreCientifico,
      'cantidad', srs.cantidadSembrado,
      'coord', json_build_object(
        'lat', ROUND(ST_Y(srs.coordenadas::geometry)::numeric, 6),
        'lng', ROUND(ST_X(srs.coordenadas::geometry)::numeric, 6)
      ),
      'estado', srs.estado
    )
    ORDER BY f.nombreCientifico
  ) AS relacion
FROM RegistroSembrado AS rs
INNER JOIN sembrable_RegistroSembrado AS srs
  ON srs.registroSembrado_fk = rs.idRegistroSembrado
INNER JOIN Sembrable AS s
  ON s.idSembrable = srs.sembrable_fk
INNER JOIN Flora AS f
  ON f.nombreCientifico = s.nombreCientifico
INNER JOIN Usuario AS u
  ON u.idUsuario = rs.idUsuario_fk
GROUP BY
  rs.idRegistroSembrado,
  rs.idUsuario_fk,
  u.nombre,
  rs.fechaSembrado;
`;

export function generarConsultaSelect(tabla, campos = null, campoId = null) {

  // CASOS ESPECIALES
  if (tabla === 'todas') {
    return CONSULTA_FLORA_COMPLETA;
  }

  if (tabla === 'todosById') {
    return CONSULTA_FLORA_BY_ID;
  }

  if (tabla === 'RegistroSembrado' && campos == null) {
    return CONSULTA_REGISTRO_SEMBRADO;
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

  if (tabla === 'Sembrable_RegistroSembrado') {
    return `INSERT INTO Sembrable_RegistroSembrado
      (sembrable_fk, registro_sembrado_fk, cantidad_sembrado, coordenadas, estado)
      VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4,$5),4326), $6)
      RETURNING *;`;
  }

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
  validarCampos(campos);
  validarCampoId(campoId);

  const setClause = campos
    .map((campo, i) => `${campo} = $${i + 1}`)
    .join(',');

  return `UPDATE ${tabla}
          SET ${setClause}
          WHERE ${campoId} = $${campos.length + 1}
          RETURNING *;`;
}

*/
export function generarConsultaSelect(tabla, campos = null, campoId = null) {
  if (tabla == 'todas') {
    return `SELECT
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
GROUP BY f.nombre_cientifico;`
  }
  if (tabla == 'todosById') {
    return `
          SELECT f.*,
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
        `
  }
  if (tabla == 'RegistroSembrado' && campos == null) {
    return `SELECT 
              rs.idRegistroSembrado,
              rs.idUsuario_fk,
              u.nombre,
              rs.fechaSembrado,
              json_agg(
                json_build_object(
                  'nombreCientifico', f.nombreCientifico,
                  'cantidad', srs.cantidadSembrado,
                  'coord', json_build_object(
                    'lat', ROUND(ST_Y(srs.coordenadas::geometry)::numeric, 6),
                    'lng', ROUND(ST_X(srs.coordenadas::geometry)::numeric, 6)
                  ),
                  'estado', srs.estado
                )
                ORDER BY f.nombreCientifico
              ) AS relacion
            FROM RegistroSembrado AS rs
            INNER JOIN sembrable_RegistroSembrado AS srs
              ON srs.registroSembrado_fk = rs.idRegistroSembrado
            INNER JOIN Sembrable AS s
              ON s.idSembrable = srs.sembrable_fk
            INNER JOIN Flora AS f
              ON f.nombreCientifico = s.nombreCientifico
            INNER JOIN Usuario AS u
              ON u.idUsuario = rs.idUsuario_fk
            GROUP BY
              rs.idRegistroSembrado,
              rs.idUsuario_fk,
              u.nombre,
              rs.fechaSembrado;`
  }
  if (campoId != '' && campoId != null) {
    console.log(`SELECT ${campos} FROM ${tabla} WHERE ${campoId} = $1;`)
    return `SELECT ${campos} FROM ${tabla} WHERE ${campoId} = $1;`
  } else {
    console.log(`SELECT ${campos} FROM ${tabla};`)
    return `SELECT ${campos} FROM ${tabla};`
  }
}

export function generarConsultaInsert(tabla, campos) {
  let vcampos = []
  if (tabla == 'Sembrable_RegistroSembrado') {
    return `INSERT INTO Sembrable_RegistroSembrado
     (sembrable_fk, registro_sembrado_fk, cantidad_sembrado, coordenadas, estado)
   VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4,$5),4326), $6)`;
  }
  if (!Array.isArray(campos)) {
    vcampos = campos.split(',').map(c => c.trim())
  } else {
    vcampos = campos
    campos = vcampos.join(',')
  }
  const interrogacion = vcampos.map((_, item) => {
    return `$${item + 1}`
  }).join(',')
  console.log(`INSERT INTO ${tabla} (${campos}) VALUES (${interrogacion}) RETURNING *;`)
  return `INSERT INTO ${tabla} (${campos}) VALUES (${interrogacion}) RETURNING *;`
}

export function generarConsultaDelete(tabla, campoId) {
  return `DELETE FROM ${tabla} WHERE ${campoId} = $1 RETURNING *;`
}


export function generarConsultaUpdate(tabla, campos, campoId) {
  //const vcampos = campos.split(',').map(c => c.trim())
  const grupo = campos
    .map((campo, index) => `${campo} = $${index + 1}`)
    .join(',')

  return `UPDATE ${tabla} SET ${grupo} WHERE ${campoId} = $${campos.length + 1} RETURNING *;`
}
