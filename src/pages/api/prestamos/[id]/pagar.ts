import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const jsonHeaders = { 'Content-Type': 'application/json' };
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_KEY;

export const POST: APIRoute = async ({ params, request, cookies, locals }) => {
  try {
    const { id } = params;
    if (!id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Falta el ID del préstamo.' }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.replace('Bearer ', '').trim()
      : cookies.get('sb-access-token')?.value?.trim() || null;

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'No autorizado: falta token de sesión.' }),
        { status: 401, headers: jsonHeaders }
      );
    }

    const body = await request.json();
    const monto = Number(String(body?.monto ?? '').replace(',', '.'));
    const metodo = String(body?.metodo ?? 'USDT - Binance Pay').trim();
    const referencia = body?.referencia ? String(body.referencia).trim() : null;

    if (!Number.isFinite(monto) || monto <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'El monto debe ser mayor a 0.' }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const supabase =
      locals.supabase && locals.user
        ? locals.supabase
        : createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false },
          });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sesión inválida o expirada.' }),
        { status: 401, headers: jsonHeaders }
      );
    }

    const { error: rpcError } = await supabase.rpc('registrar_pago_bancario', {
  p_prestamo_id: id,
  p_monto_pagado: monto,
  p_metodo_pago: metodo,
});

if (rpcError) {
  return new Response(
    JSON.stringify({ success: false, error: rpcError.message }),
    { status: 400, headers: jsonHeaders }
  );
}

// Recuperar el ID del movimiento recién insertado para asociar el comprobante
const { data: ultimoMovimiento } = await supabase
  .from('movimientos')
  .select('id')
  .eq('prestamo_id', id)
  .order('creado_en', { ascending: false })
  .limit(1)
  .single();

return new Response(
  JSON.stringify({
    success: true,
    data: {
      movimiento_id: ultimoMovimiento?.id ?? null,
    },
  }),
  { status: 200, headers: jsonHeaders }
);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno al registrar el pago.';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: jsonHeaders }
    );
  }
};