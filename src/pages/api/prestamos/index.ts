import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const jsonHeaders = {
  'Content-Type': 'application/json',
};

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_KEY;

function extractToken(request: Request, cookies: { get: (name: string) => { value?: string } | undefined }): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const bearer = authHeader.replace('Bearer ', '').trim();
    if (bearer) return bearer;
  }

  const cookieToken = cookies.get('sb-access-token')?.value?.trim();
  return cookieToken || null;
}

export const GET: APIRoute = async ({ request, cookies, locals, url }) => {
  try {
    const token = extractToken(request, cookies);

    if (!token) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No autorizado: token de sesión requerido.',
        }),
        { status: 401, headers: jsonHeaders }
      );
    }

    const supabase =
      locals.supabase && locals.user
        ? locals.supabase
        : createClient(supabaseUrl, supabaseKey, {
            global: {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
            auth: { persistSession: false },
          });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No autorizado: sesión inválida o expirada.',
        }),
        { status: 401, headers: jsonHeaders }
      );
    }

    const estado = url.searchParams.get('estado');

    let query = supabase
      .from('prestamos')
      .select('*, clientes(id, nombre, apellido, whatsapp, notas)')
      .eq('admin_id', user.id)
      .order('fecha_proximo_pago', { ascending: true });

    if (estado && estado !== 'todos') {
      query = query.eq('estado', estado);
    }

    const { data: prestamos, error: pError } = await query;

    if (pError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: pError.message,
        }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const lista = prestamos ?? [];

    const resumen = lista.reduce(
      (acc, item: Record<string, unknown>) => {
        acc.totalAcreditado += Number(item.monto_acreditado || 0);
        acc.capitalPendiente += Number(item.capital_restante || 0);
        acc.interesPendiente += Number(item.interes_pendiente_ciclo || 0);
        return acc;
      },
      {
        totalAcreditado: 0,
        capitalPendiente: 0,
        interesPendiente: 0,
      }
    );

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          prestamos: lista,
          resumen,
        },
      }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno del servidor.';
    return new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      { status: 500, headers: jsonHeaders }
    );
  }
};