/* Santuario Live — control de ingreso en la puerta (ES5) */
(function () {
  var vista = SL.$('#vista');
  var resultado = SL.$('#resultado');
  var eventos = {};
  var evSel = null;
  var pedidos = [];
  var video = null, lienzo = null, ctx = null, flujo = null;
  var pausado = false, ultimoCodigo = '', ultimoTiempo = 0, ultimoAnalisis = 0;
  var audio = null;

  SL.cintaDemo();

  /* ---------- sesión ---------- */

  function login() {
    vista.innerHTML = '<h1 style="font-size:52px;text-transform:uppercase;margin:24px 0 16px">Puerta</h1>' +
      '<form id="f-login">' +
      '<label class="campo"><span>Correo</span><input id="l-correo" type="email" autocomplete="username"' +
        (SL.db.demo ? ' value="demo@elsantuario.co"' : '') + '></label>' +
      '<label class="campo"><span>Clave</span><input id="l-clave" type="password" autocomplete="current-password"></label>' +
      '<p class="error-form" id="l-error" style="color:#E07A8D"></p>' +
      '<button class="boton ancho" type="submit">Entrar</button>' +
      (SL.db.demo ? '<p class="fila-sub">Modo demo: la clave es "demo".</p>' : '') +
      '</form>';
    SL.$('#f-login').onsubmit = function (e) {
      e.preventDefault();
      SL.db.entrar(SL.$('#l-correo').value.trim(), SL.$('#l-clave').value, function (err) {
        if (err) { SL.$('#l-error').textContent = err; return; }
        iniciar();
      });
    };
  }

  function iniciar() {
    SL.db.obtener('eventos', null, function (e, evs) {
      if (e) {
        if (!SL.db.sesion()) return login();
        vista.innerHTML = '<div class="vacio">No hay conexión. Revisa el internet y recarga.</div>';
        return;
      }
      eventos = {};
      for (var k in evs || {}) if (evs.hasOwnProperty(k) && evs[k] && !evs[k].archivado) eventos[k] = evs[k];
      var l = SL.aLista(eventos);
      l.sort(function (a, b) { return SL.aFecha(a.fecha) - SL.aFecha(b.fecha); });
      try { evSel = localStorage.getItem('sl_ev_sel'); } catch (x) {}
      if (!evSel || !eventos[evSel]) {
        var limite = Date.now() - 12 * 3600000;
        for (var i = 0; i < l.length; i++) if (SL.aFecha(l[i].fecha).getTime() > limite) { evSel = l[i].id; break; }
        if (!evSel && l.length) evSel = l[l.length - 1].id;
      }
      if (!evSel) {
        vista.innerHTML = '<div class="vacio">No hay eventos creados.</div>';
        return;
      }
      pintar(l);
      cargarPedidos();
      setInterval(function () { if (!document.hidden && !pausado) cargarPedidos(); }, 15000);
    });
  }

  /* ---------- pantalla principal ---------- */

  function pintar(lista) {
    var opciones = lista.map(function (ev) {
      return '<option value="' + SL.esc(ev.id) + '"' + (ev.id === evSel ? ' selected' : '') + '>' + SL.esc(ev.nombre) + '</option>';
    }).join('');
    vista.innerHTML =
      '<select class="entrada" id="p-evento" aria-label="Evento" style="margin-bottom:4px">' + opciones + '</select>' +
      '<div class="contador-puerta"><span>Ya entraron</span><strong id="p-contador">–</strong></div>' +
      '<div class="camara" id="camara">' +
        '<video id="video" playsinline muted></video><div class="mira oculto" id="mira"></div>' +
        '<div class="camara-apagada" id="cam-apagada">' +
          '<p style="margin:0">Escanea el QR de cada boleta con la cámara de este celular.</p>' +
          '<button class="boton" type="button" id="encender">Encender cámara</button>' +
          '<p class="fila-sub" id="cam-error" style="margin:0;color:#E07A8D"></p>' +
        '</div>' +
      '</div>' +
      '<h2 style="font-size:30px;text-transform:uppercase;margin:28px 0 10px">Buscar en la lista</h2>' +
      '<input class="entrada" id="p-buscar" type="search" placeholder="Nombre, cédula o código" style="background:#1a1a1a;border-color:#444;color:var(--marfil)">' +
      '<div id="p-resultados" style="margin-top:10px"></div>';

    SL.$('#p-evento').onchange = function () {
      evSel = this.value;
      try { localStorage.setItem('sl_ev_sel', evSel); } catch (x) {}
      cargarPedidos();
    };
    SL.$('#encender').onclick = encenderCamara;
    SL.$('#p-buscar').oninput = buscar;
    SL.$('#p-resultados').onclick = function (e) {
      var b = e.target.closest ? e.target.closest('[data-id]') : null;
      if (b) validar(b.getAttribute('data-id'));
    };
  }

  function cargarPedidos(cb) {
    SL.db.obtener('pedidos', { orderBy: 'ev', equalTo: evSel }, function (e, d) {
      if (e) return cb && cb(e);
      pedidos = SL.aLista(d).filter(function (p) { return p.estado === 'aprobada'; });
      var dentro = 0, total = 0;
      pedidos.forEach(function (p) { dentro += p.usadas || 0; total += p.entradas || p.cant || 1; });
      var c = SL.$('#p-contador');
      if (c) c.textContent = dentro + ' / ' + total;
      buscar();
      if (cb) cb();
    });
  }

  function buscar() {
    var inp = SL.$('#p-buscar');
    var cont = SL.$('#p-resultados');
    if (!inp || !cont) return;
    var q = SLMatcher.norm(inp.value);
    if (q.length < 2) { cont.innerHTML = ''; return; }
    var l = pedidos.filter(function (p) {
      return SLMatcher.norm([p.nombre, p.doc, p.codigo].join(' ')).indexOf(q) >= 0;
    }).slice(0, 12);
    if (!l.length) { cont.innerHTML = '<p class="fila-sub">Nadie con ese nombre en las boletas aprobadas.</p>'; return; }
    cont.innerHTML = l.map(function (p) {
      var ent = p.entradas || p.cant || 1, us = p.usadas || 0;
      return '<div class="fila ' + (us >= ent ? 'vencida' : 'aprobada') + '"><div>' +
        '<div class="fila-titulo">' + SL.esc(p.nombre) + '</div>' +
        '<div class="fila-sub">' + SL.esc(p.codigo) + '. ' + SL.esc(p.cortesia ? 'Cortesía' : p.tipoNombre) +
        '. Entraron ' + us + ' de ' + ent + (p.doc ? '. C.C. ' + SL.esc(p.doc) : '') + '</div></div>' +
        '<div class="fila-acciones"><button class="boton chico" data-id="' + SL.esc(p.id) + '">Revisar</button></div></div>';
    }).join('');
  }

  /* ---------- cámara ---------- */

  function encenderCamara() {
    var err = SL.$('#cam-error');
    prepararSonido();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      err.textContent = 'Este navegador no permite usar la cámara. Abre la página en Safari o Chrome.';
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(function (s) {
      flujo = s;
      video = SL.$('#video');
      video.srcObject = s;
      video.setAttribute('playsinline', 'true');
      video.play();
      SL.$('#cam-apagada').className = 'camara-apagada oculto';
      SL.$('#mira').className = 'mira';
      lienzo = document.createElement('canvas');
      ctx = lienzo.getContext('2d', { willReadFrequently: true }) || lienzo.getContext('2d');
      requestAnimationFrame(analizar);
    })['catch'](function (e) {
      err.textContent = e && e.name === 'NotAllowedError' ?
        'Diste "no permitir". Activa el permiso de cámara para esta página en los ajustes del navegador.' :
        'No se pudo abrir la cámara.';
    });
  }

  function analizar(t) {
    requestAnimationFrame(analizar);
    if (pausado || !video || video.readyState < 2) return;
    if (t - ultimoAnalisis < 120) return;
    ultimoAnalisis = t;
    var w = 480, h = Math.round(video.videoHeight * (480 / video.videoWidth)) || 480;
    lienzo.width = w;
    lienzo.height = h;
    ctx.drawImage(video, 0, 0, w, h);
    var img = ctx.getImageData(0, 0, w, h);
    var codigo = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
    if (!codigo || !codigo.data) return;
    var ahora = Date.now();
    if (codigo.data === ultimoCodigo && ahora - ultimoTiempo < 4000) return;
    ultimoCodigo = codigo.data;
    ultimoTiempo = ahora;
    var id = leerCodigo(codigo.data);
    if (!id) return mostrar('mal', 'No es una boleta', '', 'Este QR no es de Mitangrit.');
    validar(id);
  }

  function leerCodigo(txt) {
    var m = /^SL1:([A-Za-z0-9]+)$/.exec(txt);
    if (m) return m[1];
    m = /boleta\.html\?id=([A-Za-z0-9]+)/.exec(txt);
    return m ? m[1] : null;
  }

  /* ---------- validación ---------- */

  function validar(id) {
    pausado = true;
    SL.db.obtener('pedidos/' + id, null, function (e, p) {
      if (e) return mostrar('ojo', 'Sin conexión', '', 'No se pudo revisar la boleta. Intenta de nuevo.');
      if (!p) return mostrar('mal', 'No válida', '', 'Esta boleta no existe.');
      p.id = id;
      var ent = p.entradas || p.cant || 1;
      var us = p.usadas || 0;
      var tipo = p.cortesia ? 'Cortesía' : p.tipoNombre;
      if (p.ev !== evSel) {
        return mostrar('mal', 'Otro evento', p.nombre, 'Esta boleta es para ' + p.evNombre + '.');
      }
      if (p.estado !== 'aprobada') {
        return mostrar('ojo', 'Sin pago', p.nombre, p.estado === 'pendiente' ?
          'El pago todavía no se ha confirmado. Revisa el panel.' : 'Este pedido está ' + (SL.ESTADOS[p.estado] || p.estado).toLowerCase() + '.');
      }
      if (us >= ent) {
        return mostrar('mal', 'Ya entró', p.nombre, tipo + '. ' + (ent > 1 ? 'Las ' + ent + ' entradas ya se usaron' : 'La entrada ya se usó') +
          (p.ultimoIngreso ? ' (' + SL.hora(new Date(p.ultimoIngreso)) + ').' : '.'));
      }
      var quedan = ent - us;
      if (quedan === 1) {
        return registrar(p, 1, function (ok) {
          if (ok) mostrar('ok', 'Adelante', p.nombre, tipo + (ent > 1 ? '. Última entrada de ' + ent + '.' : '.'));
        });
      }
      mostrar('ok', 'Válida', p.nombre, tipo + '. Quedan ' + quedan + ' de ' + ent + ' entradas.', [
        { texto: 'Entran ' + quedan, accion: function () { registrar(p, quedan, function (ok) { if (ok) mostrar('ok', 'Adelante', p.nombre, 'Entraron ' + quedan + '.'); }); } },
        { texto: 'Entra 1', accion: function () { registrar(p, 1, function (ok) { if (ok) mostrar('ok', 'Adelante', p.nombre, 'Quedan ' + (quedan - 1) + ' entradas en esta boleta.'); }); } },
        { texto: 'Cancelar', claro: true, accion: cerrar }
      ]);
    });
  }

  function registrar(p, n, cb) {
    var cambios = {};
    cambios['pedidos/' + p.id + '/usadas'] = (p.usadas || 0) + n;
    cambios['pedidos/' + p.id + '/ultimoIngreso'] = Date.now();
    SL.db.actualizar(cambios, function (e) {
      if (e) {
        mostrar('ojo', 'No se guardó', p.nombre, 'No se pudo registrar el ingreso. Revisa el internet e intenta de nuevo.');
        return cb(false);
      }
      cargarPedidos();
      cb(true);
    });
  }

  function mostrar(tipo, titulo, quien, detalle, botones) {
    pausado = true;
    sonar(tipo);
    var h = '<h1>' + SL.esc(titulo) + '</h1>' +
      (quien ? '<div class="quien">' + SL.esc(quien) + '</div>' : '') +
      '<div class="detalle-res">' + SL.esc(detalle) + '</div><div class="acciones">';
    botones = botones || [{ texto: 'Siguiente', accion: cerrar }];
    botones.forEach(function (b, i) {
      h += '<button type="button" class="boton ancho' + (b.claro ? ' claro' : '') + '" data-i="' + i + '">' + SL.esc(b.texto) + '</button>';
    });
    resultado.innerHTML = h + '</div>';
    resultado.className = 'resultado ' + tipo;
    SL.$$('button', resultado).forEach(function (el) {
      el.onclick = function (e) {
        e.stopPropagation();
        botones[+el.getAttribute('data-i')].accion();
      };
    });
    clearTimeout(mostrar.t);
    if (tipo === 'ok' && botones.length === 1) mostrar.t = setTimeout(cerrar, 2200);
  }

  function cerrar() {
    clearTimeout(mostrar.t);
    resultado.className = 'resultado oculto';
    pausado = false;
  }

  /* ---------- sonido y vibración ---------- */

  function prepararSonido() {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
    } catch (e) {}
  }

  function sonar(tipo) {
    if (navigator.vibrate) navigator.vibrate(tipo === 'ok' ? 80 : [200, 80, 200]);
    if (!audio) return;
    try {
      var o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = tipo === 'ok' ? 1046 : 220;
      o.type = tipo === 'ok' ? 'sine' : 'square';
      g.gain.value = 0.15;
      o.connect(g);
      g.connect(audio.destination);
      o.start();
      o.stop(audio.currentTime + (tipo === 'ok' ? 0.15 : 0.4));
    } catch (e) {}
  }

  if (SL.db.recuperar()) iniciar();
  else login();
})();
