import pg from "pg";
import dotenv from "dotenv";

dotenv.config();
let pool = null;

export default async function inicializar() {

    if (!pool) {
        /*pool = new pg.Pool({
            host: process.env.HOST,
            port: process.env.POSTGRES_PORT,
            database: process.env.POSTGRES_DB,
            user: process.env.POSTGRES_USER,
            password: process.env.POSTGRES_PASSWORD,
        });*/
        const pool = new pg.Pool({  //conexion con la base de datos de supabase 
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});
// la conexion es postgresql://postgres.xpiagtkjmtzjsiwnngug:facillfacilita@aws-0-us-west-2.pooler.supabase.com:6543/postgres

        try {
            const client = await pool.connect();

            return {
                status: 200,
                data: client,
            };

        } catch (error) {
            return {
                status: 500,
                error: {
                    code: error.code,
                    tablaAfectada: error.table,
                    constraint: error.constraint,
                    message: error.message,
                }
            };

        }
    } else {
        const client = await pool.connect();
        return { status: 200, data: client };
    }
}
