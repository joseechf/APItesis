import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors';
import cookieParser from 'cookie-parser'
import routerPrivadoFlora from './src/router/metodosFlora/privadosFlora.js';
import routerAdmin from './src/router/metodosAdmin.js';
import authMiddleware from './src/router/auth/jwtMiddleware.js'
//import resolveUserRole from './src/router/auth/getRol.js'
import routerPublicFlora from './src/router/metodosFlora/publicosFlora.js'

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_PATH = path.join(__dirname, '..');

dotenv.config()

//const secret = process.env.ACCESS_TOKEN_SECRET
const app = express()
const corsOptions = {
  //origin: ['http://localhost:8080'],   // origen exacto de Flutter Web
  origin: true,
  credentials: true,                    // permite cookies / auth
  optionsSuccessStatus: 200             // necesario para algunos navegadores
};

app.use(cors(corsOptions));
app.use(express.json())
app.use(cookieParser())

app.get('/', (req, res) => {
  res.send('message')
})

app.use(routerPublicFlora);

app.use(
  '/imagenes',
  express.static(path.join(ROOT_PATH, 'public/imagenes'))
);

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.use(authMiddleware, async (req, res, next) => {
  console.log('authMiddleware...')
  try {
    //const { userId } = req.auth;

    //const { rol_actual, estado_rol } = await resolveUserRole(userId);
    //const permitido =
    //['cientifico', 'administrador'].includes(rol_actual) && estado_rol === 'aprobado';
    const permitido = true;
    if (!permitido) {
      console.log('Sin permisos para editar la base de datos: ', permitido)
      return res.status(403).json({
        ok: false,
        error: 'Sin permisos para editar la base de datos',
      });
    }

    next()
  } catch (err) {
    console.log(err)
    res.status(500).json({ message: err });
  }
})

app.use(routerPrivadoFlora)

app.use(routerAdmin)

app.use((res) => {
  res.send(' NO ENCONTRAMOS ESA RUTA ')
})

const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`API corriendo en http://${HOST}:${PORT}`);
  console.log(`Imágenes en http://${HOST}:${PORT}/imagenes/`);
});

