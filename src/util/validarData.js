import { tablas } from "./detallesTabla.js"

const PATRON_VALIDO = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s.-]+$/
const MAX_LENGTH = 100

class ValidadorBase {
    static error(message, valor = null){
        return {ok: false, error: message, valor}
    }
    static ok(valor = null){
        return {ok: true, error: valor ? valor : null, valor}
    }
    static validarnc(nc){
        if(nc === null || nc === undefined){
            return this.error('nombre_cientifico: no puede ser null')
        } else if (typeof nc !== 'string'){
            return this.error('nombre_cientifico: debe ser un string')
        } else if (!PATRON_VALIDO.test(nc)){
            return this.error('nombre_cientifico: nombre muy largo o pequeño')
        }
        return this.ok(nc)
    }

    static validarString(val, campo) {
        if(val === null || val === undefined) return this.ok(null)

        if(typeof val !== 'string') return this.error(`${campo}: no es string`)
        const t = val.trim()

        if(!t) return this.error(`${campo}: vacío`)
        if(t.length > MAX_LENGTH) return this.error(`${campo}: > ${MAX_LENGTH}`)
        if(!PATRON_VALIDO.test(t)) return this.error(`${campo}: invalido`)
        
        return this.ok(val)
    }

    static validarNumeroGeneral(valor){
        if(valor === null || valor === undefined) return false
        if(typeof valor === 'boolean' ) return false
        if(Array.isArray(valor)) return false
        if(typeof valor === 'string' && valor.trim() === '') return false
        return Number.isFinite(Number(valor))
    }

    static validarNumero(dato, campo) {
        const num = Number(dato)
        if(Number.isNaN(num)){
            return this.error(`${campo} debe ser un número`)
        }
        if(num <= 0){
            return this.error(`${campo} debe ser mayor a 0`)
        }
        return this.ok(num)
    }

    static validarFecha(fecha){
        if(typeof fecha !== 'string') return this.error('Fecha debe ser un string')
        const regex = /^\d{4}-\d{2}-\d{2}$/
        
        if(!regex.test(fecha)){
            return this.error('Formato de fecha inválido')
        }

        const [y, m, d] = fecha.split('-').map(Number)
        const date = new Date(y,m - 1, d)

        if(date.getFullYear() !== y || date.getMonth() !== m -1 || date.getDate() !== d){
            return this.error('Fecha inválida')
        }
        return this.ok(fecha)
    }

    static validarLatLon(punto, campo = 'coordenadas'){
        if(!Array.isArray(punto) || punto.length !== 2){
            return this.error(`${campo} debe ser [longitud, latitud]`)
        }
        if(!this.validarNumeroGeneral(punto[0]) || !this.validarNumeroGeneral(punto[1])) return this.error(`${campo} deben ser numeros`)
        
        const lon = Number(punto[0])
        const lat = Number(punto[1])

        if(lon < -180 || lon > 180) {
            return this.error(`${campo}: longitud fuera de rango`)
        }
        if(lat < -90 || lat > 90) {
            return this.error(`${campo}: latitud fuera de rango`)
        }
        return this.ok([lon,lat])
    }
}

export class ValidadorFlora extends ValidadorBase {
    static validarIntBoolean(val, campo) {
        if(val === null || val === undefined) return {ok: true, valor: null}
        const n = typeof val === 'string' ? parseInt(val,10) : val

        if(!Number.isInteger(n) || (n !== 0 && n !== 1)){
            return {ok: false, error: `${campo}: debe ser 0 o 1`}
        }
        return {ok: true, valor: n}
    }

    static validarValor(val, campo){
        if(campo === 'cobertura'){
            const num = Number(val)
            return (!isNaN(num) && num >= 0) ? {ok: true, valor: num} : {ok: false, error: `${campo}: valor invalido`}
        }
        if(val === null || val === undefined) return {ok: true, valor: null}
        if(typeof val === 'boolean') return {ok: false, error: `${campo}: boolean no permitido`}
        const numerosbooleanos = ['da_sombra','salud_suelo','pionero','nativo_america','nativo_panama','nativo_azuero']
        if(numerosbooleanos.includes(campo)){
            return this.validarIntBoolean(val, campo)
        }else {
            return this.validarString(val, campo)
        }
    }

    static validarNombre(fileName) {
        const regex = /^[a-zA-Z0-9_-]+_\d+\.jpg$/
        if(typeof fileName !== 'string' || !regex.test(fileName)){
            return false
        } else {
            return true
        }
    }
    
    static validarUrl(url){
        if(typeof url !== 'string'){
            return {ok: false, error: 'url invalida'}
        }
        const urlLimpia = url.replaceAll('','')
        try {
            const parsed = new URL(urlLimpia)
            const baseUrl = process.env.PUBLIC_BASE_URL
            if(!urlLimpia.startsWith(`${baseUrl}/imagenes`)){
                return {ok: false, error:'url invalida'}
            }
            const nombreArchivo = parsed.pathname.split('/').pop()
            if(!this.validarNombre(nombreArchivo)){
                return {ok: false, error: 'nombre del archivo incorrecto'}
            }
            return {ok: true, valor: urlLimpia}
        } catch (error) {
            return {ok: false, error: 'url invalida'}
        }
    }

    static validar(obj){
        const errores = []
        const datos = {Flora: {}, listas: {}}
        const nc = this.validarnc(obj.nombre_cientifico)
        if(nc.ok){
            datos.nombre_cientifico = nc.valor
        }else{
            errores.push(nc.error)
        }
        // recorrer tablas

        for(const tabla of tablas){
            const nombreTabla = Object.keys(tabla)[0]
            const campos = Object.values(tabla)[0]

            // flora (campos planos)
            if(nombreTabla === 'Flora'){
                for(const campo of campos){
                    const r = this.validarValor(obj[campo],campo)
                    if(!r.ok){ 
                        errores.push(r.error)
                    }else {
                        datos.Flora[campo] = r.valor
                    }
                    continue
                }
            }
            const lista = obj[nombreTabla] ?? []

                // imagen (multi-campo)
            if(nombreTabla === 'Imagen'){
                    const imgs = []
                    for(let i = 0; i < lista.length; i++){
                        const item = lista[i]
                        const url = this.validarUrl(item?.url_foto)
                        const est = this.validarString(item?.estado, `Imagen[${i}].estado`)

                        if(!url.ok){
                            errores.push(url.error)
                        }
                        if(!est.ok){
                            errores.push(est.error)
                        }
                        if(url.ok && est.ok){
                            imgs.push({url: url.valor, estado: est.valor})
                        }
                    }
                    datos.listas.Imagen = imgs
                    continue
            }

                // tablas simples (1 campo)
                const campo = Array.isArray(campos) ? campos[0] : campos
                const resultado = []

                for(let i = 0; i < lista.length; i++){
                    const r = this.validarValor(lista[i]?.[campo],`${nombreTabla}[${i}].${campo}`)
                    if(!r.ok){
                        errores.push(r.error)
                    }else{
                        resultado.push({[campo]: r.valor})
                    }

                    datos.listas[nombreTabla] = resultado
                }
        }
        return {
                    ok: errores.length === 0,
                    errores,
                    datos: errores.length === 0 ? datos : null
        }
        
    } 
}

        export class ValidarCrecimiento extends ValidadorBase {
            static validar(obj){
                const errores = []
                if(!obj.id_siembra) {
                    errores.push('id_siembra requerida')
                }
                const fecha = this.validarFecha(obj.fecha)
                if(!fecha.ok){
                    errores.push(fecha.error)    
                }
                const altura_promedio = this.validarNumero(obj.altura_promedio, 'altura_promedio')
                if(!altura_promedio.ok) {
                    errores.push(altura_promedio.error)
                }
                const porcentaje_salud = this.validarNumero(obj.porcentaje_salud,'porcentaje salud')
                if(!porcentaje_salud.ok){
                    errores.push(porcentaje_salud.error)
                }
                return {
                    ok: errores.length === 0,
                    errores
                }
            }
            }

        export class ValidarSiembra extends ValidadorBase {
            static validar(obj) {
                const errores = []

                const nc = this.validarnc(obj.nombre_cientifico)
                if(!nc.ok){
                    errores.push(nc.error)
                }
                const fecha = this.validarFecha(obj.fecha_siembra)
                if(!fecha.ok){
                    errores.push(fecha.error)
                }
                const cantidad = this.validarNumero(obj.cantidad, 'cantidad')
                if(!cantidad.ok){
                    errores.push(cantidad.error)
                }
                const distrito = this.validarString(obj.distrito,'distrito')
                if(!distrito.ok){
                    errores.push(distrito.error)
                }
                const coordenadas = this.validarLatLon(obj.coordenadas,'coordenadas')
                if(!coordenadas.ok){
                    errores.push(coordenadas.error)
                }
                console.log('ERRORES VALIDACION SIEMBRA',errores)
                return {
                    ok: errores.length === 0,
                    errores
                }
            }
        } 

        export class ValidarTerreno extends ValidadorBase {
            static validar(obj){
                const errores = []
                const dueno = this.validarString(obj.dueno)
                if(!dueno.ok){
                    errores.push(dueno.error)
                }
                const tamano = this.validarNumero(obj.tamano)
                if(!tamano.ok){
                    errores.push(tamano.error)
                }
                const inicio_reforestacion = this.validarFecha(obj.inicio_reforestacion)
                if(!inicio_reforestacion.ok){
                    errores.push(inicio_reforestacion.error)
                }
                const poligon = this.validarGeoJsonPoligono(obj.coordenadas,'coordenadas')
                if(!poligon.ok){
                    errores.push(poligon.error)
                }

                return {
                    ok: errores.length === 0,
                    errores
                }
            }

            static validarGeoJsonPoligono(valor, campo = 'poligono'){
                if(typeof valor !== 'string'){
                    return this.error(`${campo} debe ser un string GeoJSON`)
                }
                let geoJSON
                try {
                    geoJSON = JSON.parse(valor)
                } catch (error) {
                    return this.error(`GeoJSON invalido`)
                }
                if(geoJSON.type !== 'Polygon'){
                    return this.error(`${campo} debe ser tipo Polygon`)
                }
                if(!Array.isArray(geoJSON.coordinates) || geoJSON.coordinates.length !== 1){
                    return this.error(`${campo} coordenadas debe contener un anillo`)
                }
                const poligon = geoJSON.coordinates[0]
                return this.validarPoligono(poligon,campo)
            }

            static validarPoligono(poligono, campo = 'poligono'){
                if(!Array.isArray(poligono) || poligono.length < 4){
                    return this.error(`${campo} deben tener al menos 4 puntos`)
                }
                const puntos = []
                for(let i = 0; i < poligono.length; i++){
                    const r = this.validarLatLon(poligono[i],`${campo}[${i}]`)
                    if(!r.ok){
                        return r
                    }
                    puntos.push(r.valor)
                }
                const primero = puntos[0] 
                const ultimo = puntos[puntos.length - 1]
                if(primero[0] !== ultimo[0] || primero[1] !== ultimo[1]){
                    return this.error('el primero y ultimo punto del poligono deben ser iguales')
                }
                return this.ok(puntos)
            }
        }
