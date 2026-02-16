import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

let pool = null;

export default async function inicializar() {

    if (!pool) {
        pool = new pg.Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false,
            },
        });
    }

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
}
