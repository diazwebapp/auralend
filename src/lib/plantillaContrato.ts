export interface DatosContratoPrestamo {
  prestamoId: string;
  adminNombre?: string;
  clienteNombre: string;
  clienteCedula?: string | number | null;
  clienteWhatsapp?: string | null;
  clienteCorreo?: string | null;
  clienteDireccion?: string | null;
  garantiaNotas?: string | null;
  montoAcreditado: string | number;
  capitalRestante: string | number;
  interesCiclo: string | number;
  modalidadPago?: string;
  fechaEmision: string;
  fechaProximoPago: string;
}

function escapeHtml(valor: unknown): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const PLANTILLA_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Contrato de Crédito - {{ID_PRESTAMO}}</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #1f2937;
      line-height: 1.5;
      margin: 0;
      padding: 32px;
    }
    .header {
      border-bottom: 2px solid #111827;
      padding-bottom: 14px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }
    .header h1 {
      margin: 0 0 4px 0;
      font-size: 20px;
      color: #111827;
    }
    .meta {
      font-size: 12px;
      color: #4b5563;
      text-align: right;
    }
    .box {
      border: 1px solid #d1d5db;
      border-radius: 6px;
      padding: 14px 18px;
      margin-bottom: 20px;
      background: #f9fafb;
    }
    .box h2 {
      margin: 0 0 10px 0;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #111827;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px 20px;
      font-size: 13px;
    }
    .clause {
      margin-bottom: 14px;
      font-size: 13px;
    }
    .clause strong {
      color: #111827;
    }
    .sign-grid {
      margin-top: 42px;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 40px;
      font-size: 12px;
      text-align: center;
    }
    .sign-line {
      border-top: 1px solid #374151;
      padding-top: 6px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>ACUERDO Y TÉRMINOS DE CRÉDITO</h1>
      <div>Acreedor / Gestor: <strong>{{ADMIN_NOMBRE}}</strong></div>
    </div>
    <div class="meta">
      <div><strong>Código de Crédito:</strong> {{ID_PRESTAMO}}</div>
      <div><strong>Fecha de Emisión:</strong> {{FECHA_EMISION}}</div>
    </div>
  </div>

  <div class="box">
    <h2>1. Datos del Cliente / Deudor</h2>
    <div class="grid">
      <div><strong>Nombre Completo:</strong> {{NOMBRE_CLIENTE}}</div>
      <div><strong>Cédula / Documento:</strong> {{CEDULA}}</div>
      <div><strong>WhatsApp:</strong> {{WHATSAPP}}</div>
      <div><strong>Correo Electrónico:</strong> {{CORREO}}</div>
      <div><strong>Dirección:</strong> {{DIRECCION}}</div>
      <div><strong>Garantía / Observaciones:</strong> {{GARANTIA_NOTAS}}</div>
    </div>
  </div>

  <div class="box">
    <h2>2. Condiciones Financieras</h2>
    <div class="grid">
      <div><strong>Monto Acreditado:</strong> {{MONTO_ACREDITADO}}</div>
      <div><strong>Capital Restante Inicial:</strong> {{CAPITAL_RESTANTE}}</div>
      <div><strong>Interés del Ciclo:</strong> {{INTERES_CICLO}}</div>
      <div><strong>Próxima Fecha de Pago / Corte:</strong> {{FECHA_PROXIMO_PAGO}}</div>
      <div><strong>Modalidad de Pago:</strong> {{MODALIDAD_PAGO}}</div>
    </div>
  </div>

  <div class="clause">
    <strong>Cláusula Primera - Entrega y Aceptación:</strong> El deudor declara recibir a entera satisfacción el monto acreditado indicado en este documento y se compromete a honrar los pagos en las fechas establecidas.
  </div>

  <div class="clause">
    <strong>Cláusula Segunda - Aplicación de Abonos:</strong> Todo abono o pago parcial se aplicará conforme a las condiciones pactadas del crédito (priorizando los intereses pendientes del ciclo y aplicando el excedente a la reducción del capital restante), quedando asentado en el historial de movimientos.
  </div>

  <div class="clause">
    <strong>Cláusula Tercera - Comprobantes y Comunicaciones:</strong> Las partes aceptan el canal de WhatsApp y correo electrónico registrados para notificaciones de vencimiento, recordatorios y soporte de pagos/comprobantes.
  </div>

  <div class="clause">
    <strong>Cláusula Cuarta - Conformidad:</strong> La firma o aceptación de este documento implica la conformidad plena con el capital entregado, el interés del ciclo y la fecha de próximo corte.
  </div>

  <div class="sign-grid">
    <div>
      <div class="sign-line"><strong>{{NOMBRE_CLIENTE}}</strong><br />C.I.: {{CEDULA}}<br />Firma del Cliente</div>
    </div>
    <div>
      <div class="sign-line"><strong>{{ADMIN_NOMBRE}}</strong><br />Acreedor / Administración<br />Firma Autorizada</div>
    </div>
  </div>
</body>
</html>`;

export function renderizarContratoHtml(datos: DatosContratoPrestamo): string {
    const cedulaFormateada =
  datos.clienteCedula !== null &&
  datos.clienteCedula !== undefined &&
  String(datos.clienteCedula).trim() !== ''
    ? String(datos.clienteCedula).trim()
    : 'No registrada';
  const reemplazos: Record<string, string> = {
    '{{ID_PRESTAMO}}': escapeHtml(datos.prestamoId),
    '{{ADMIN_NOMBRE}}': escapeHtml(datos.adminNombre || 'Administración'),
    '{{NOMBRE_CLIENTE}}': escapeHtml(datos.clienteNombre),
    '{{CEDULA}}': escapeHtml(datos.clienteCedula || 'No registrada'),
    '{{WHATSAPP}}': escapeHtml(datos.clienteWhatsapp || 'No registrado'),
    '{{CORREO}}': escapeHtml(datos.clienteCorreo || 'No registrado'),
    '{{DIRECCION}}': escapeHtml(datos.clienteDireccion || 'No registrada'),
    '{{GARANTIA_NOTAS}}': escapeHtml(datos.garantiaNotas || 'Sin garantía adicional registrada'),
    '{{MONTO_ACREDITADO}}': escapeHtml(datos.montoAcreditado),
    '{{CAPITAL_RESTANTE}}': escapeHtml(datos.capitalRestante),
    '{{INTERES_CICLO}}': escapeHtml(datos.interesCiclo),
    '{{FECHA_EMISION}}': escapeHtml(datos.fechaEmision),
    '{{FECHA_PROXIMO_PAGO}}': escapeHtml(datos.fechaProximoPago),
  };

  let htmlFinal = PLANTILLA_HTML;
  for (const [marcador, valor] of Object.entries(reemplazos)) {
    htmlFinal = htmlFinal.split(marcador).join(valor);
  }
  return htmlFinal;
}