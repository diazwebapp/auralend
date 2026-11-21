import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const POST: APIRoute = async ({ request }) => {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token de autenticación requerido.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return new Response(
        JSON.stringify({ success: false, error: 'Cuerpo JSON inválido.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Extraer parámetros del préstamo vinculados por UUID del cliente
    const {
      cliente_id,
      monto,
      tasa = 20.0,
      fecha_entrega = new Date().toISOString().split('T')[0],
      fecha_proximo_pago = null,
      estado = 'activo',
      metodo_pago = 'USDT',
    } = body as Record<string, any>;

    const montoNum = parseFloat(String(monto ?? '').replace(',', '.'));
    const tasaNum = parseFloat(String(tasa ?? '20').replace(',', '.'));

    if (!cliente_id || typeof cliente_id !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'El campo cliente_id (UUID) es obligatorio.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'El monto debe ser un número mayor a 0.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseKey = import.meta.env.PUBLIC_SUPABASE_KEY;

    const supabaseUser = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: { persistSession: false },
    });

    const { data: prestamoId, error: rpcError } = await supabaseUser.rpc(
      'crear_prestamo_cliente',
      {
        p_cliente_id: cliente_id.trim(),
        p_monto: montoNum,
        p_tasa: Number.isFinite(tasaNum) && tasaNum >= 0 ? tasaNum : 20.0,
        p_fecha_entrega: fecha_entrega,
        p_fecha_proximo_pago: fecha_proximo_pago || null,
        p_estado: estado || 'activo',
        p_metodo_pago: metodo_pago || 'USDT',
      }
    );

    if (rpcError || !prestamoId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: rpcError?.message || 'No se pudo crear el préstamo.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: { id: prestamoId, prestamo_id: prestamoId, cliente_id },
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : 'Error interno al crear el préstamo.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};