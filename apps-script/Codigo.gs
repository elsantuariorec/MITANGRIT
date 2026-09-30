/**
 * Santuario Live — robot que recibe los SMS de Nequi y aprueba boletas solo.
 *
 * Va en Google Apps Script (script.google.com), junto con Matcher.gs.
 * Guía completa de instalación en LEEME.md, paso 4.
 *
 * Propiedades del script que debes crear (Configuración del proyecto > Propiedades del script):
 *   API_KEY        la apiKey de Firebase (la misma de js/config.js)
 *   DB_URL         la databaseURL de Firebase (la misma de js/config.js)
 *   ROBOT_CORREO   correo de la cuenta robot creada en Firebase Authentication
 *   ROBOT_CLAVE    clave de esa cuenta
 *   TOKEN          una palabra secreta larga que inventes; va al final de la URL del webhook
 */

var PROPS = PropertiesService.getScriptProperties();

function ajustes_() {
  return {
    apiKey: PROPS.getProperty('API_KEY'),
    url: String(PROPS.getProperty('DB_URL') || '').replace(/\/$/, ''),
    correo: PROPS.getProperty('ROBOT_CORREO'),
    clave: PROPS.getProperty('ROBOT_CLAVE'),
    token: PROPS.getProperty('TOKEN')
  };
}

/* ---------- acceso a Firebase ---------- */

function tokenRobot_() {
  var cache = CacheService.getScriptCache();
  var t = cache.get('idToken');
  if (t) return t;
  var a = ajustes_();
  var r = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + a.apiKey, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ email: a.correo, password: a.clave, returnSecureToken: true }),
    muteHttpExceptions: true
  });
  var d = JSON.parse(r.getContentText());
  if (!d.idToken) throw new Error('El robot no pudo entrar a Firebase: ' + r.getContentText());
  cache.put('idToken', d.idToken, 3000); // 50 minutos
  return d.idToken;
}

function fb_(metodo, ruta, cuerpo, consulta) {
  var a = ajustes_();
  var url = a.url + '/' + ruta + '.json?auth=' + encodeURIComponent(tokenRobot_());
  if (consulta) {
    for (var k in consulta) url += '&' + k + '=' + encodeURIComponent(JSON.stringify(consulta[k]));
  }
  var op = { method: metodo, muteHttpExceptions: true, contentType: 'application/json' };
  if (cuerpo !== undefined) op.payload = JSON.stringify(cuerpo);
  var r = UrlFetchApp.fetch(url, op);
  if (r.getResponseCode() >= 300) throw new Error('Firebase ' + r.getResponseCode() + ': ' + r.getContentText());
  return JSON.parse(r.getContentText());
}

function aLista_(obj) {
  var l = [];
  for (var k in obj || {}) {
    if (obj[k]) { obj[k].id = k; l.push(obj[k]); }
  }
  return l;
}

/* ---------- webhook ---------- */

function doGet() {
  return salida_({ ok: true, servicio: 'Santuario Live, lector de SMS' });
}

function doPost(e) {
  var a = ajustes_();
  if (!e || !e.parameter || !a.token || e.parameter.token !== a.token) {
    return salida_({ ok: false, error: 'token' });
  }
  var crudo = e.postData ? e.postData.contents : '';
  var texto = extraerTexto_(crudo);
  if (!/nequi/i.test(texto) || !/recibi/i.test(texto)) {
    return salida_({ ok: true, ignorado: true }); // no es un SMS de pago
  }
  try {
    return salida_(procesarSms(texto));
  } catch (err) {
    console.error(err);
    return salida_({ ok: false, error: String(err) });
  }
}

function extraerTexto_(crudo) {
  try {
    var j = JSON.parse(crudo);
    if (typeof j === 'string') return j;
    for (var k in j) {
      if (typeof j[k] === 'string' && /recibi/i.test(j[k])) return j[k];
    }
  } catch (e) {}
  return crudo;
}

function salida_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- lógica ---------- */

function procesarSms(texto) {
  var candado = LockService.getScriptLock();
  candado.waitLock(25000);
  try {
    var ahora = Date.now();
    var id = SLMatcher.huella(texto);
    if (fb_('get', 'pagos/' + id)) return { ok: true, repetido: true };

    var sms = SLMatcher.leerSms(texto);
    var cambios = {};
    if (!sms) {
      cambios['pagos/' + id] = { texto: texto, recibido: ahora, estado: 'sin_asignar', razon: 'ilegible' };
      fb_('patch', '', cambios);
      return { ok: true, accion: 'revisar', razon: 'ilegible' };
    }

    var pedidos = aLista_(fb_('get', 'pedidos', undefined, { orderBy: 'expira', startAt: ahora - 3 * 3600000 }));
    var d = SLMatcher.decidir(sms, pedidos, ahora);
    var pago = { id: id, texto: texto, monto: sms.monto, nombre: sms.nombre, ts: sms.ts, recibido: ahora };

    if (d.accion === 'aprobar') {
      var p = null;
      for (var i = 0; i < pedidos.length; i++) if (pedidos[i].id === d.pedido) p = pedidos[i];
      // Doble chequeo del precio contra el evento
      var precio = fb_('get', 'eventos/' + p.ev + '/tipos/' + p.tipo + '/precio');
      if (precio * p.cant !== p.total) {
        d = { accion: 'revisar', razon: 'nombre_distinto', sugeridos: [p.id] };
      } else {
        cambios = SLMatcher.cambiosAprobar(p, pago, 'sms', ahora);
        fb_('patch', '', cambios);
        return { ok: true, accion: 'aprobar', codigo: p.codigo };
      }
    }
    cambios['pagos/' + id] = {
      texto: texto, monto: sms.monto, nombre: sms.nombre, ts: sms.ts, recibido: ahora,
      estado: 'sin_asignar', razon: d.razon, sugeridos: d.sugeridos || []
    };
    fb_('patch', '', cambios);
    return { ok: true, accion: 'revisar', razon: d.razon };
  } finally {
    candado.releaseLock();
  }
}

// Libera las reservas que no se pagaron a tiempo. Se ejecuta cada 5 minutos.
function vencerReservas() {
  var pend = aLista_(fb_('get', 'pedidos', undefined, { orderBy: 'estado', equalTo: 'pendiente' }));
  var cambios = SLMatcher.cambiosVencer(pend, Date.now());
  if (cambios) fb_('patch', '', cambios);
}

/* ---------- instalación y pruebas ---------- */

// Ejecuta esta función UNA vez para programar el vencimiento automático de reservas.
function instalar() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'vencerReservas') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('vencerReservas').timeBased().everyMinutes(5).create();
  tokenRobot_();
  console.log('Listo: el robot entró a Firebase y el vencimiento quedó programado cada 5 minutos.');
}

// Prueba que el lector entiende el SMS (no escribe nada en la base de datos).
function probarLector() {
  var t = 'Nequi: Tu negocio EL SANTUARIO recibio $5.000 de DIEGO FORERO el 23/09/2026 a las 09:11 p.m. a través de Bre-B - Vende mas con Nequi Negocios.';
  console.log(JSON.stringify(SLMatcher.leerSms(t)));
}
