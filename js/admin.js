/* Santuario Live — panel del organizador (ES5) */
(function () {
  var vista = SL.$('#vista');
  var datos = { config: {}, eventos: {}, pedidos: {}, pagos: {} };
  var pestana = 'pedidos';
  var evSel = null;
  var filtroPedidos = 'pendiente';
  var busqueda = '';
  var huellas = {};
  var sondeo = null;

  SL.cintaDemo();

  /* ---------- sesión ---------- */

  function mostrarLogin() {
    SL.$('#login').className = 'panel-login';
    SL.$('#app').className = 'oculto';
    SL.$('#sesion-info').textContent = '';
    if (SL.db.demo) {
      SL.$('#l-nota').textContent = 'Modo demo: usa cualquier correo y la clave "demo".';
      SL.$('#l-correo').value = 'demo@elsantuario.co';
    }
  }

  SL.$('#form-login').onsubmit = function (e) {
    e.preventDefault();
    var err = SL.$('#l-error');
    err.textContent = '';
    SL.db.entrar(SL.$('#l-correo').value.trim(), SL.$('#l-clave').value, function (e2) {
      if (e2) { err.textContent = e2; return; }
      iniciar();
    });
  };

  function iniciar() {
    SL.$('#login').className = 'panel-login oculto';
    SL.$('#app').className = '';
    var s = SL.db.sesion();
    SL.$('#sesion-info').innerHTML = SL.esc(s.correo) + ' · <a href="#" id="salir" style="color:inherit">Salir</a>';
    SL.$('#salir').onclick = function (e) {
      e.preventDefault();
      SL.db.salir();
      clearInterval(sondeo);
      mostrarLogin();
    };
    cargarTodo(function () {
      vencerReservas();
      pintar();
    });
    clearInterval(sondeo);
    sondeo = setInterval(function () {
      if (!document.hidden) cargarDinamico(refrescarListas);
    }, 5000);
  }

  /* ---------- datos ---------- */

  function cargarTodo(cb) {
    var faltan = 2;
    function listo() { if (--faltan === 0 && cb) cb(); }
    SL.db.obtener('config', null, function (e, c) { datos.config = c || {}; listo(); });
    SL.db.obtener('eventos', null, function (e, ev) {
      datos.eventos = ev || {};
      elegirEventoInicial();
      cargarDinamico(listo);
    });
  }

  function cargarDinamico(cb) {
    var faltan = 2;
    function listo() { if (--faltan === 0 && cb) cb(); }
    SL.db.obtener('pedidos', null, function (e, p) {
      if (e && !SL.db.sesion()) {
        clearInterval(sondeo);
        mostrarLogin();
        SL.$('#l-error').textContent = 'Tu sesión venció. Entra de nuevo.';
        return;
      }
      if (e) SL.aviso('Sin conexión con la base de datos: ' + e, 'error');
      if (!e) datos.pedidos = p || {};
      listo();
    });
    SL.db.obtener('pagos', null, function (e, p) {
      if (!e) datos.pagos = p || {};
      listo();
    });
  }

  function elegirEventoInicial() {
    var guardado = null;
    try { guardado = localStorage.getItem('sl_ev_sel'); } catch (e) {}
    if (guardado && datos.eventos[guardado]) { evSel = guardado; return; }
    var l = listaEventos();
    var ahora = Date.now() - 12 * 3600000;
    evSel = null;
    for (var i = 0; i < l.length; i++) {
      if (SL.aFecha(l[i].fecha).getTime() > ahora) { evSel = l[i].id; break; }
    }
    if (!evSel && l.length) evSel = l[l.length - 1].id;
  }

  function listaEventos() {
    var l = SL.aLista(datos.eventos);
    l.sort(function (a, b) { return (SL.aFecha(a.fecha) || 0) - (SL.aFecha(b.fecha) || 0); });
    return l;
  }

  function pedidosDe(evId) {
    var l = [];
    for (var k in datos.pedidos) {
      if (!datos.pedidos.hasOwnProperty(k)) continue;
      var p = datos.pedidos[k];
      if (!p) continue;
      p.id = k;
      if (!evId || p.ev === evId) l.push(p);
    }
    l.sort(function (a, b) { return (b.creado || 0) - (a.creado || 0); });
    return l;
  }

  function vencerReservas() {
    var cambios = SLMatcher.cambiosVencer(pedidosDe(null), Date.now());
    if (cambios) SL.db.actualizar(cambios, function () { cargarDinamico(refrescarListas); });
  }

  /* ---------- navegación ---------- */

  SL.$$('#pestanas button').forEach(function (b) {
    b.onclick = function () {
      if (b.getAttribute('data-ir')) { location.href = b.getAttribute('data-ir'); return; }
      pestana = b.getAttribute('data-p');
      SL.$$('#pestanas button').forEach(function (x) { x.className = x === b ? 'activa' : ''; });
      pintar();
    };
  });

  function selectorEvento(id) {
    var l = listaEventos();
    if (!l.length) return '';
    var h = '<select class="entrada selector-evento" id="' + (id || 'sel-evento') + '" aria-label="Evento">';
    l.forEach(function (ev) {
      var f = SL.aFecha(ev.fecha);
      h += '<option value="' + SL.esc(ev.id) + '"' + (ev.id === evSel ? ' selected' : '') + '>' +
        SL.esc(ev.nombre) + (f ? ' (' + f.getDate() + ' ' + SL.MESES_CORTOS[f.getMonth()] + ')' : '') + '</option>';
    });
    return h + '</select>';
  }

  function conectarSelector() {
    var s = SL.$('#sel-evento');
    if (!s) return;
    s.onchange = function () {
      evSel = s.value;
      try { localStorage.setItem('sl_ev_sel', evSel); } catch (e) {}
      pintar();
    };
  }

  function pintar() {
    huellas = {};
    vista.onclick = null;
    var fn = { pedidos: vPedidos, pagos: vPagos, eventos: vEventos, cortesias: vCortesias, reporte: vReporte, ajustes: vAjustes }[pestana];
    fn();
    actualizarContadores();
  }

  function refrescarListas() {
    actualizarContadores();
    if (pestana === 'pedidos') pintarListaPedidos();
    if (pestana === 'pagos') pintarListaPagos();
    if (pestana === 'reporte') pintarReporte();
    if (pestana === 'cortesias') pintarListaCortesias();
  }

  // Solo repinta un bloque si su contenido cambió (para no borrar lo que estás tocando)
  function ponerHtml(id, html) {
    var el = SL.$('#' + id);
    if (!el || huellas[id] === html) return;
    var foco = document.activeElement;
    if (foco && el.contains(foco) && foco.tagName === 'SELECT') return;
    huellas[id] = html;
    el.innerHTML = html;
  }

  function actualizarContadores() {
    var pend = pedidosDe(null).filter(function (p) { return p.estado === 'pendiente' && p.expira > Date.now(); }).length;
    var sinAsignar = SL.aLista(datos.pagos).filter(function (p) { return p.estado === 'sin_asignar'; }).length;
    var a = SL.$('#n-pendientes'), b = SL.$('#n-pagos');
    a.textContent = pend;
    a.className = 'contador' + (pend ? '' : ' oculto');
    b.textContent = sinAsignar;
    b.className = 'contador' + (sinAsignar ? '' : ' oculto');
  }

  function sinEventos() {
    vista.innerHTML = '<div class="vacio">Todavía no has creado eventos. <br><br>' +
      '<button class="boton" type="button" id="ir-eventos">Crear el primer evento</button></div>';
    SL.$('#ir-eventos').onclick = function () { SL.$('#pestanas [data-p=eventos]').click(); };
  }

  /* ---------- acciones sobre pedidos ---------- */

  function textoWhatsApp(p) {
    var primer = String(p.nombre || '').split(' ')[0];
    return '¡Hola ' + primer + '! Tu boleta para ' + p.evNombre + ' (' + SL.fechaLarga(p.evFecha) + ') está lista 🎟️\n' +
      SL.linkBoleta(p.id) + '\nMuestra el QR en la puerta. ¡Nos vemos!';
  }

  function aprobarManual(p, pago) {
    var ahora = Date.now();
    var cambios = SLMatcher.cambiosAprobar(p, pago || null, 'manual', ahora);
    SL.db.actualizar(cambios, function (e) {
      if (e) return SL.aviso('No se pudo aprobar: ' + e, 'error');
      SL.aviso('Boleta ' + p.codigo + ' aprobada', 'ok');
      cargarDinamico(refrescarListas);
    });
  }

  function anular(p) {
    var cambios = {};
    cambios['pedidos/' + p.id + '/estado'] = 'rechazada';
    cambios['ocupacion/' + p.ev + '/' + p.id] = null;
    SL.db.actualizar(cambios, function (e) {
      if (e) return SL.aviso('No se pudo anular: ' + e, 'error');
      SL.aviso('Pedido ' + p.codigo + ' anulado');
      cargarDinamico(refrescarListas);
    });
  }

  function filaPedido(p) {
    var est = p.estado === 'pendiente' && p.expira < Date.now() ? 'vencida' : p.estado;
    var chips = '<span class="chip ' + est + '">' + SL.ESTADOS[est] + '</span>';
    if (p.cortesia) chips += '<span class="chip cortesia">Cortesía</span>';
    if (p.aprobado && p.aprobado.por === 'sms') chips += '<span class="chip sms">Auto SMS</span>';
    var sub = p.cortesia ? (p.entradas || p.cant) + ' entradas' + (p.nota ? '. ' + SL.esc(p.nota) : '') :
      p.cant + ' × ' + SL.esc(p.tipoNombre) + ', ' + SL.plata(p.total) + '. Paga: ' + SL.esc(p.titular);
    sub += '. ' + SL.hace(p.creado || 0);
    if (p.usadas) sub += '. Ingresaron ' + p.usadas + ' de ' + (p.entradas || p.cant);
    var acc = '';
    if (est === 'pendiente') {
      acc = '<button class="boton ok chico" data-a="aprobar" data-id="' + p.id + '">Aprobar</button>' +
        '<button class="boton claro chico" data-a="anular" data-id="' + p.id + '">Anular</button>';
    } else if (est === 'vencida' && !p.cortesia) {
      acc = '<button class="boton claro chico" data-a="aprobar" data-id="' + p.id + '">Aprobar igual</button>';
    } else if (est === 'aprobada') {
      acc = (p.wa ? '<a class="boton chico" target="_blank" rel="noopener" href="' + SL.linkWhatsApp(p.wa, textoWhatsApp(p)) + '">WhatsApp</a>' : '') +
        '<a class="boton claro chico" target="_blank" href="' + SL.linkBoleta(p.id) + '">Boleta</a>';
    }
    return '<div class="fila ' + est + '">' +
      '<div><div class="fila-titulo">' + SL.esc(p.nombre) + ' <span class="fila-sub">' + SL.esc(p.codigo) + '</span>' + chips + '</div>' +
      '<div class="fila-sub">' + sub + '</div></div>' +
      '<div class="fila-acciones">' + acc + '</div></div>';
  }

  function conectarAcciones(cont) {
    cont.onclick = function (e) {
      var b = e.target.closest ? e.target.closest('[data-a]') : null;
      if (!b) return;
      var p = datos.pedidos[b.getAttribute('data-id')];
      if (!p) return;
      p.id = b.getAttribute('data-id');
      var a = b.getAttribute('data-a');
      if (a === 'aprobar') {
        if (confirm('¿Ya viste en Nequi el pago de ' + SL.plata(p.total) + ' de ' + p.titular + '?\n\nLa boleta ' + p.codigo + ' quedará aprobada.')) aprobarManual(p);
      } else if (a === 'anular') {
        if (confirm('¿Anular el pedido ' + p.codigo + ' de ' + p.nombre + '? Sus boletas se liberan.')) anular(p);
      }
    };
  }

  /* ---------- pestaña: pedidos ---------- */

  function vPedidos() {
    if (!listaEventos().length) return sinEventos();
    vista.innerHTML = '<div class="panel-cabeza"><h2>Pedidos</h2>' + selectorEvento() + '</div>' +
      '<div class="filtros" id="filtros">' +
        '<button type="button" data-f="pendiente">Por aprobar</button>' +
        '<button type="button" data-f="aprobada">Aprobadas</button>' +
        '<button type="button" data-f="todas">Todas</button>' +
      '</div>' +
      '<input class="entrada buscador" id="buscar" type="search" placeholder="Buscar por nombre, cédula o código" value="' + SL.esc(busqueda) + '">' +
      '<div id="lista-pedidos"></div>';
    conectarSelector();
    SL.$$('#filtros button').forEach(function (b) {
      if (b.getAttribute('data-f') === filtroPedidos) b.className = 'activa';
      b.onclick = function () { filtroPedidos = b.getAttribute('data-f'); vPedidos(); };
    });
    SL.$('#buscar').oninput = function () { busqueda = this.value; pintarListaPedidos(); };
    conectarAcciones(SL.$('#lista-pedidos'));
    huellas['lista-pedidos'] = null;
    pintarListaPedidos();
  }

  function coincide(p, q) {
    if (!q) return true;
    var t = SLMatcher.norm([p.nombre, p.codigo, p.doc, p.titular, p.wa].join(' '));
    return t.indexOf(SLMatcher.norm(q)) >= 0;
  }

  function pintarListaPedidos() {
    var ahora = Date.now();
    var l = pedidosDe(evSel).filter(function (p) {
      var est = p.estado === 'pendiente' && p.expira < ahora ? 'vencida' : p.estado;
      if (filtroPedidos !== 'todas' && est !== filtroPedidos) return false;
      return coincide(p, busqueda);
    });
    var h = '';
    if (!l.length) {
      h = '<div class="vacio">' + (filtroPedidos === 'pendiente' ? 'No hay pedidos esperando pago.' : 'No hay pedidos en esta lista.') + '</div>';
    }
    l.forEach(function (p) { h += filaPedido(p); });
    ponerHtml('lista-pedidos', h);
  }

  /* ---------- pestaña: pagos ---------- */

  function vPagos() {
    vista.innerHTML = '<div class="panel-cabeza"><h2>Pagos recibidos</h2></div>' +
      '<div id="estado-sms"></div>' +
      '<div class="caja caja-negra">' +
        '<h3>Pegar un SMS de Nequi</h3>' +
        '<p class="fila-sub" style="margin:0 0 10px">Si el celular del Santuario no reenvió un pago, copia el SMS aquí y se asigna igual.</p>' +
        '<label class="campo"><textarea id="sms-texto" placeholder="Nequi: Tu negocio EL SANTUARIO recibio $30.000 de ..."></textarea></label>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<button class="boton" type="button" id="sms-leer">Leer SMS</button>' +
          (SL.db.demo ? '<button class="boton claro" style="color:var(--marfil);border-color:var(--marfil)" type="button" id="sms-simular">Simular pago del último pedido</button>' : '') +
        '</div>' +
      '</div>' +
      '<div id="lista-pagos"></div>';

    SL.$('#sms-leer').onclick = function () {
      var t = SL.$('#sms-texto').value.trim();
      if (!t) return SL.aviso('Pega primero el texto del SMS', 'error');
      SL.procesarSms(t, function (e, r) {
        if (e) return SL.aviso('Error: ' + e, 'error');
        if (r.accion === 'repetido') SL.aviso('Ese SMS ya se había procesado');
        else if (r.accion === 'aprobar') SL.aviso('Pago asignado. Boleta ' + r.codigo + ' aprobada', 'ok');
        else SL.aviso(SLMatcher.RAZONES[r.razon] || 'Queda para revisar', 'error');
        SL.$('#sms-texto').value = '';
        cargarDinamico(refrescarListas);
      });
    };
    var sim = SL.$('#sms-simular');
    if (sim) sim.onclick = function () {
      var p = pedidosDe(null).filter(function (x) { return x.estado === 'pendiente' && x.expira > Date.now(); })[0];
      if (!p) return SL.aviso('No hay pedidos esperando pago. Compra uno en la página pública.', 'error');
      var d = new Date();
      var h = d.getHours() % 12 || 12, m = d.getMinutes();
      function dos(x) { return (x < 10 ? '0' : '') + x; }
      SL.$('#sms-texto').value = 'Nequi: Tu negocio ' + SLMatcher.norm(datos.config.organizador || 'EL SANTUARIO') +
        ' recibio ' + SL.plata(p.total) + ' de ' + SLMatcher.norm(p.titular).split(' ').slice(0, 2).join(' ') +
        ' el ' + dos(d.getDate()) + '/' + dos(d.getMonth() + 1) + '/' + d.getFullYear() +
        ' a las ' + dos(h) + ':' + dos(m) + ' ' + (d.getHours() >= 12 ? 'p.m.' : 'a.m.') +
        ' a través de Bre-B - Vende mas con Nequi Negocios.';
    };

    SL.$('#lista-pagos').onclick = function (e) {
      var b = e.target.closest ? e.target.closest('[data-pago]') : null;
      if (!b) return;
      var sid = b.getAttribute('data-pago');
      var pago = datos.pagos[sid];
      if (b.getAttribute('data-a') === 'ignorar') {
        SL.db.poner('pagos/' + sid + '/estado', 'ignorado', function () { cargarDinamico(refrescarListas); });
        return;
      }
      var sel = SL.$('#asignar-' + sid);
      var pid = sel && sel.value;
      if (!pid) return SL.aviso('Elige el pedido al que corresponde este pago', 'error');
      var p = datos.pedidos[pid];
      p.id = pid;
      if (confirm('Asignar ' + SL.plata(pago.monto) + ' de ' + pago.nombre + ' al pedido ' + p.codigo + ' (' + p.nombre + ')?')) {
        aprobarManual(p, { id: sid, texto: pago.texto, monto: pago.monto, nombre: pago.nombre, ts: pago.ts, recibido: pago.recibido });
      }
    };
    huellas['lista-pagos'] = null;
    pintarListaPagos();
  }

  function pintarListaPagos() {
    var pagos = SL.aLista(datos.pagos);
    pagos.sort(function (a, b) { return (b.recibido || 0) - (a.recibido || 0); });

    var ultimo = pagos.length ? pagos[0].recibido : null;
    ponerHtml('estado-sms', '<p class="fila-sub" style="margin:0 0 14px">' +
      (ultimo ? 'Último pago recibido ' + SL.hace(ultimo) + '.' : 'Todavía no ha llegado ningún pago.') + '</p>');

    var h = '';
    if (!pagos.length) h = '<div class="vacio">Cuando entre un pago por Nequi aparecerá aquí.</div>';
    var pendientes = pedidosDe(null).filter(function (p) {
      return (p.estado === 'pendiente' || p.estado === 'vencida') && !p.cortesia;
    });
    pagos.forEach(function (pg) {
      var est = pg.estado;
      var titulo = pg.monto ? SL.plata(pg.monto) + ' de ' + SL.esc(pg.nombre) : 'SMS sin leer';
      var sub = SL.hace(pg.recibido || 0);
      var extra = '';
      if (est === 'asignado') {
        var p = datos.pedidos[pg.pedido];
        sub += '. Boleta ' + SL.esc(pg.codigo || '') + (p ? ' de ' + SL.esc(p.nombre) : '') +
          (pg.por === 'sms' ? ', aprobada automáticamente' : ', asignada a mano');
      } else if (est === 'ignorado') {
        sub += '. Marcado como no relacionado';
      } else {
        sub += '. ' + SL.esc(SLMatcher.RAZONES[pg.razon] || 'Para revisar');
        var ops = pendientes.filter(function (p) { return !pg.monto || p.total === pg.monto; });
        ops.sort(function (a, b) {
          return SLMatcher.parecido(pg.nombre, b.titular) - SLMatcher.parecido(pg.nombre, a.titular);
        });
        extra = '<div class="fila-extra" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">';
        if (ops.length) {
          extra += '<select class="entrada" style="max-width:420px" id="asignar-' + pg.id + '"><option value="">Elegir pedido…</option>';
          ops.forEach(function (p) {
            extra += '<option value="' + p.id + '">' + SL.esc(p.codigo + ', ' + p.nombre + ' (paga ' + p.titular + '), ' + SL.plata(p.total) + ', ' + (datos.eventos[p.ev] ? datos.eventos[p.ev].nombre : '')) + '</option>';
          });
          extra += '</select><button class="boton chico" data-pago="' + pg.id + '" data-a="asignar">Asignar</button>';
        } else {
          extra += '<span class="fila-sub">No hay pedidos pendientes por ese valor.</span>';
        }
        extra += '<button class="boton claro chico" data-pago="' + pg.id + '" data-a="ignorar">No es de boletas</button></div>';
        if (!pg.monto) extra += '<div class="fila-extra fila-sub">' + SL.esc(pg.texto) + '</div>';
      }
      h += '<div class="fila ' + est + '"><div><div class="fila-titulo">' + titulo + '</div>' +
        '<div class="fila-sub">' + sub + '</div></div><div></div>' + extra + '</div>';
    });
    ponerHtml('lista-pagos', h);
  }

  /* ---------- pestaña: eventos ---------- */

  function vEventos() {
    var l = listaEventos();
    var h = '<div class="panel-cabeza"><h2>Eventos</h2><button class="boton" type="button" id="nuevo-evento">Nuevo evento</button></div>';
    if (!l.length) h += '<div class="vacio">Crea tu primer evento para empezar a vender.</div>';
    l.slice().reverse().forEach(function (ev) {
      var tipos = SL.tiposOrdenados(ev).map(function (t) { return t.nombre + ' ' + SL.plata(t.precio); }).join(', ');
      h += '<div class="fila ' + (ev.publicado ? 'aprobada' : 'vencida') + '">' +
        '<div><div class="fila-titulo">' + SL.esc(ev.nombre) + (ev.publicado ? '' : '<span class="chip vencida">Oculto</span>') + '</div>' +
        '<div class="fila-sub">' + SL.esc(SL.fechaLarga(ev.fecha)) + '. ' + SL.esc(tipos || 'Sin boletas') + '</div></div>' +
        '<div class="fila-acciones">' +
          '<button class="boton chico" data-editar="' + ev.id + '">Editar</button>' +
          '<button class="boton claro chico" data-link="' + ev.id + '">Copiar link</button>' +
        '</div></div>';
    });
    vista.innerHTML = h;
    SL.$('#nuevo-evento').onclick = function () { editorEvento(null); };
    vista.onclick = function (e) {
      var b = e.target.closest ? e.target.closest('[data-editar],[data-link]') : null;
      if (!b) return;
      if (b.getAttribute('data-editar')) editorEvento(b.getAttribute('data-editar'));
      else SL.copiar(SL.linkEvento(b.getAttribute('data-link')), function () { SL.aviso('Link del evento copiado', 'ok'); });
    };
  }

  function editorEvento(id) {
    vista.onclick = null;
    var ev = id ? JSON.parse(JSON.stringify(datos.eventos[id])) : {
      nombre: '', fecha: '', lugar: datos.config.organizador || 'El Santuario', direccion: '', descripcion: '', publicado: true,
      tipos: {}
    };
    var tipos = SL.tiposOrdenados(ev);
    if (!tipos.length) tipos = [{ id: 't' + SL.aleatorio(5), nombre: 'General', precio: '', cupo: '', hasta: '', personas: 1 }];
    var flyer = null, flyerCambio = false;

    function filaTipo(t) {
      return '<div class="tipo-editor" data-tipo="' + SL.esc(t.id) + '">' +
        '<label class="campo"><span>Nombre</span><input data-k="nombre" value="' + SL.esc(t.nombre) + '" placeholder="Preventa"></label>' +
        '<label class="campo"><span>Precio</span><input data-k="precio" inputmode="numeric" value="' + SL.esc(t.precio) + '" placeholder="20000"></label>' +
        '<label class="campo"><span>Cupo</span><input data-k="cupo" inputmode="numeric" value="' + SL.esc(t.cupo) + '" placeholder="50"></label>' +
        '<label class="campo"><span>Se vende hasta (opcional)</span><input data-k="hasta" type="datetime-local" value="' + SL.esc(t.hasta || '') + '"></label>' +
        '<label class="campo"><span>Personas</span><input data-k="personas" inputmode="numeric" value="' + SL.esc(t.personas || 1) + '"></label>' +
        '<button type="button" class="quitar" data-quitar aria-label="Quitar boleta">Quitar</button></div>';
    }

    vista.innerHTML = '<a href="#" class="volver" id="volver-eventos" style="margin-top:0">‹ Eventos</a>' +
      '<div class="panel-cabeza"><h2>' + (id ? 'Editar evento' : 'Nuevo evento') + '</h2></div>' +
      '<form id="form-evento" novalidate>' +
        '<div class="caja">' +
          '<label class="campo"><span>Nombre del evento</span><input id="e-nombre" value="' + SL.esc(ev.nombre) + '" required></label>' +
          '<div class="fila-campos">' +
            '<label class="campo"><span>Fecha y hora</span><input id="e-fecha" type="datetime-local" value="' + SL.esc(ev.fecha) + '" required></label>' +
            '<label class="campo"><span>Lugar</span><input id="e-lugar" value="' + SL.esc(ev.lugar) + '"></label>' +
          '</div>' +
          '<label class="campo"><span>Dirección o ciudad</span><input id="e-dir" value="' + SL.esc(ev.direccion) + '"></label>' +
          '<label class="campo"><span>Descripción</span><textarea id="e-desc">' + SL.esc(ev.descripcion) + '</textarea></label>' +
          '<label class="campo"><span>Flyer</span><input id="e-flyer" type="file" accept="image/*">' +
            '<small>Se reduce automáticamente para que cargue rápido.</small><div id="e-flyer-prev"></div></label>' +
          '<label class="interruptor"><input type="checkbox" id="e-pub"' + (ev.publicado ? ' checked' : '') + '> Visible en la página de boletas</label>' +
        '</div>' +
        '<div class="caja"><h3>Boletas</h3>' +
          '<p class="fila-sub" style="margin:0 0 12px">"Personas" es cuántas entran con cada boleta (2 para una boleta de pareja). ' +
          'Cuando una boleta llega a su fecha límite deja de venderse sola.</p>' +
          '<div id="e-tipos">' + tipos.map(filaTipo).join('') + '</div>' +
          '<button type="button" class="boton claro chico" id="e-agregar">Agregar tipo de boleta</button>' +
        '</div>' +
        '<p class="error-form" id="e-error" role="alert"></p>' +
        '<button class="boton" type="submit">Guardar evento</button>' +
      '</form>';

    SL.$('#volver-eventos').onclick = function (e) { e.preventDefault(); vEventos(); };
    SL.$('#e-agregar').onclick = function () {
      var d = document.createElement('div');
      d.innerHTML = filaTipo({ id: 't' + SL.aleatorio(5), nombre: '', precio: '', cupo: '', hasta: '', personas: 1 });
      SL.$('#e-tipos').appendChild(d.firstChild);
    };
    SL.$('#e-tipos').onclick = function (e) {
      if (e.target.hasAttribute('data-quitar')) {
        var fila = e.target.parentNode;
        var tid = fila.getAttribute('data-tipo');
        var vendidas = id ? pedidosDe(id).filter(function (p) { return p.tipo === tid && (p.estado === 'aprobada' || p.estado === 'pendiente'); }).length : 0;
        if (vendidas) return SL.aviso('Esta boleta ya tiene pedidos. Ponle fecha límite para cerrarla.', 'error');
        fila.parentNode.removeChild(fila);
      }
    };

    if (id) {
      SL.db.obtener('flyers/' + id, null, function (e, img) {
        if (img) SL.$('#e-flyer-prev').innerHTML = '<img class="vista-previa-img" src="' + img + '" alt="">';
      });
    }
    SL.$('#e-flyer').onchange = function () {
      if (!this.files[0]) return;
      SL.imagenATexto(this.files[0], 900, 0.72, 'image/jpeg', function (e, txt) {
        if (e) return SL.aviso(e, 'error');
        flyer = txt;
        flyerCambio = true;
        SL.$('#e-flyer-prev').innerHTML = '<img class="vista-previa-img" src="' + txt + '" alt="">';
      });
    };

    SL.$('#form-evento').onsubmit = function (e) {
      e.preventDefault();
      var err = SL.$('#e-error');
      err.textContent = '';
      var nuevo = {
        nombre: SL.$('#e-nombre').value.trim(),
        fecha: SL.$('#e-fecha').value,
        lugar: SL.$('#e-lugar').value.trim(),
        direccion: SL.$('#e-dir').value.trim(),
        descripcion: SL.$('#e-desc').value.trim(),
        publicado: SL.$('#e-pub').checked,
        creado: ev.creado || Date.now(),
        tipos: {}
      };
      if (!nuevo.nombre) return (err.textContent = 'Ponle nombre al evento.');
      if (!SL.aFecha(nuevo.fecha)) return (err.textContent = 'Elige la fecha y hora del evento.');
      var filas = SL.$$('#e-tipos [data-tipo]');
      if (!filas.length) return (err.textContent = 'Agrega al menos un tipo de boleta.');
      for (var i = 0; i < filas.length; i++) {
        var f = filas[i];
        var t = {
          nombre: SL.$('[data-k=nombre]', f).value.trim(),
          precio: parseInt(SL.soloDigitos(SL.$('[data-k=precio]', f).value) || '0', 10),
          cupo: parseInt(SL.soloDigitos(SL.$('[data-k=cupo]', f).value) || '0', 10),
          hasta: SL.$('[data-k=hasta]', f).value || '',
          personas: Math.max(1, parseInt(SL.soloDigitos(SL.$('[data-k=personas]', f).value) || '1', 10)),
          orden: i + 1
        };
        if (!t.nombre) return (err.textContent = 'Cada boleta necesita un nombre.');
        if (!t.cupo) return (err.textContent = 'Pon cuántas boletas hay de "' + t.nombre + '".');
        nuevo.tipos[f.getAttribute('data-tipo')] = t;
      }
      var evId = id || 'ev' + SL.aleatorio(10);
      var cambios = {};
      cambios['eventos/' + evId] = nuevo;
      if (flyerCambio) cambios['flyers/' + evId] = flyer;
      SL.db.actualizar(cambios, function (e2) {
        if (e2) return (err.textContent = 'No se pudo guardar: ' + e2);
        datos.eventos[evId] = nuevo;
        if (!id) {
          evSel = evId;
          try { localStorage.setItem('sl_ev_sel', evSel); } catch (x) {}
        }
        SL.aviso('Evento guardado', 'ok');
        vEventos();
      });
    };
  }

  /* ---------- pestaña: cortesías ---------- */

  function vCortesias() {
    if (!listaEventos().length) return sinEventos();
    vista.innerHTML = '<div class="panel-cabeza"><h2>Cortesías</h2>' + selectorEvento() + '</div>' +
      '<form class="caja" id="form-cortesia" novalidate>' +
        '<h3>Nueva cortesía</h3>' +
        '<label class="campo"><span>Nombre de la persona</span><input id="c-nombre" required></label>' +
        '<div class="fila-campos">' +
          '<label class="campo"><span>WhatsApp (opcional)</span><input id="c-wa" inputmode="tel"></label>' +
          '<label class="campo"><span>Entradas</span><input id="c-cant" inputmode="numeric" value="1"></label>' +
        '</div>' +
        '<label class="campo"><span>Nota (opcional)</span><input id="c-nota" placeholder="Artista, prensa, staff…"></label>' +
        '<p class="error-form" id="c-error" role="alert"></p>' +
        '<button class="boton" type="submit">Crear cortesía</button>' +
      '</form>' +
      '<div id="lista-cortesias"></div>';
    conectarSelector();
    SL.$('#form-cortesia').onsubmit = function (e) {
      e.preventDefault();
      var nombre = SL.$('#c-nombre').value.trim();
      var cant = Math.max(1, Math.min(20, parseInt(SL.soloDigitos(SL.$('#c-cant').value) || '1', 10)));
      if (!nombre) return (SL.$('#c-error').textContent = 'Escribe el nombre de la persona.');
      var ev = datos.eventos[evSel];
      var id = SL.nuevoId();
      var wa = SL.soloDigitos(SL.$('#c-wa').value);
      if (wa.length === 12 && wa.indexOf('57') === 0) wa = wa.slice(2);
      var p = {
        codigo: SL.nuevoCodigo(), ev: evSel, evNombre: ev.nombre, evFecha: ev.fecha,
        tipo: 'cortesia', tipoNombre: 'Cortesía', cant: cant, entradas: cant, precio: 0, total: 0,
        nombre: nombre, doc: '', wa: wa, titular: '', nota: SL.$('#c-nota').value.trim(),
        estado: 'aprobada', cortesia: true, creado: { '.sv': 'timestamp' }, expira: 0, usadas: 0,
        aprobado: { ts: Date.now(), por: 'cortesia' }
      };
      SL.db.poner('pedidos/' + id, p, function (e2) {
        if (e2) return (SL.$('#c-error').textContent = 'No se pudo crear: ' + e2);
        SL.aviso('Cortesía creada para ' + nombre, 'ok');
        SL.$('#form-cortesia').reset();
        SL.$('#c-cant').value = 1;
        cargarDinamico(refrescarListas);
      });
    };
    huellas['lista-cortesias'] = null;
    pintarListaCortesias();
  }

  function pintarListaCortesias() {
    var l = pedidosDe(evSel).filter(function (p) { return p.cortesia && p.estado === 'aprobada'; });
    var total = 0;
    l.forEach(function (p) { total += p.entradas || p.cant; });
    var h = '<h3 style="font-size:26px;text-transform:uppercase;margin:6px 0 12px">' + total + ' entradas de cortesía</h3>';
    l.forEach(function (p) { h += filaPedido(p); });
    ponerHtml('lista-cortesias', h);
  }

  /* ---------- pestaña: reporte ---------- */

  function vReporte() {
    if (!listaEventos().length) return sinEventos();
    vista.innerHTML = '<div class="panel-cabeza"><h2>Reporte</h2>' + selectorEvento() + '</div>' +
      '<div id="reporte-cuerpo"></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:18px">' +
        '<button class="boton negro" type="button" id="csv-asistentes">Descargar lista para la puerta</button>' +
        '<button class="boton claro" type="button" id="csv-todo">Descargar todos los pedidos</button>' +
      '</div>' +
      '<p class="fila-sub">Los archivos abren directo en Excel.</p>';
    conectarSelector();
    SL.$('#csv-asistentes').onclick = function () { descargarCsv(true); };
    SL.$('#csv-todo').onclick = function () { descargarCsv(false); };
    huellas['reporte-cuerpo'] = null;
    pintarReporte();
  }

  function pintarReporte() {
    var ev = datos.eventos[evSel];
    if (!ev) return;
    var ahora = Date.now();
    var peds = pedidosDe(evSel);
    var porTipo = {};
    var ingresos = 0, vendidas = 0, entradas = 0, ingresaron = 0, porAprobar = 0, cortesias = 0;
    peds.forEach(function (p) {
      var est = p.estado === 'pendiente' && p.expira < ahora ? 'vencida' : p.estado;
      var r = porTipo[p.tipo] || (porTipo[p.tipo] = { vendidas: 0, apartadas: 0, ingresos: 0 });
      if (est === 'aprobada') {
        entradas += p.entradas || p.cant;
        ingresaron += p.usadas || 0;
        if (p.cortesia) { cortesias += p.entradas || p.cant; return; }
        r.vendidas += p.cant;
        r.ingresos += p.total;
        vendidas += p.cant;
        ingresos += p.total;
      } else if (est === 'pendiente') {
        r.apartadas += p.cant;
        porAprobar++;
      }
    });
    var h = '<div class="cifras">' +
      '<div class="cifra vino"><strong>' + SL.plata(ingresos) + '</strong><span>Recaudado</span></div>' +
      '<div class="cifra"><strong>' + vendidas + '</strong><span>Boletas vendidas</span></div>' +
      '<div class="cifra"><strong>' + ingresaron + ' / ' + entradas + '</strong><span>Personas que ya entraron</span></div>' +
      '<div class="cifra"><strong>' + porAprobar + '</strong><span>Esperando pago</span></div>' +
      '</div>' +
      '<div class="tabla-scroll"><table class="tabla"><thead><tr><th>Boleta</th><th class="num">Precio</th><th class="num">Cupo</th>' +
      '<th class="num">Vendidas</th><th class="num">Apartadas</th><th class="num">Recaudado</th></tr></thead><tbody>';
    var cupoTotal = 0;
    SL.tiposOrdenados(ev).forEach(function (t) {
      var r = porTipo[t.id] || { vendidas: 0, apartadas: 0, ingresos: 0 };
      cupoTotal += t.cupo;
      h += '<tr><td>' + SL.esc(t.nombre) + '</td><td class="num">' + SL.plata(t.precio) + '</td><td class="num">' + t.cupo + '</td>' +
        '<td class="num">' + r.vendidas + '</td><td class="num">' + r.apartadas + '</td><td class="num">' + SL.plata(r.ingresos) + '</td></tr>';
    });
    h += '<tr><td>Cortesías</td><td class="num">–</td><td class="num">–</td><td class="num">' + cortesias + '</td><td class="num">–</td><td class="num">–</td></tr>';
    h += '</tbody><tfoot><tr><td>Total</td><td></td><td class="num">' + cupoTotal + '</td><td class="num">' + vendidas + '</td><td></td>' +
      '<td class="num">' + SL.plata(ingresos) + '</td></tr></tfoot></table></div>';
    ponerHtml('reporte-cuerpo', h);
  }

  function descargarCsv(soloAsistentes) {
    var ev = datos.eventos[evSel];
    var ahora = Date.now();
    var l = pedidosDe(evSel);
    if (soloAsistentes) {
      l = l.filter(function (p) { return p.estado === 'aprobada'; });
      l.sort(function (a, b) { return SLMatcher.norm(a.nombre) < SLMatcher.norm(b.nombre) ? -1 : 1; });
    }
    function celda(v) { v = String(v === undefined || v === null ? '' : v); return '"' + v.replace(/"/g, '""') + '"'; }
    var cab = soloAsistentes ?
      ['Nombre', 'Cédula', 'Código', 'Boleta', 'Entradas', 'Ingresaron', 'WhatsApp'] :
      ['Código', 'Estado', 'Nombre', 'Cédula', 'WhatsApp', 'Titular del pago', 'Boleta', 'Cantidad', 'Entradas', 'Total', 'Creado', 'Aprobado por', 'Ingresaron'];
    var filas = [cab.map(celda).join(';')];
    l.forEach(function (p) {
      var est = p.estado === 'pendiente' && p.expira < ahora ? 'vencida' : p.estado;
      var fila = soloAsistentes ?
        [p.nombre, p.doc, p.codigo, p.cortesia ? 'Cortesía' : p.tipoNombre, p.entradas || p.cant, p.usadas || 0, p.wa] :
        [p.codigo, SL.ESTADOS[est], p.nombre, p.doc, p.wa, p.titular, p.cortesia ? 'Cortesía' : p.tipoNombre, p.cant,
          p.entradas || p.cant, p.total, p.creado ? SL.fechaCorta(p.creado) : '',
          p.aprobado ? p.aprobado.por : '', p.usadas || 0];
      filas.push(fila.map(celda).join(';'));
    });
    var blob = new Blob(['﻿' + filas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = SLMatcher.norm(ev.nombre).toLowerCase().replace(/ /g, '-') + (soloAsistentes ? '-lista-puerta' : '-pedidos') + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); document.body.removeChild(a); }, 1000);
  }

  /* ---------- pestaña: ajustes ---------- */

  function vAjustes() {
    var c = datos.config;
    var qrNuevo = null;
    var minutos = [15, 20, 30, 45, 60];
    vista.innerHTML = '<div class="panel-cabeza"><h2>Ajustes</h2></div>' +
      '<form id="form-ajustes" novalidate>' +
        '<div class="caja"><h3>Cobro</h3>' +
          '<label class="campo"><span>Nombre del organizador</span><input id="a-org" value="' + SL.esc(c.organizador || '') + '"></label>' +
          '<label class="campo"><span>Llave Bre-B de Nequi Negocios</span><input id="a-llave" value="' + SL.esc(c.llave || '') + '" placeholder="@ELSANTUARIO">' +
            '<small>Es la que ve el comprador para pagar.</small></label>' +
          '<label class="campo"><span>Imagen del QR Negocios</span><input id="a-qr" type="file" accept="image/*">' +
            '<small>Descárgalo desde tu app Nequi y súbelo aquí.</small><div id="a-qr-prev">' +
            (c.qr ? '<img class="vista-previa-img" src="' + c.qr + '" alt="">' : '') + '</div></label>' +
          '<label class="campo"><span>Tiempo para pagar</span><select id="a-min">' +
            minutos.map(function (m) { return '<option value="' + m + '"' + ((c.minutosReserva || 30) === m ? ' selected' : '') + '>' + m + ' minutos</option>'; }).join('') +
          '</select><small>Si no entra el pago en ese tiempo, las boletas se liberan.</small></label>' +
          '<label class="campo"><span>WhatsApp de atención</span><input id="a-wa" inputmode="tel" value="' + SL.esc(c.whatsapp || '') + '">' +
            '<small>A este número te escriben los compradores si algo sale mal.</small></label>' +
        '</div>' +
        '<button class="boton" type="submit">Guardar ajustes</button>' +
      '</form>';

    SL.$('#a-qr').onchange = function () {
      if (!this.files[0]) return;
      SL.imagenATexto(this.files[0], 520, 0.9, 'image/png', function (e, txt) {
        if (e) return SL.aviso(e, 'error');
        qrNuevo = txt;
        SL.$('#a-qr-prev').innerHTML = '<img class="vista-previa-img" src="' + txt + '" alt="">';
      });
    };
    SL.$('#form-ajustes').onsubmit = function (e) {
      e.preventDefault();
      var cambios = {
        'config/organizador': SL.$('#a-org').value.trim(),
        'config/llave': SL.$('#a-llave').value.trim(),
        'config/minutosReserva': parseInt(SL.$('#a-min').value, 10),
        'config/whatsapp': SL.soloDigitos(SL.$('#a-wa').value)
      };
      if (qrNuevo) cambios['config/qr'] = qrNuevo;
      SL.db.actualizar(cambios, function (e2) {
        if (e2) return SL.aviso('No se pudo guardar: ' + e2, 'error');
        for (var k in cambios) datos.config[k.replace('config/', '')] = cambios[k];
        SL.aviso('Ajustes guardados', 'ok');
      });
    };
  }

  /* ---------- arranque ---------- */

  if (SL.db.recuperar()) iniciar();
  else mostrarLogin();
})();
