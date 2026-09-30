/*
 * Santuario Live — lector de SMS de Nequi Negocios y cruce con pedidos.
 * Este mismo archivo se usa en el navegador (panel) y en Google Apps Script
 * (apps-script/Matcher.gs es una copia exacta). Escrito en ES5.
 *
 * Formato esperado del SMS:
 * "Nequi: Tu negocio EL SANTUARIO recibio $5.000 de DIEGO FORERO el 23/09/2026
 *  a las 09:11 p.m. a través de Bre-B - Vende mas con Nequi Negocios."
 */
var SLMatcher = (function () {
  var MIN = 60000;
  var UMBRAL_NOMBRE = 0.5;       // % de palabras del nombre del SMS que deben coincidir
  var GRACIA_PAGO = 5 * MIN;     // se acepta un pago hasta 5 min después de vencer la reserva
  var TOLERANCIA_RELOJ = 2 * MIN; // el SMS solo trae minutos, no segundos

  function quitarTildes(s) {
    if (s.normalize) {
      return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    }
    var de = 'ÁÉÍÓÚÜÑáéíóúüñ', a = 'AEIOUUNaeiouun', out = '';
    for (var i = 0; i < s.length; i++) {
      var k = de.indexOf(s.charAt(i));
      out += k >= 0 ? a.charAt(k) : s.charAt(i);
    }
    return out;
  }

  function norm(s) {
    s = quitarTildes(String(s || '')).toUpperCase();
    return s.replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
  }

  function palabras(s) {
    var p = norm(s).split(' '), out = [];
    for (var i = 0; i < p.length; i++) {
      if (p[i].length >= 2) out.push(p[i]);
    }
    return out;
  }

  // Qué tan parecido es el nombre del SMS al nombre del pedido (0 a 1).
  // Nequi suele mostrar "NOMBRE APELLIDO", a veces recortado.
  function parecido(nombreSms, nombrePedido) {
    var S = palabras(nombreSms), C = palabras(nombrePedido);
    if (!S.length || !C.length) return 0;
    var hits = 0;
    for (var i = 0; i < S.length; i++) {
      for (var j = 0; j < C.length; j++) {
        var a = S[i], b = C[j];
        if (a === b || (a.length >= 3 && b.indexOf(a) === 0) || (b.length >= 3 && a.indexOf(b) === 0)) {
          hits++;
          break;
        }
      }
    }
    return hits / S.length;
  }

  function limpiarTexto(t) {
    return String(t || '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
  }

  // Identificador estable del SMS (el mismo en navegador y en Apps Script)
  function huella(texto) {
    var t = limpiarTexto(texto), h1 = 5381, h2 = 52711;
    for (var i = 0; i < t.length; i++) {
      var c = t.charCodeAt(i);
      h1 = ((h1 * 33) ^ c) >>> 0;
      h2 = ((h2 * 31) + c) >>> 0;
    }
    return 'sms' + h1.toString(36) + h2.toString(36);
  }

  function leerSms(texto) {
    var t = limpiarTexto(texto);
    var m = t.match(/recibi[oó]\s+\$\s?([\d\.,]+)\s+de\s+(.+?)\s+el\s+(\d{1,2})\/(\d{1,2})\/(\d{4})\s+a\s+las\s+(\d{1,2}):(\d{2})\s*([ap])\.?\s*m/i);
    if (!m) return null;
    // "$5.000,00" -> quita los centavos; "$5.000" queda igual
    var montoTxt = m[1].replace(/[\.,]$/, '').replace(/(\d[\.,]\d{3})[\.,]\d{2}$/, '$1');
    var monto = parseInt(montoTxt.replace(/[\.,]/g, ''), 10);
    var h = parseInt(m[6], 10) % 12;
    if (m[8].toLowerCase() === 'p') h += 12;
    // Hora de Colombia (UTC-5) a milisegundos UTC
    var ts = Date.UTC(parseInt(m[5], 10), parseInt(m[4], 10) - 1, parseInt(m[3], 10), h + 5, parseInt(m[7], 10));
    var neg = t.match(/negocio\s+(.+?)\s+recibi/i);
    return {
      monto: monto,
      nombre: limpiarTexto(m[2]),
      ts: ts,
      negocio: neg ? neg[1] : ''
    };
  }

  // Decide qué hacer con un pago. pedidos: lista de pedidos pendientes o vencidos recientes.
  function decidir(sms, pedidos, ahora) {
    var momento = sms.ts || ahora;
    var cands = [];
    for (var i = 0; i < pedidos.length; i++) {
      var p = pedidos[i];
      if (!p || p.cortesia) continue;
      if (p.estado !== 'pendiente' && p.estado !== 'vencida') continue;
      if (p.total !== sms.monto) continue;
      if (p.creado > momento + TOLERANCIA_RELOJ) continue; // el pedido es posterior al pago
      var s = Math.max(parecido(sms.nombre, p.titular), parecido(sms.nombre, p.nombre));
      var aTiempo = p.estado === 'pendiente' && momento <= p.expira + GRACIA_PAGO;
      cands.push({ id: p.id, puntaje: s, aTiempo: aTiempo, creado: p.creado, estado: p.estado });
    }
    cands.sort(function (a, b) { return (b.puntaje - a.puntaje) || (a.creado - b.creado); });

    var buenos = [];
    for (var k = 0; k < cands.length; k++) {
      if (cands[k].puntaje >= UMBRAL_NOMBRE) buenos.push(cands[k]);
    }
    var sugeridos = [];
    for (var n = 0; n < cands.length && n < 5; n++) sugeridos.push(cands[n].id);

    if (buenos.length === 1 || (buenos.length > 1 && buenos[0].puntaje === 1 && buenos[1].puntaje < 1)) {
      if (buenos[0].aTiempo) return { accion: 'aprobar', pedido: buenos[0].id, puntaje: buenos[0].puntaje };
      return { accion: 'revisar', razon: 'reserva_vencida', sugeridos: [buenos[0].id] };
    }
    if (buenos.length > 1) return { accion: 'revisar', razon: 'varios_posibles', sugeridos: sugeridos };
    if (cands.length) return { accion: 'revisar', razon: 'nombre_distinto', sugeridos: sugeridos };
    return { accion: 'revisar', razon: 'sin_pedido', sugeridos: [] };
  }

  // Cambios en la base de datos para aprobar un pedido (una sola escritura multi-ruta)
  function cambiosAprobar(pedido, pago, por, ahora) {
    var u = {};
    u['pedidos/' + pedido.id + '/estado'] = 'aprobada';
    u['pedidos/' + pedido.id + '/aprobado'] = { ts: ahora, por: por, pago: pago ? pago.id : null };
    u['ocupacion/' + pedido.ev + '/' + pedido.id] = { t: pedido.tipo, n: pedido.cant, e: 'a', x: 0 };
    if (pago) {
      u['pagos/' + pago.id] = {
        texto: pago.texto, monto: pago.monto, nombre: pago.nombre, ts: pago.ts || null,
        recibido: pago.recibido || ahora, estado: 'asignado', pedido: pedido.id,
        codigo: pedido.codigo || '', por: por
      };
    }
    return u;
  }

  function cambiosVencer(pedidos, ahora) {
    var u = {}, n = 0;
    for (var i = 0; i < pedidos.length; i++) {
      var p = pedidos[i];
      if (p && p.estado === 'pendiente' && p.expira < ahora) {
        u['pedidos/' + p.id + '/estado'] = 'vencida';
        u['ocupacion/' + p.ev + '/' + p.id] = null;
        n++;
      }
    }
    return n ? u : null;
  }

  return {
    leerSms: leerSms,
    decidir: decidir,
    parecido: parecido,
    huella: huella,
    norm: norm,
    cambiosAprobar: cambiosAprobar,
    cambiosVencer: cambiosVencer,
    RAZONES: {
      reserva_vencida: 'Llegó después de que venció la reserva',
      varios_posibles: 'Hay varios pedidos con ese monto y nombre parecido',
      nombre_distinto: 'Hay pedidos por ese monto, pero el nombre no coincide',
      sin_pedido: 'No hay ningún pedido pendiente por ese monto',
      ilegible: 'No se pudo leer el SMS'
    }
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = SLMatcher;
