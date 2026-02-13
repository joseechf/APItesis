import { supabaseAdmin } from './client.js';

export async function resolveUserRole(userId) {
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('rol_actual, estado_rol')
        .eq('id', userId)
        .single();

    if (error || !data) {
        throw new Error('Perfil no encontrado');
    }

    return data;
}

export default resolveUserRole