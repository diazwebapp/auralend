import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

// Cliente de servidor utilizando las llaves de entorno
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_KEY;

export const POST: APIRoute = async ({ request }) => {
  try {
    // 1. Verificar el Content-Type (Asegurar que sea JSON o Form-data)
    const contentType = request.headers.get('content-type') || '';
    let body: any = {};

    if (contentType.includes('application/json')) {
      body = await request.json();
    } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      body = Object.fromEntries(formData.entries());
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Content-Type no soportado. Utilice application/json o form-data.',
          missing_fields: []
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Extraer parámetros
    const {
      nombre,
      apellido,
      whatsapp,
      correo,
      notas,
      monto,
      tasa = 20.00,
      fecha_entrega = new Date().toISOString().split('T')[0],
      metodo_pago = 'USDT'
    } = body;

    // 3. Validación estricta de campos obligatorios para informar si falta alguno
    const missingFields: string[] = [];
    if (!nombre) missingFields.push('nombre');
    if (!apellido) missingFields.push('apellido');
    if (!whatsapp) missingFields.push('whatsapp');
    if (!monto || isNaN(parseFloat(monto))) missingFields.push('monto');

    if (missingFields.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Faltan datos obligatorios para procesar el crédito.',
          missing_fields: missingFields
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Obtener el token de autorización (Bearer Token del usuario logueado)
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No se encontró el token de autorización (Sesión requerida).',
          missing_fields: ['Authorization Header']
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: { persistSession: false },
    });

    // Validar el usuario a partir del token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Token de sesión inválido o expirado.',
          missing_fields: []
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
await supabase.auth.setSession({
  access_token: token,
  refresh_token: typeof body.refresh_token === 'string' ? body.refresh_token : '',
});
    // 5. Ejecutar la función RPC en Supabase inyectando el usuario autenticado
    // Nota: Como estamos en backend con el token del usuario, configuramos la sesión supabase
    supabase.auth.setSession({ access_token: token, refresh_token: '' });

    const { data: prestamoId, error: rpcError } = await supabase.rpc('crear_cliente_y_prestamo', {
      p_nombre: nombre.trim(),
      p_apellido: apellido.trim(),
      p_whatsapp: whatsapp.trim(),
      p_correo: correo ? correo.trim() : null,
      p_notas: notas ? notas.trim() : null,
      p_monto: parseFloat(monto),
      p_tasa: parseFloat(tasa),
      p_fecha_entrega: fecha_entrega,
      p_metodo_pago: metodo_pago
    });

    if (rpcError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: rpcError.message,
          missing_fields: []
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6. Respuesta exitosa
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cliente y préstamo registrados exitosamente.',
        data: { prestamo_id: prestamoId }
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'Error interno del servidor.',
        missing_fields: []
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};