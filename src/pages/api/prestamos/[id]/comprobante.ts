import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const jsonHeaders = { 'Content-Type': 'application/json' };
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_KEY;
const BUCKET_NAME = 'documentos-prestamos';
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

function extractToken(
  request: Request,
  cookies: { get: (name: string) => { value?: string } | undefined }
): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const bearer = authHeader.replace('Bearer ', '').trim();
    if (bearer) return bearer;
  }
  const cookieToken = cookies.get('sb-access-token')?.value?.trim();
  return cookieToken || null;
}

function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80);
}

export const POST: APIRoute = async ({ params, request, cookies, locals }) => {
  try {
    const prestamoId = params.id;
    if (!prestamoId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Falta el ID del préstamo.' }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const token = extractToken(request, cookies);
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'No autorizado: token requerido.' }),
        { status: 401, headers: jsonHeaders }
      );
    }

    const supabase =
      locals.supabase && locals.user
        ? locals.supabase
        : createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false },
          });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sesión inválida o expirada.' }),
        { status: 401, headers: jsonHeaders }
      );
    }

    // Verificar que el préstamo exista y pertenezca al usuario autenticado
    const { data: prestamo, error: pError } = await supabase
      .from('prestamos')
      .select('id, admin_id')
      .eq('id', prestamoId)
      .eq('admin_id', user.id)
      .single();

    if (pError || !prestamo) {
      return new Response(
        JSON.stringify({ success: false, error: 'Préstamo no encontrado o sin permisos.' }),
        { status: 404, headers: jsonHeaders }
      );
    }

    const formData = await request.formData();
    const archivo = formData.get('archivo');
    const movimientoIdRaw = formData.get('movimiento_id');
    const movimientoId =
      typeof movimientoIdRaw === 'string' && movimientoIdRaw.trim().length > 0
        ? movimientoIdRaw.trim()
        : null;

    if (!archivo || !(archivo instanceof File)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Debes adjuntar un archivo de comprobante.' }),
        { status: 400, headers: jsonHeaders }
      );
    }

    if (!ALLOWED_TYPES.includes(archivo.type)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Formato no permitido. Usa JPG, PNG, WEBP o PDF.',
        }),
        { status: 400, headers: jsonHeaders }
      );
    }

    if (archivo.size <= 0 || archivo.size > MAX_BYTES) {
      return new Response(
        JSON.stringify({ success: false, error: 'El archivo debe pesar entre 1 byte y 5 MB.' }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const safeName = sanitizeFileName(archivo.name || 'comprobante');
    const storagePath = `${user.id}/${prestamoId}/${Date.now()}-${safeName}`;
    const arrayBuffer = await archivo.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, arrayBuffer, {
        contentType: archivo.type,
        upsert: false,
      });

    if (uploadError) {
      return new Response(
        JSON.stringify({ success: false, error: `Error al subir archivo: ${uploadError.message}` }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const { data: docRecord, error: dbError } = await supabase
      .from('documentos_prestamo')
      .insert({
        admin_id: user.id,
        prestamo_id: prestamoId,
        movimiento_id: movimientoId,
        tipo_documento: 'capture_pago',
        bucket_id: BUCKET_NAME,
        storage_path: storagePath,
        mime_type: archivo.type,
        tamano_bytes: archivo.size,
      })
      .select()
      .single();

    if (dbError) {
      // Limpiar archivo huérfano si falla el registro en base de datos
      await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Error al guardar metadatos del comprobante: ${dbError.message}`,
        }),
        { status: 400, headers: jsonHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: docRecord,
      }),
      { status: 201, headers: jsonHeaders }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno al subir el comprobante.';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: jsonHeaders }
    );
  }
};

export const GET: APIRoute = async ({ params, request, cookies, locals, url }) => {
  try {
    const prestamoId = params.id;
    const movimientoId = url.searchParams.get('movimiento_id')?.trim();
    const docId = url.searchParams.get('doc_id')?.trim();

    if (!prestamoId || (!movimientoId && !docId)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Falta prestamo_id o identificador del comprobante (movimiento_id o doc_id).',
        }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const token = extractToken(request, cookies);
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'No autorizado: token requerido.' }),
        { status: 401, headers: jsonHeaders }
      );
    }

    const supabase =
      locals.supabase && locals.user
        ? locals.supabase
        : createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false },
          });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sesión inválida o expirada.' }),
        { status: 401, headers: jsonHeaders }
      );
    }

    let query = supabase
      .from('documentos_prestamo')
      .select('id, bucket_id, storage_path, mime_type')
      .eq('prestamo_id', prestamoId)
      .eq('admin_id', user.id)
      .eq('tipo_documento', 'capture_pago');

    if (docId) {
      query = query.eq('id', docId);
    } else if (movimientoId) {
      query = query.eq('movimiento_id', movimientoId);
    }

    const { data: doc, error: docError } = await query
      .order('creado_en', { ascending: false })
      .limit(1)
      .single();

    if (docError || !doc) {
      return new Response(
        JSON.stringify({ success: false, error: 'Comprobante no encontrado.' }),
        { status: 404, headers: jsonHeaders }
      );
    }

    const bucket = doc.bucket_id || BUCKET_NAME;
    const { data: signedData, error: signError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(doc.storage_path, 120); // Válida por 2 minutos

    if (signError || !signedData?.signedUrl) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `No se pudo generar el enlace seguro: ${signError?.message || 'error desconocido'}`,
        }),
        { status: 400, headers: jsonHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          url: signedData.signedUrl,
          mime_type: doc.mime_type,
        },
      }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al obtener el comprobante.';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: jsonHeaders }
    );
  }
};