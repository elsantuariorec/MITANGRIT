/*
 * Santuario Live — utilidades comunes y acceso a datos (Firebase REST o modo demo).
 * ES5 a propósito, para que funcione bien en iPhone.
 */
var SL = window.SL || {};
window.SL = SL;

/* ---------- utilidades ---------- */

SL.$ = function (sel, root) { return (root || document).querySelector(sel); };
SL.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

SL.esc = function (s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

SL.plata = function (n) {
  n = Math.round(Number(n) || 0);
  return '$' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

SL.aleatorio = function (largo, alfabeto) {
  alfabeto = alfabeto || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var out = '', bytes;
  var c = window.crypto || window.msCrypto;
  if (c && c.getRandomValues) {
    bytes = new Uint8Array(largo);
    c.getRandomValues(bytes);
  }
  for (var i = 0; i < largo; i++) {
    var r = bytes ? bytes[i] : Math.floor(Math.random() * 256);
    out += alfabeto.charAt(r % alfabeto.length);
  }
  return out;
};

SL.nuevoId = function () { return SL.aleatorio(20); };
SL.nuevoCodigo = function () { return 'SL-' + SL.aleatorio(4, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'); };

SL.param = function (nombre, fuente) {
  var m = new RegExp('[?&#]' + nombre + '=([^&#]*)').exec(fuente || location.href);
  return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
};

// "2026-10-17T20:00" -> Date en hora local (sin depender del parser de Safari)
SL.aFecha = function (iso) {
  if (!iso) return null;
  var m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(iso);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
};

SL.DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
SL.MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
SL.MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

SL.hora = function (d) {
  var h = d.getHours(), m = d.getMinutes();
  var sufijo = h >= 12 ? 'p.m.' : 'a.m.';
  h = h % 12 || 12;
  return h + ':' + (m < 10 ? '0' : '') + m + ' ' + sufijo;
};

SL.fechaLarga = function (iso) {
  var d = SL.aFecha(iso);
  if (!d) return '';
  return SL.DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + SL.MESES[d.getMonth()] + ', ' + SL.hora(d);
};

SL.fechaCorta = function (ts) {
  var d = new Date(ts);
  return d.getDate() + ' ' + SL.MESES_CORTOS[d.getMonth()] + ', ' + SL.hora(d);
};

SL.hace = function (ts) {
  var s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'hace un momento';
  if (s < 3600) return 'hace ' + Math.round(s / 60) + ' min';
  if (s < 86400) return 'hace ' + Math.round(s / 3600) + ' h';
  return SL.fechaCorta(ts);
};

SL.cuentaAtras = function (ms) {
  if (ms < 0) ms = 0;
  var s = Math.floor(ms / 1000);
  var m = Math.floor(s / 60);
  s = s % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
};

SL.aLista = function (obj) {
  var out = [];
  if (!obj) return out;
  for (var k in obj) {
    if (obj.hasOwnProperty(k) && obj[k]) {
      var v = obj[k];
      if (typeof v === 'object' && !v.id) v.id = k;
      out.push(v);
    }
  }
  return out;
};

SL.soloDigitos = function (s) { return String(s || '').replace(/\D+/g, ''); };

SL.linkWhatsApp = function (numero, texto) {
  var n = SL.soloDigitos(numero);
  if (n.length === 10 && n.charAt(0) === '3') n = '57' + n;
  return 'https://wa.me/' + n + (texto ? '?text=' + encodeURIComponent(texto) : '');
};

SL.base = function () { return location.href.replace(/[?#].*$/, '').replace(/[^\/]*$/, ''); };
SL.linkBoleta = function (id) { return SL.base() + 'boleta.html?id=' + id; };
SL.linkEvento = function (id) { return SL.base() + 'index.html#e=' + id; };

// Cuántas entradas de cada tipo están vendidas o apartadas
SL.ocupadas = function (ocupacion, ahora) {
  var usados = {};
  for (var k in ocupacion || {}) {
    if (!ocupacion.hasOwnProperty(k) || !ocupacion[k]) continue;
    var o = ocupacion[k];
    if (o.e === 'a' || (o.e === 'p' && o.x > ahora)) {
      usados[o.t] = (usados[o.t] || 0) + (o.n || 0);
    }
  }
  return usados;
};

SL.estadoTipo = function (tipo, usados, ahora) {
  var disponibles = Math.max(0, (tipo.cupo || 0) - (usados || 0));
  var fin = SL.aFecha(tipo.hasta);
  if (fin && ahora > fin.getTime()) return { abierta: false, disponibles: 0, texto: 'Cerrada' };
  if (disponibles <= 0) return { abierta: false, disponibles: 0, texto: 'Agotada' };
  return { abierta: true, disponibles: disponibles, texto: disponibles <= 10 ? 'Quedan ' + disponibles : '' };
};

SL.tiposOrdenados = function (evento) {
  var lista = SL.aLista(evento && evento.tipos);
  lista.sort(function (a, b) { return (a.orden || 0) - (b.orden || 0); });
  return lista;
};

// Reduce una imagen y la devuelve como texto base64 (para guardar en la base de datos)
SL.imagenATexto = function (archivo, anchoMax, calidad, formato, cb) {
  var lector = new FileReader();
  lector.onload = function () {
    var img = new Image();
    img.onload = function () {
      var escala = Math.min(1, anchoMax / img.width);
      var c = document.createElement('canvas');
      c.width = Math.round(img.width * escala);
      c.height = Math.round(img.height * escala);
      var ctx = c.getContext('2d');
      if (formato === 'image/jpeg') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
      }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      cb(null, c.toDataURL(formato || 'image/jpeg', calidad || 0.75));
    };
    img.onerror = function () { cb('No se pudo leer la imagen'); };
    img.src = lector.result;
  };
  lector.readAsDataURL(archivo);
};

SL.aviso = function (texto, tipo) {
  var el = document.getElementById('sl-aviso');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sl-aviso';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.className = 'aviso ' + (tipo || '');
  el.textContent = texto;
  el.style.display = 'block';
  clearTimeout(SL._avisoT);
  SL._avisoT = setTimeout(function () { el.style.display = 'none'; }, 3500);
};

SL.copiar = function (texto, cb) {
  function respaldo() {
    var t = document.createElement('textarea');
    t.value = texto;
    t.style.position = 'fixed';
    t.style.opacity = '0';
    document.body.appendChild(t);
    t.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(t);
    if (cb) cb();
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texto).then(function () { if (cb) cb(); }, respaldo);
  } else {
    respaldo();
  }
};

// Texto exacto de la autorización de imagen (se guarda en cada pedido como prueba)
SL.textoGrabacion = function (quien) {
  return 'Sé que este evento será grabado en audio y video, y autorizo a ' + (quien || 'El Santuario') +
    ' a usar mi imagen y voz en esas grabaciones para publicarlas en YouTube, redes sociales y otras plataformas digitales.';
};
SL.GRABAN_POR_DEFECTO = 'El Santuario y Cadencia';

SL.ESTADOS = {
  pendiente: 'Esperando pago',
  aprobada: 'Aprobada',
  vencida: 'Vencida',
  rechazada: 'Rechazada'
};

/* ---------- datos ---------- */

SL.db = (function () {
  var cfg = window.SL_CONFIG || {};
  var demo = !cfg.databaseURL;
  var sesion = null;
  var CLAVE_SESION = 'sl_sesion';
  var CLAVE_DEMO = 'sl_demo_db';

  function leerLocal(k) {
    try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; }
  }
  function guardarLocal(k, v) {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  }

  function peticion(metodo, url, cuerpo, formulario, cb) {
    var x = new XMLHttpRequest();
    x.open(metodo, url, true);
    x.setRequestHeader('Content-Type', formulario ? 'application/x-www-form-urlencoded' : 'application/json');
    x.onreadystatechange = function () {
      if (x.readyState !== 4) return;
      var datos = null;
      try { datos = JSON.parse(x.responseText); } catch (e) {}
      if (x.status >= 200 && x.status < 300) cb(null, datos);
      else cb((datos && (datos.error && (datos.error.message || datos.error))) || ('Error de conexión (' + x.status + ')'), datos);
    };
    x.send(cuerpo === undefined ? null : (formulario ? cuerpo : JSON.stringify(cuerpo)));
  }

  /* --- sesión (Firebase Auth REST) --- */

  function conToken(cb) {
    if (demo || !sesion) return cb(null);
    if (sesion.vence > Date.now() + 60000) return cb(null);
    peticion('POST', 'https://securetoken.googleapis.com/v1/token?key=' + cfg.apiKey,
      'grant_type=refresh_token&refresh_token=' + encodeURIComponent(sesion.refresh), true,
      function (err, r) {
        if (err) { sesion = null; guardarLocal(CLAVE_SESION, null); return cb('Tu sesión venció, entra de nuevo'); }
        sesion.token = r.id_token;
        sesion.refresh = r.refresh_token;
        sesion.vence = Date.now() + (parseInt(r.expires_in, 10) || 3600) * 1000;
        guardarLocal(CLAVE_SESION, sesion);
        cb(null);
      });
  }

  function entrar(correo, clave, cb) {
    if (demo) {
      if (clave !== 'demo') return cb('En modo demo la clave es "demo"');
      sesion = { uid: 'demo', correo: correo || 'demo' };
      guardarLocal(CLAVE_SESION, sesion);
      return cb(null, sesion);
    }
    peticion('POST', 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + cfg.apiKey,
      { email: correo, password: clave, returnSecureToken: true }, false,
      function (err, r) {
        if (err) return cb(/INVALID|PASSWORD|EMAIL/i.test(String(err)) ? 'Correo o clave incorrectos' : String(err));
        sesion = { uid: r.localId, correo: r.email, token: r.idToken, refresh: r.refreshToken,
          vence: Date.now() + (parseInt(r.expiresIn, 10) || 3600) * 1000 };
        obtener('admins/' + sesion.uid, null, function (e2, esAdmin) {
          if (e2 || esAdmin !== true) {
            var uid = sesion.uid;
            sesion = null;
            return cb('Esta cuenta no tiene permiso de organizador. UID: ' + uid);
          }
          guardarLocal(CLAVE_SESION, sesion);
          cb(null, sesion);
        });
      });
  }

  function salir() { sesion = null; guardarLocal(CLAVE_SESION, null); }
  function recuperar() { sesion = leerLocal(CLAVE_SESION); return sesion; }

  /* --- modo demo: árbol JSON en localStorage --- */

  function arbolDemo() {
    var a = leerLocal(CLAVE_DEMO);
    if (!a) { a = SL.semillaDemo(); guardarLocal(CLAVE_DEMO, a); }
    return a;
  }
  function partes(ruta) { return ruta ? ruta.split('/').filter(function (p) { return p; }) : []; }
  function leerRuta(arbol, ruta) {
    var p = partes(ruta), n = arbol;
    for (var i = 0; i < p.length; i++) {
      if (n === null || typeof n !== 'object') return null;
      n = n[p[i]];
      if (n === undefined) return null;
    }
    return n === undefined ? null : JSON.parse(JSON.stringify(n));
  }
  // Imita los valores de servidor de Firebase ({".sv": "timestamp"})
  function valoresServidor(v) {
    if (v && typeof v === 'object') {
      if (v['.sv'] === 'timestamp') return Date.now();
      for (var k in v) if (v.hasOwnProperty(k)) v[k] = valoresServidor(v[k]);
    }
    return v;
  }
  function escribirRuta(arbol, ruta, valor) {
    valor = valoresServidor(valor === null ? null : JSON.parse(JSON.stringify(valor)));
    var p = partes(ruta), n = arbol;
    for (var i = 0; i < p.length - 1; i++) {
      if (!n[p[i]] || typeof n[p[i]] !== 'object') n[p[i]] = {};
      n = n[p[i]];
    }
    if (valor === null) delete n[p[p.length - 1]];
    else n[p[p.length - 1]] = JSON.parse(JSON.stringify(valor));
  }
  function filtrar(datos, q) {
    if (!q || !datos) return datos;
    var out = {};
    for (var k in datos) {
      if (!datos.hasOwnProperty(k)) continue;
      var v = datos[k] && datos[k][q.orderBy];
      if (q.equalTo !== undefined && v !== q.equalTo) continue;
      if (q.startAt !== undefined && !(v >= q.startAt)) continue;
      out[k] = datos[k];
    }
    return out;
  }

  /* --- API común --- */

  function url(ruta, q) {
    var u = cfg.databaseURL.replace(/\/$/, '') + '/' + ruta + '.json';
    var ps = [];
    if (sesion && sesion.token) ps.push('auth=' + encodeURIComponent(sesion.token));
    if (q) {
      ps.push('orderBy=' + encodeURIComponent(JSON.stringify(q.orderBy)));
      if (q.equalTo !== undefined) ps.push('equalTo=' + encodeURIComponent(JSON.stringify(q.equalTo)));
      if (q.startAt !== undefined) ps.push('startAt=' + encodeURIComponent(JSON.stringify(q.startAt)));
    }
    return u + (ps.length ? '?' + ps.join('&') : '');
  }

  function obtener(ruta, q, cb) {
    if (demo) {
      var d = filtrar(leerRuta(arbolDemo(), ruta), q);
      return setTimeout(function () { cb(null, d); }, 0);
    }
    conToken(function (e) {
      if (e) return cb(e);
      peticion('GET', url(ruta, q), undefined, false, cb);
    });
  }

  function poner(ruta, valor, cb) {
    if (demo) {
      var a = arbolDemo();
      escribirRuta(a, ruta, valor);
      guardarLocal(CLAVE_DEMO, a);
      return setTimeout(function () { if (cb) cb(null, valor); }, 0);
    }
    conToken(function (e) {
      if (e) return cb && cb(e);
      peticion('PUT', url(ruta), valor, false, cb || function () {});
    });
  }

  // Varias rutas en una sola escritura: { 'pedidos/x/estado': 'aprobada', ... }
  function actualizar(cambios, cb) {
    if (demo) {
      var a = arbolDemo();
      for (var k in cambios) if (cambios.hasOwnProperty(k)) escribirRuta(a, k, cambios[k]);
      guardarLocal(CLAVE_DEMO, a);
      return setTimeout(function () { if (cb) cb(null); }, 0);
    }
    conToken(function (e) {
      if (e) return cb && cb(e);
      peticion('PATCH', url(''), cambios, false, cb || function () {});
    });
  }

  function reiniciarDemo() { guardarLocal(CLAVE_DEMO, null); }

  return {
    demo: demo,
    entrar: entrar,
    salir: salir,
    recuperar: recuperar,
    sesion: function () { return sesion; },
    obtener: obtener,
    poner: poner,
    actualizar: actualizar,
    reiniciarDemo: reiniciarDemo
  };
})();

/* ---------- acciones compartidas ---------- */

SL.cintaDemo = function (id) {
  var el = document.getElementById(id || 'cinta-demo');
  if (!el || !SL.db.demo) return;
  el.className = 'cinta-demo';
  el.innerHTML = 'Modo demo: los datos se guardan solo en este navegador.' +
    '<button type="button" id="reiniciar-demo">Reiniciar demo</button>';
  document.getElementById('reiniciar-demo').onclick = function () {
    if (confirm('¿Borrar todos los pedidos de prueba y volver a empezar?')) {
      SL.db.reiniciarDemo();
      location.reload();
    }
  };
};

// Boletas compradas desde este celular, para encontrarlas después
SL.misBoletas = function () {
  try { return JSON.parse(localStorage.getItem('sl_mis_boletas')) || []; } catch (e) { return []; }
};
SL.guardarMiBoleta = function (b) {
  var l = SL.misBoletas().filter(function (x) { return x.id !== b.id; });
  l.unshift(b);
  try { localStorage.setItem('sl_mis_boletas', JSON.stringify(l.slice(0, 20))); } catch (e) {}
};

// Procesa el texto de un SMS de Nequi desde el panel (mismo criterio que Apps Script)
SL.procesarSms = function (texto, cb) {
  var ahora = Date.now();
  var sms = SLMatcher.leerSms(texto);
  var id = SLMatcher.huella(texto);
  SL.db.obtener('pagos/' + id, null, function (e0, existe) {
    if (e0) return cb(e0);
    if (existe) return cb(null, { accion: 'repetido', pago: existe });
    if (!sms) {
      var c0 = {};
      c0['pagos/' + id] = { texto: texto, recibido: ahora, estado: 'sin_asignar', razon: 'ilegible' };
      return SL.db.actualizar(c0, function (e) { cb(e, { accion: 'revisar', razon: 'ilegible' }); });
    }
    SL.db.obtener('pedidos', { orderBy: 'expira', startAt: ahora - 3 * 3600000 }, function (e1, datos) {
      if (e1) return cb(e1);
      var pedidos = SL.aLista(datos);
      var d = SLMatcher.decidir(sms, pedidos, ahora);
      var pago = { id: id, texto: texto, monto: sms.monto, nombre: sms.nombre, ts: sms.ts, recibido: ahora };
      var cambios;
      if (d.accion === 'aprobar') {
        var ped = null;
        for (var i = 0; i < pedidos.length; i++) if (pedidos[i].id === d.pedido) ped = pedidos[i];
        cambios = SLMatcher.cambiosAprobar(ped, pago, 'sms', ahora);
        d.codigo = ped.codigo;
        d.nombrePedido = ped.nombre;
      } else {
        cambios = {};
        cambios['pagos/' + id] = { texto: texto, monto: sms.monto, nombre: sms.nombre, ts: sms.ts,
          recibido: ahora, estado: 'sin_asignar', razon: d.razon, sugeridos: d.sugeridos };
      }
      SL.db.actualizar(cambios, function (e2) { cb(e2, d); });
    });
  });
};

// Datos de ejemplo para el modo demo
SL.semillaDemo = function () {
  var hoy = new Date();
  function enDias(n, h) {
    var d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + n, h, 0);
    function dos(x) { return (x < 10 ? '0' : '') + x; }
    return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()) + 'T' + dos(d.getHours()) + ':00';
  }
  return {
    config: {
      organizador: 'El Santuario',
      llave: '@ELSANTUARIO',
      minutosReserva: 30,
      whatsapp: '3000000000'
    },
    eventos: {
      ev_demo1: {
        nombre: 'Santuario Sessions Vol. 3',
        fecha: enDias(21, 20),
        lugar: 'El Santuario',
        direccion: 'Bogotá',
        descripcion: 'Tres proyectos emergentes en vivo, DJ set de cierre y micrófono abierto al final de la noche.',
        publicado: true,
        creado: Date.now(),
        tipos: {
          t1: { nombre: 'Preventa', precio: 20000, cupo: 40, hasta: enDias(14, 23), orden: 1 },
          t2: { nombre: 'General', precio: 30000, cupo: 80, hasta: '', orden: 2 },
          t3: { nombre: 'Pareja', precio: 50000, cupo: 10, hasta: '', orden: 3, personas: 2 }
        }
      },
      ev_demo2: {
        nombre: 'Micrófono Abierto: Edición Aniversario',
        fecha: enDias(35, 19),
        lugar: 'El Santuario',
        direccion: 'Bogotá',
        descripcion: 'Catorce cupos para artistas, sorteo en vivo y cierre con invitados especiales.',
        publicado: true,
        creado: Date.now(),
        tipos: {
          t1: { nombre: 'General', precio: 15000, cupo: 60, hasta: '', orden: 1 }
        }
      }
    }
  };
};
