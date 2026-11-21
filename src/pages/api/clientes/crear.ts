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

    const {
      cedula,
      nombre,
      apellido,
      whatsapp = null,
      correo = null,
    } = body as Record<string, any>;

    const cedulaStr = String(cedula ?? '').trim();
    const nombreStr = String(nombre ?? '').trim();
    const apellidoStr = String(apellido ?? '').trim();
    const whatsappStr = String(whatsapp ?? '').trim();
    const correoStr = String(correo ?? '').trim();

    if (!cedulaStr || !nombreStr || !apellidoStr) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Cédula, nombre y apellido son obligatorios.',
        }),
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

    const { data: clienteId, error: rpcError } = await supabaseUser.rpc('crear_cliente', {
      p_cedula: cedulaStr,
      p_nombre: nombreStr,
      p_apellido: apellidoStr,
      p_whatsapp: whatsappStr || null,
      p_correo: correoStr || null,
    });

    if (rpcError || !clienteId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: rpcError?.message || 'No se pudo registrar el cliente.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: { id: clienteId, cliente_id: clienteId },
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : 'Error interno al registrar el cliente.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};