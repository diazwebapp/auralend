import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params, locals }) => {
  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ success: false, error: 'Falta el ID del préstamo.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!locals.user || !locals.supabase) {
    return new Response(JSON.stringify({ success: false, error: 'No autorizado.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: prestamo, error: pError } = await locals.supabase
    .from('prestamos')
    .select('*')
    .eq('id', id)
    .single();

  if (pError || !prestamo) {
    return new Response(JSON.stringify({ success: false, error: 'Préstamo no encontrado.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: cliente, error: cError } = await locals.supabase
    .from('clientes')
    .select('*')
    .eq('id', prestamo.cliente_id)
    .single();

  if (cError || !cliente) {
    return new Response(JSON.stringify({ success: false, error: 'Cliente no encontrado.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: movimientos } = await locals.supabase
    .from('movimientos')
    .select('*')
    .eq('prestamo_id', id)
    .order('creado_en', { ascending: false });

  return new Response(
    JSON.stringify({
      success: true,
      data: { prestamo, cliente, movimientos: movimientos ?? [] },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};