import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_KEY;

export const POST: APIRoute = async ({ params, request, cookies, redirect }) => {
  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ success: false, error: 'Falta el ID del préstamo.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const contentType = request.headers.get('content-type') || '';
  const isFormSubmit =
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data');

  let montoRaw: unknown;
  let metodoRaw: unknown;
  let referenciaRaw: unknown;

  if (contentType.includes('application/json')) {
    const body = await request.json();
    montoRaw = body?.monto;
    metodoRaw = body?.metodo;
    referenciaRaw = body?.referencia;
  } else {
    const formData = await request.formData();
    montoRaw = formData.get('monto');
    metodoRaw = formData.get('metodo');
    referenciaRaw = formData.get('referencia');
  }

  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.replace('Bearer ', '').trim()
    : cookies.get('sb-access-token')?.value;

  if (!token) {
    if (isFormSubmit) return redirect(`/prestamos/${id}?error=sesion`);
    return new Response(JSON.stringify({ success: false, error: 'No autorizado.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const monto = Number(montoRaw);
  const metodo = String(metodoRaw || 'USDT - Binance Pay').trim();
  const referencia = referenciaRaw ? String(referenciaRaw).trim() : null;

  if (!Number.isFinite(monto) || monto <= 0) {
    if (isFormSubmit) return redirect(`/prestamos/${id}?error=monto`);
    return new Response(JSON.stringify({ success: false, error: 'Monto inválido.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { persistSession: false },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    if (isFormSubmit) return redirect(`/prestamos/${id}?error=sesion`);
    return new Response(JSON.stringify({ success: false, error: 'Sesión inválida.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: resultado, error: rpcError } = await supabase.rpc('registrar_pago_bancario', {
    p_prestamo_id: id,
    p_monto_pagado: monto,
    p_metodo_pago: metodo,
    p_referencia: referencia,
  });

  if (rpcError) {
    if (isFormSubmit) {
      return redirect(`/prestamos/${id}?error=${encodeURIComponent(rpcError.message)}`);
    }
    return new Response(JSON.stringify({ success: false, error: rpcError.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (isFormSubmit) {
    return redirect(`/prestamos/${id}?pago=ok`);
  }

  return new Response(JSON.stringify({ success: true, data: resultado }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};