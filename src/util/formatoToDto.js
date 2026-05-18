// esta función convierte los String VO a listas con valores separados, en vez de algo|algo2 => algo, algo2
function formatearEspecieParaDTO(raw) {
    const separador = (str) =>
        typeof str === 'string' && str.trim().length
            ? str.split('|').map(s => s.trim()).filter(Boolean)
            : [];

    const toObjList = (arr, key) =>
        arr.length ? arr.map(value => ({ [key]: value })) : null;

    const imagenes = separador(raw.imagen).map(chunk => {
        const [url_foto = '', estado = 'tentativo'] = chunk.split('@@');
        return { url_foto, estado };
    });

    return {
        nombre_cientifico: raw.nombre_cientifico,
        da_sombra: raw.da_sombra,
        flor_distintiva: raw.flor_distintiva,
        fruta_distintiva: raw.fruta_distintiva,
        salud_suelo: raw.salud_suelo,
        huespedes: raw.huespedes,
        forma_crecimiento: raw.forma_crecimiento,
        pionero: raw.pionero,
        polinizador: raw.polinizador,
        ambiente: raw.ambiente,
        establecido_sol_sombra: raw.establecido_sol_sombra,
        nativo_america: raw.nativo_america,
        nativo_panama: raw.nativo_panama,
        nativo_azuero: raw.nativo_azuero,
        estrato: raw.estrato,
        cobertura: raw.cobertura,

        NombreComun: toObjList(
            separador(raw.nombre_comun),
            'nombre_comun'
        ),

        Utilidad: toObjList(
            separador(raw.utilidad),
            'utilidad'
        ),

        Origen: toObjList(
            separador(raw.origen),
            'origen'
        ),

        Imagen: imagenes.length ? imagenes : null,
    };
}

export default formatearEspecieParaDTO;
