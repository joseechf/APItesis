import pg from "pg";
import dotenv from "dotenv";

dotenv.config();
let pool = null;

export default async function inicializar(){
    if(!pool){
        pool = new pg.Pool({
            host:process.env.HOST,
            port:process.env.POSTGRES_PORT,
            database: process.env.POSTGRES_DB,
            user: process.env.POSTGRES_USER,
            password: process.env.POSTGRES_PASSWORD,
        });
        try {
            const client = await pool.connect();
            return {status:200,data:client};
        } catch (error) {
            const errorFormateado = {
                code: error.code,
                tablaAfectada: error.table,
                constraint: error.constraint,
                message: error.message,
            }
            return errorFormateado;
        }
    }else{
        const client = await pool.connect();
        return {status:200,data:client};
    }
}