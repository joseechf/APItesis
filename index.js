import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import routerPrivadoFlora from './src/router/metodosFlora/privadosFlora.js' 
import monitoreo from './src/router/metodosFlora/monitoreo.js'
import Siembra from './src/router/metodosFlora/privadosMonitoreo.js'
import authMiddleware from './src/router/auth/jwtMiddleware.js'
import obtenerRolUsuario from './src/router/auth/getRol.js'
import routerPublicFlora from './src/router/metodosFlora/publicosFlora.js'
import reporte from './src/router/report/reporte.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_PATH = path.join(__dirname,'..')

dotenv.config()

const app = express()
const corsOptions = {
    origin: true,
    credentials: true,
    optionsSuccessStatus: 200
}

app.use(cors(corsOptions))
app.use(express.json())

app.use((err,req,res,next) => {
    if(err instanceof SyntaxError && err.status === 400 && 'body' in err){
        return res.status(400).json({ok: false, message: 'JSON mal formado...'})
    }
    next(err)
})
app.use(cookieParser())

app.get('/',(req,res) => {
    res.send('message')
})

app.use(routerPublicFlora)

app.use(monitoreo)

app.use(
    '/imagenes', express.static(path.join(ROOT_PATH, 'public/imagenes'))
)

app.use((req,res,next) => {
    next()
})

app.use(authMiddleware, async (req, res, next) => {
    try {
        const {userId} = req.auth
        const { rol_actual, estado_rol } = await obtenerRolUsuario(userId)
        const permitido = ['cientifico','administrador'].includes(rol_actual) && estado_rol === 'aprobado'
        if(!permitido){
            const salida = {
                ok: false,
                status: 403,
                error: {
                    type: 'autenticacion',
                    message: 'Sin permisos para editar la base de datos, revise su rol'
                }
            }
            console.log('error al intentar eliminar: ',salida)
            return res.status(403).json(salida)
        }
        next()
    } catch (error) {
        console.log(error)
        res.status(500).json({message: err})
    } 
})

app.use(routerPrivadoFlora)
app.use(Siembra)
app.use(reporte)

app.use((err, req, res, next) => {
    res.status(err.status || 500).send(err.message || 'Error interno')
    next(err)
})

const PORT = process.env.PORT || 3001
const HOST = '0.0.0.0'

app.listen(PORT,HOST, () => {
    console.log(`API corriendo en http://${HOST}:${PORT}`)
})

