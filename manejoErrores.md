podría retornar
'''
catch (error) {
            const errorFormateado = {
                code: error.code,
                tablaAfectada: error.table,
                constraint: error.constraint,
                message: error.message,
            }
            throw errorFormateado;
'''
hay varias funciones que pasan antes de la consulta, esas funciones simplemente devolverían el error sin tocarlo
'''
catch (error) {
        return {ok: false, error}
    }
'''
y la api retorna
'''
catch (error) {
  res.status(500).json({
    message: error?.message ?? 'Error interno',
    code: error?.code,
    tablaAfectada: error?.tablaAfectada,
    constraint: error?.constraint,
  });
}
'''
así en flutter
'''
if (response.statusCode != 200) {
  final error = jsonDecode(response.body);
  Text(error['message']);
}
'''