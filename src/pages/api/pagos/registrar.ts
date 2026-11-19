import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_KEY;

/**
 * @api {post} /api/pagos/registrar Registrar Abono o Pago de Cuota
 * @apiDescription Registra un movimiento de pago sobre un préstamo activo, aplicando interés primero y capital después.
 * 
 * @apiBody {UUID} prestamo_id ID único del préstamo.
 * @apiBody {Number} monto_pagado Monto total abonado en la moneda del crédito (ej. USDT).
 * @apiBody {String} [metodo_pago] Método utilizado (Binance Pay, Efectivo, etc.).
 * @apiBody {String} [referencia] Hash o número de comprobante de pago.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
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

    const { prestamo_id, monto_pagado, metodo_pago = 'USDT', referencia = '' } = body;

    // Validación estricta informando campos faltantes
    const missingFields: string[] = [];
    if (!prestamo_id) missingFields.push('prestamo_id');
    if (!monto_pagado || isNaN(parseFloat(monto_pagado)) || parseFloat(monto_pagado) <= 0) {
      missingFields.push('monto_pagado');
    }

    if (missingFields.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Faltan datos obligatorios para procesar el pago o el monto es inválido.',
          missing_fields: missingFields
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validación de Token de Autenticación
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No se encontró el token de autorización de la sesión.',
          missing_fields: ['Authorization Header']
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });

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

    supabase.auth.setSession({ access_token: token, refresh_token: '' });

    // Ejecutar la función RPC para registrar el pago bancario
    const { data: resultadoPago, error: rpcError } = await supabase.rpc('registrar_pago_bancario', {
      p_prestamo_id: prestamo_id,
      p_monto_pagado: parseFloat(monto_pagado),
      p_metodo_pago: metodo_pago,
      p_referencia: referencia
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

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Pago procesado e imputado correctamente.',
        data: resultadoPago
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
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