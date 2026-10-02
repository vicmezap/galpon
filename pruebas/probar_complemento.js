/* =====================================================================
   probar_complemento.js — las dos páginas publicables

   Son DOS, y la separación es el proyecto entero en miniatura:

     panel.html       el lanzador · 3 módulos · estado del libro y botones
     modelador.html   la aplicación · 27 módulos · en un diálogo de 88 × 88

   Antes había UNA sola página de cuatro pestañas de solo mirar, registrada
   como panel de tareas: salía aplastada en una franja de 320 px y no
   escribía una celda. Se tiró.

   LAS DOS SE EJECUTAN AQUÍ CONTRA UN DOM DE JUGUETE, y hace falta porque
   ya pasó: una llamada a una función que no existía reventaba la página en
   la primera línea, y ninguna de las otras comprobaciones lo veía.
   ===================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const BUNDLE = require("../src/bundle.js");
const INV = require("../src/inventario.js");

const DIR = path.join(__dirname, "..", "complemento");
const leer = (f) => fs.readFileSync(path.join(DIR, f), "utf8");

/* ================================================================
   0 · ESTÁ GENERADO Y NO ESTÁ RANCIO
   ================================================================ */
cierto("la guarda alDiaOMuere() lo da por al día", BUNDLE.alDiaOMuere() === true);
for (const f of ["panel.html", "modelador.html", "manifest.xml", "index.html",
  "icono-16.png", "icono-32.png", "icono-80.png"]) {
  cierto("existe " + f, fs.existsSync(path.join(DIR, f)));
}
cierto("la página vieja de cuatro pestañas ya no está",
  !fs.existsSync(path.join(DIR, "taskpane.html")));
cierto("ni su plantilla",
  !fs.existsSync(path.join(__dirname, "..", "scripts", "complemento.plantilla.html")));

const panelHtml = leer("panel.html");
const modeHtml = leer("modelador.html");

/* EL LANZADOR ES PEQUEÑO, Y NO POR OPTIMIZAR: no calcula, así que no lleva
   el catálogo de 2408 perfiles. */
cierto("el panel pesa mucho menos que el modelador",
  panelHtml.length < modeHtml.length / 4);
cierto("y no lleva el catálogo dentro", panelHtml.indexOf("CATALOGOS_DATOS") < 0);
cierto("el modelador sí", modeHtml.indexOf("CATALOGOS_DATOS") >= 0);
for (const [n, h] of [["panel", panelHtml], ["modelador", modeHtml]]) {
  cierto(n + " carga Office.js del CDN de Microsoft",
    /appsforoffice\.microsoft\.com\/lib\/1\/hosted\/office\.js/.test(h));
  cierto(n + " lleva su sello de build", /window\.GALPON_BUILD = "/.test(h));
}

/* ---------- el DOM de juguete ---------- */
function montaDom(win) {
  const val = {};
  if (win.VISTAS) {
    for (const e of win.VISTAS.ENTRADAS) {
      val["c_" + e.id] = {
        value: e.tipo === "si/no" ? "" : String(e.valor),
        checked: e.tipo === "si/no" ? !!e.valor : false
      };
    }
  }
  const nodos = {};
  function nodo(id) {
    if (nodos[id]) return nodos[id];
    const n = {
      id: id, innerHTML: "", textContent: "", hidden: false, className: "",
      value: val[id] ? val[id].value : "",
      checked: val[id] ? val[id].checked : false,
      _at: {}, onclick: null,
      addEventListener: function (t, fn) {
        this._ev = this._ev || {};
        (this._ev[t] = this._ev[t] || []).push(fn);
      },
      setAttribute: function (k, v) { this._at[k] = v; },
      getAttribute: function (k) { return this._at[k] === undefined ? null : this._at[k]; },
      querySelectorAll: function () { return []; },
      closest: function () { return null; }
    };
    nodos[id] = n;
    return n;
  }
  return { doc: { getElementById: nodo, addEventListener: function () {} },
    nodos: nodos, valores: val };
}
const pinto = (dm, id) => (dm && dm.nodos[id]) ||
  { innerHTML: "", textContent: "", hidden: null };

/* PULSAR DE VERDAD · el DOM de juguete no tiene closest(), asi que el clic
   se finge con el boton que el manejador espera encontrar. Hace falta
   porque el armazon de un paso solo se puede comprobar ENTRANDO en el
   paso: es exactamente lo que nadie hizo cuando se colo. */
function pulsa(dm, nodo, attr, valor) {
  const b = { getAttribute: (k) => (k === attr ? valor : null) };
  const sel = "button[" + attr + "]";
  const ev = {
    target: { closest: (s) => (s === sel ? b : null) },
    preventDefault: function () {}
  };
  for (const fn of dm.nodos[nodo]._ev.click) fn(ev);
}

function carga(html, conDom) {
  const b = [];
  const re = /<script>\n([\s\S]*?)\n<\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) b.push(m[1]);
  const win = {};
  win.window = win; win.self = win;
  win.alert = function () {};
  const ctx = vm.createContext(win);
  let err = null;
  try { vm.runInContext(b[0], ctx, { filename: "modulos.js" }); }
  catch (e) { err = e; }
  let dom = null, errApp = null;
  if (!err && conDom) {
    dom = montaDom(win);
    win.document = dom.doc;
    try { vm.runInContext(b[1], ctx, { filename: "app.js" }); }
    catch (e) { errApp = e; }
  }
  return { win: win, dom: dom, bloques: b.length, err: err, errApp: errApp };
}

/* ================================================================
   1 · EL LANZADOR
   ================================================================ */
const P = carga(panelHtml, true);
comp("el panel tiene dos bloques de script", P.bloques, 2);
cierto("sus módulos cargan" + (P.err ? ": " + P.err.message : ""), !P.err);
comp("y son los tres que necesita",
  ["INVENTARIO", "LIBRO", "PANEL"].filter((k) => !P.win[k]), []);
cierto("no lleva los de cálculo: no es su trabajo",
  !P.win.ACERO && !P.win.MONTAJE && !P.win.VISTAS);
cierto("LA PÁGINA DEL PANEL SE EJECUTA SIN REVENTAR" +
  (P.errApp ? ": " + P.errApp.message : ""), !P.errApp);

cierto("pinta la ficha del libro", /class="ln"/.test(pinto(P.dom, "ficha").innerHTML));
cierto("pinta los tres botones",
  (pinto(P.dom, "botones").innerHTML.match(/<button/g) || []).length === 3);

/* LA GUARDA EN PANTALLA: Guardar nace apagado y dice por qué */
const bot = pinto(P.dom, "botones").innerHTML;
cierto("«Abrir modelador» es el botón principal", /class="b pri"/.test(bot));
cierto("y Guardar nace deshabilitado", /id="btn-guardar" disabled/.test(bot));
cierto("con la razón escrita debajo", /abre el modelador primero/.test(bot));
cierto("el estado dice que el libro venía vacío",
  /no tra[íi]a ning[úu]n modelo/.test(pinto(P.dom, "estado").textContent));
cierto("y los tres pasos del cómo se usa están",
  (pinto(P.dom, "uso").innerHTML.match(/<li>/g) || []).length === 3);

/* Abre el diálogo como Retícula, y por las razones de Retícula */
cierto("abre el diálogo a 88 × 88", /height:\s*88,\s*width:\s*88/.test(panelHtml));
cierto("y fuera de iframe, que es lo que lo hace grande",
  /displayInIframe:\s*false/.test(panelHtml));
cierto("con el sello de minuto contra la caché de WebView2",
  /Math\.floor\(Date\.now\(\) \/ 60000\)/.test(panelHtml));
cierto("apuntando al modelador", /modelador\.html/.test(panelHtml));
cierto("escribe en la hoja MUY oculta, no solo oculta", /veryHidden/.test(panelHtml));
cierto("y usa el rango y el troceado de libro.js",
  /LIBRO\.RANGO/.test(panelHtml) && /LIBRO\.paraElRango/.test(panelHtml));
cierto("valida lo que llega de la ventana ANTES de escribirlo",
  /PANEL\.recibeDeLaVentana/.test(panelHtml));

/* ================================================================
   2 · EL MODELADOR
   ================================================================ */
const M = carga(modeHtml, true);
comp("el modelador tiene dos bloques", M.bloques, 2);
cierto("sus módulos cargan" + (M.err ? ": " + M.err.message : ""), !M.err);
const ESPERADOS = ["INVENTARIO", "UNIDADES", "PROPIEDADES", "PERFILES", "E020",
  "VIENTO", "E030", "COMBINACIONES", "MODELO", "SOLVER", "ESTABILIDAD", "RIOSTRAS",
  "ACERO", "ELEMENTO", "BUCLE", "CORREAS", "TIJERAL", "COLUMNAS", "ARRIOSTRES",
  "PLACABASE", "GENERADOR", "MONTAJE", "VISTA3D", "VISTAS", "LIBRO", "PANEL",
  "PROYECTO"];
comp("los 27 módulos quedan colgados de window",
  ESPERADOS.filter((k) => !M.win[k]), []);
cierto("LA PÁGINA DEL MODELADOR SE EJECUTA SIN REVENTAR" +
  (M.errApp ? ": " + M.errApp.message : ""), !M.errApp);

/* LA BARRA DE PASOS */
const pasos = pinto(M.dom, "pasos").innerHTML;
comp("hay once botones de paso", (pasos.match(/data-paso=/g) || []).length, 11);
cierto("agrupados por ESTADO, PASO n y SALIDA",
  /Estado/.test(pasos) && /Paso 2 · Modelo/.test(pasos) && /Salida/.test(pasos));
cierto("los que no tienen pantalla se marcan en vez de fingirse",
  /class="falta"/.test(pasos));
cierto("y entre ellos están Hojas Excel y AutoCAD",
  /Hojas Excel/.test(pasos) && /AutoCAD/.test(pasos));

/* LAS VISTAS Y EL LIENZO */
const vistas = pinto(M.dom, "vistas").innerHTML;
comp("cuatro vistas", (vistas.match(/data-v=/g) || []).length, 4);
cierto("Pórtico, Planta de techo, Elevación y 3D",
  /Pórtico/.test(vistas) && /Planta de techo/.test(vistas) &&
  /Elevación/.test(vistas) && />3D</.test(vistas));

const centro = pinto(M.dom, "centro").innerHTML;
cierto("EL LIENZO DIBUJA", /<svg /.test(centro));
cierto("con el galpón entero, no cuatro líneas",
  (centro.match(/<line /g) || []).length > 40);
cierto("y con su leyenda", /class="leyenda"/.test(centro));

/* ───── Y ES UN DIBUJO, NO UN CROQUIS ─────
   Sin cifras no se puede medir y sin etiquetas no se puede señalar. */
cierto("LLEVA COTAS, con sus números",
  (centro.match(/class="cota"/g) || []).length >= 15);
cierto("y la luz entera está entre ellas", />20,00 m</.test(centro));
cierto("LLEVA ETIQUETAS de nudo",
  (centro.match(/class="etiq"/g) || []).length >= 15);
cierto("y los ejes en círculo, como en un plano",
  (centro.match(/class="ejeN"/g) || []).length === 2 && /<circle /.test(centro));
cierto("LOS APOYOS SE DIBUJAN con su símbolo, no son un final de línea",
  (centro.match(/<path /g) || []).length === 2);
cierto("y hay líneas de eje discontinuas detrás", /stroke-dasharray/.test(centro));
cierto("hay zoom", /data-z="\+"/.test(centro) && /data-z="-"/.test(centro));
cierto("y se dice a qué escala se está mirando", /class="escala"/.test(centro));

/* LAS MÉTRICAS VIVAS */
const met = pinto(M.dom, "metricas").innerHTML;
cierto("la barra de métricas trae la luz y el largo",
  /Luz/.test(met) && /Largo/.test(met));
cierto("los pórticos y el acero medido", /Pórticos/.test(met) && /Acero/.test(met));
cierto("LA PASADA, que es de Galpón y no de Retícula", /Pasada/.test(met));
cierto("y el selector de combinación", /Combinación/.test(met));

/* EL PANEL DERECHO · la tesis */
const der = pinto(M.dom, "derecha").innerHTML;
cierto("el panel derecho trae fichas", /class="tarj/.test(der));

/* ───── LAS TABLAS · sin la de perfiles no se puede trabajar ───── */
comp("hay dos tablas", (der.match(/<table class="t"/g) || []).length, 2);
comp("una fila de perfil por clase de barra",
  (der.match(/data-perfil=/g) || []).length, 10);
cierto("con el catálogo detrás para escribir el nombre",
  /list="catalogo"/.test(der));
cierto("y las que no tienen perfil se marcan",
  /class="vacio"/.test(der) && /sin asignar/.test(der));
comp("y una casilla de arriostre por paño y plano",
  (der.match(/data-at=/g) || []).length, 10);
comp("en los dos planos", (der.match(/data-af=/g) || []).length, 10);
cierto("ASIGNAR UN PERFIL SE PUEDE HACER, que es lo principal de la herramienta",
  /data-perfil=/.test(der) && /LIBRO\.asignaPerfil/.test(modeHtml));
cierto("y un perfil que no está en el catálogo no se guarda",
  /no se guarda un perfil que no está en el catálogo/.test(modeHtml));
cierto("la casilla y el campo de texto son la misma cosa, no dos verdades",
  /no haya dos verdades/.test(modeHtml));
const lineas = (der.match(/<div class="ln">/g) || []).length;
const conFuente = (der.match(/data-fte="/g) || []).length;
const conOrigen = (der.match(/<span class="org">/g) || []).length;
cierto("con líneas de verdad", lineas >= 8);
comp("y TODAS declaran su procedencia, sin excepción",
  lineas, conFuente + conOrigen);
const fuentes = (der.match(/data-fte="([^"]+)"/g) || [])
  .map((s) => s.replace(/.*="|"$/g, ""));
comp("todo botón de fuente apunta a una fila que existe",
  fuentes.filter((id) => !INV.existe(id)), []);

/* ───── VER Y AISLAR, NO DIBUJAR ─────
   Aquí había una paleta de dibujo copiada de Retícula. Era un error de
   método: en un galpón no hay nada libre que dibujar. */
cierto("YA NO HAY PALETA DE DIBUJO", !/data-h=/.test(modeHtml));
const capas = pinto(M.dom, "capas").innerHTML;
comp("hay una capa por clase de barra",
  (capas.match(/data-capa=/g) || []).length, 10);
comp("cada una con su botón de aislar",
  (capas.match(/data-ais=/g) || []).length, 10);
comp("y su casilla de ver", (capas.match(/data-ver=/g) || []).length, 10);
cierto("con el resumen de cuántas barras se ven",
  /733/.test(pinto(M.dom, "resumen").innerHTML));
cierto("el código explica por qué no es una paleta",
  /error de\s+método/.test(modeHtml) && /NO HAY NADA LIBRE/.test(modeHtml));

/* ───── EL LIENZO SELECCIONA ───── */
cierto("cada barra lleva una línea gorda transparente para poder pincharla",
  (centro.match(/class="toca"/g) || []).length > 20);
cierto("con el id de la barra", /data-barra="/.test(centro));
cierto("y se explica por qué: una barra de 1 px no se acierta con el ratón",
  /no se acierta con el ratón/.test(modeHtml));
cierto("sin nada seleccionado, el panel lo dice e invita",
  /Nada seleccionado/.test(der) && /pincha una barra/.test(der));

/* ───── TODO CON EL RATÓN, SIN TECLAS ───── */
cierto("hay arrastre", /mousedown/.test(modeHtml) && /mousemove/.test(modeHtml));
cierto("que mueve el azimut y la elevación",
  /c_azim/.test(modeHtml) && /c_elev3d/.test(modeHtml));
cierto("la rueda acerca", /"wheel"/.test(modeHtml));
cierto("el derecho encuadra, así que se le quita el menú contextual",
  /contextmenu/.test(modeHtml));
cierto("y el central también encuadra, de propina",
  /boton !== 0/.test(modeHtml) && /memoria de Revit/.test(modeHtml));
cierto("EL UMBRAL hace que convivan el clic y el arrastre",
  /UMBRAL = 4/.test(modeHtml) && /es un clic, por encima es un arrastre/.test(modeHtml));
cierto("y seleccionar se cancela si hubo arrastre",
  /arrastre && arrastre\.movido/.test(modeHtml));

/* LO QUE DE VERDAD FALLABA, y queda escrito en el código */
cierto("GIRAR DESCLAVA LA ISOMÉTRICA, o la cámara tira el ángulo",
  /c_proy"\)\.value === "isometrica"/.test(modeHtml));
cierto("con la explicación de por qué no se movía",
  /la camara lo\s+TIRABA/.test(modeHtml) &&
  /angulos clavados/.test(modeHtml));

/* EL CUBO DE VISTAS */
cierto("hay cuatro vistas de un clic", /data-vista=/.test(modeHtml));
cierto("y vienen de vista3d.js, no inventadas en la plantilla",
  /VISTA3D\.PRESETS/.test(modeHtml));
cierto("con el aviso de si lo que se mira se puede medir",
  /se puede medir/.test(modeHtml) && /NO se puede medir/.test(modeHtml));
cierto("y un atajo para volver a la isométrica", /a-iso/.test(modeHtml));

/* MOVER LA CÁMARA NO TOCA EL MOTOR */
cierto("repintar y recalcular están separados",
  /function repinta\(\)/.test(modeHtml) && /soloVista/.test(modeHtml));
cierto("y se dice por qué: la cámara NO puede cambiar un número del cálculo",
  /no mentir/.test(modeHtml) &&
  /camara NO puede cambiar un numero/.test(modeHtml));

/* ───── CADA PASO CON SU ARMAZON ─────
   ESTABA MAL Y SE VEIA: la barra de vistas y el panel de la izquierda son
   de GEOMETRIA y se colaban en los once pasos. Aqui se ENTRA en los pasos
   y se mira que arma la pagina, porque de otro modo esto no se ve. */
cierto("la lista de pasos NO esta duplicada a mano en la plantilla",
  /var PASOS = VISTAS\.PASOS;/.test(modeHtml));
const barra = pinto(M.dom, "pasos").innerHTML;
comp("la barra lleva los once pasos",
  (barra.match(/data-paso=/g) || []).length, 11);
comp("y un grupo del diagrama por cada uno que haya, contados y no a dedo",
  (barra.match(/class="grupo"/g) || []).length,
  M.win.VISTAS.PASOS.map((p) => p.grupo)
    .filter((g, i, a) => a.indexOf(g) === i).length);
comp("los que no tienen pantalla salen apagados",
  (barra.match(/class="falta"/g) || []).length,
  M.win.VISTAS.PASOS.filter((p) => !p.listo).length);

/* EN GEOMETRIA: barra de vistas, los dos lados y el panel derecho */
comp("en Geometria se ve la barra de vistas", pinto(M.dom, "vistas").hidden, false);
comp("y las capas", pinto(M.dom, "lado-ver").hidden, false);
comp("y los parametros", pinto(M.dom, "lado-parametros").hidden, false);

/* UN PASO SIN PANTALLA: se va todo lo de Geometría y se dice qué falta */
pulsa(M.dom, "pasos", "data-paso", "conex");
comp("EN CONEXIONES LA BARRA DE VISTAS DESAPARECE", pinto(M.dom, "vistas").hidden, true);
comp("y las metricas del galpon tambien", pinto(M.dom, "metricas").hidden, true);
comp("y el panel entero de la izquierda", pinto(M.dom, "izquierda").hidden, true);
comp("y el de la derecha, que era la seleccion de barras",
  pinto(M.dom, "derecha").hidden, true);
const diseno = pinto(M.dom, "centro").innerHTML;
cierto("Conexiones dice QUE enseñará y que su motor está escrito",
  /placa/.test(diseno) && /conexiones\.js/.test(diseno));
cierto("no se pone una maqueta, y se dice por que",
  /Todavía no hay pantalla/.test(diseno) && /engaña más que una que avisa/.test(diseno));
cierto("y con tildes: el texto es para el proyectista, no para el compilador",
  !/Todavia no hay|ensenara|La hara |Ve a Geometria|ningun aviso/.test(modeHtml));
cierto("ya no queda ni una capa de barras a la vista",
  diseno.indexOf("data-capa=") < 0);

/* ───── CARGAS · su propio panel, y sin valores que nadie eligió ───── */
pulsa(M.dom, "pasos", "data-paso", "cargas");
comp("en Cargas va SU panel a la izquierda", pinto(M.dom, "lado-cargas").hidden, false);
comp("y no el de Geometría", [pinto(M.dom, "lado-ver").hidden, pinto(M.dom, "lado-parametros").hidden],
  [true, true]);
comp("ni panel derecho", pinto(M.dom, "derecha").hidden, true);
const fc = pinto(M.dom, "fc").innerHTML;
cierto("el formulario trae la cobertura, el viento, las aberturas y el acero",
  /ca_esp/.test(fc) && /ca_v"/.test(fc) && /ca_ab_izqDer/.test(fc) && /ca_acero/.test(fc));
cierto("las aberturas, una por dirección", /ca_ab_derIzq/.test(fc) && /ca_ab_longitudinal/.test(fc));
cierto("NINGÚN campo trae valor: todos empiezan en «— elegir —» o vacíos",
  !/selected/.test(fc) && !/<input[^>]*value="[^"]/.test(fc));
cierto("cada campo con norma lleva su botón de fuente", (fc.match(/data-fte=/g) || []).length >= 6);
const cg = pinto(M.dom, "centro").innerHTML;
cierto("vacío, la pantalla DICE qué falta en vez de inventarlo", /faltan \d+ dato/.test(cg));
cierto("y entre lo que falta, las aberturas por dirección", /aberturas para el viento/.test(cg));

/* ───── ANÁLISIS · sin datos dice qué falta y adónde ir ───── */
pulsa(M.dom, "pasos", "data-paso", "analisis");
comp("en Análisis va SU panel a la izquierda", pinto(M.dom, "lado-analisis").hidden, false);
comp("y panel derecho, sin la barra de cuatro vistas",
  [pinto(M.dom, "derecha").hidden, pinto(M.dom, "vistas").hidden], [false, true]);
cierto("el formulario pide la base y la unión, sin valor por omisión",
  /an_base/.test(pinto(M.dom, "fa").innerHTML) && /an_union/.test(pinto(M.dom, "fa").innerHTML) &&
  !/selected/.test(pinto(M.dom, "fa").innerHTML));
const an = pinto(M.dom, "centro").innerHTML;
cierto("sin datos no corre, y lo dice", /todavía no se puede correr/.test(an));
cierto("pide el sistema estructural", /sistema estructural/.test(an));
cierto("y manda a Cargas a por lo que falta allí", /data-ir="cargas"/.test(an));
cierto("guardar lleva el sitio y el sistema, que antes se perdían",
  /m\.sitio = modelo\.sitio/.test(modeHtml) && /m\.sistema = modelo\.sistema/.test(modeHtml));
cierto("y abrir los devuelve a los formularios", /ponSitioEnFormularios\(\)/.test(modeHtml));

/* ───── DISEÑO · su panel, y sin datos dice qué falta ───── */
pulsa(M.dom, "pasos", "data-paso", "diseno");
comp("en Diseño va SU panel a la izquierda", pinto(M.dom, "lado-diseno").hidden, false);
comp("con panel derecho, sin la barra de vistas",
  [pinto(M.dom, "derecha").hidden, pinto(M.dom, "vistas").hidden], [false, true]);
const fd = pinto(M.dom, "fd").innerHTML;
cierto("el formulario pide el arriostre de la brida inferior, los largueros, el Lb y el E5",
  /di_arrinf/.test(fd) && /di_larg/.test(fd) && /di_lb/.test(fd) && /di_e5/.test(fd));
cierto("NINGÚN dato de diseño trae valor", !/selected/.test(fd) && !/<input[^>]*value="[^"]/.test(fd));
cierto("la soldadura y los pernos solo salen según la unión", /data-solo="un=soldadas"/.test(fd) &&
  /data-solo="un=empernadas"/.test(fd));
cierto("sin datos no verifica, y lo dice", /todavía no se puede verificar/.test(pinto(M.dom, "centro").innerHTML));
cierto("guardar lleva los datos de diseño", /m\.diseno = modelo\.diseno/.test(modeHtml));

/* ───── CIMENTACIÓN · su panel, y sin datos dice qué falta ───── */
pulsa(M.dom, "pasos", "data-paso", "cimen");
comp("en Cimentación va SU panel a la izquierda", pinto(M.dom, "lado-cimen").hidden, false);
comp("y no el de Diseño", pinto(M.dom, "lado-diseno").hidden, true);
const fci = pinto(M.dom, "fci").innerHTML;
cierto("el formulario pide el suelo, el concreto y el pedestal",
  /ci_sigma/.test(fci) && /ci_neta/.test(fci) && /ci_fc/.test(fci) && /ci_grado/.test(fci) && /ci_pedb/.test(fci));
cierto("y el armado del pedestal, la placa, los pernos y la llave de corte",
  ["ci_pbarra", "ci_pest", "ci_prec", "ci_junta", "ci_plb", "ci_pln", "ci_plt", "ci_pf", "ci_pnf", "ci_psep",
    "ci_pd", "ci_pmat", "ci_pld", "ci_elec", "ci_lll", "ci_llh", "ci_llt", "ci_grout"].every((id) => fci.indexOf(id) >= 0));
cierto("NINGÚN dato de cimentación trae valor", !/selected/.test(fci) && !/<input[^>]*value="[^"]/.test(fci));
cierto("sin análisis no diseña, y manda al análisis",
  /todavía no se puede diseñar/.test(pinto(M.dom, "centro").innerHTML) &&
  /data-ir="analisis"/.test(pinto(M.dom, "centro").innerHTML));
cierto("guardar y abrir llevan la cimentación",
  /m\.cimentacion = modelo\.cimentacion/.test(modeHtml) && /modelo\.cimentacion = m\.cimentacion/.test(modeHtml));
cierto("y Comprobación oye a la zapata de LOS DOS pórticos",
  /avisosResultados\(analisisVigente\(p\), disenoVigente\(p\), cimenVigente\(p\)\)/.test(modeHtml) &&
  /RESULTADOS\.PORTICOS\.forEach/.test(modeHtml));
{
  /* EL SELECTOR DE PÓRTICO, en Análisis, Diseño y Cimentación */
  const sel = () => pinto(M.dom, "centro").innerHTML;
  for (const paso of ["analisis", "diseno", "cimen"]) {
    pulsa(M.dom, "pasos", "data-paso", paso);
    cierto(paso + ": el selector de pórtico está, con el interior marcado",
      /data-portico="interior" aria-pressed="true"/.test(sel()) && /data-portico="fachada" aria-pressed="false"/.test(sel()));
  }
  pulsa(M.dom, "centro", "data-portico", "fachada");
  cierto("al pulsar fachada, queda marcada y se mantiene al cambiar de paso",
    /data-portico="fachada" aria-pressed="true"/.test(sel()));
  pulsa(M.dom, "pasos", "data-paso", "analisis");
  cierto("(en Análisis también)", /data-portico="fachada" aria-pressed="true"/.test(sel()));
  pulsa(M.dom, "centro", "data-portico", "interior");
}

/* INICIO · un tablero de verdad, no una pestana vacia */
pulsa(M.dom, "pasos", "data-paso", "inicio");
const inicio = pinto(M.dom, "centro").innerHTML;
comp("Inicio tampoco ensena la barra de vistas", pinto(M.dom, "vistas").hidden, true);
comp("el tablero trae tres fichas", (inicio.match(/class="tarj/g) || []).length, 3);
cierto("con el galpon que hay ahora mismo", /1200 m²/.test(inicio));
cierto("los once pasos y cuantos estan listos",
  inicio.indexOf(M.win.VISTAS.PASOS.filter((p) => p.listo).length + " de 11") >= 0);
cierto("y el inventario entero, con el total que tiene HOY",
  inicio.indexOf(">" + INV.resumen().total + "<") >= 0 && /Sin fuente/.test(inicio));
cierto("con los pendientes NOMBRADOS, no contados",
  /MT\.alfa/.test(inicio) || /G\.peralte/.test(inicio));

/* COMPROBACION · la lista de avisos, y la insignia como en Reticula */
pulsa(M.dom, "pasos", "data-paso", "comprob");
const comprob = pinto(M.dom, "centro").innerHTML;
cierto("Comprobacion es una lista de avisos", /<ol class="avisos">/.test(comprob));
cierto("con mas de un aviso", (comprob.match(/<li class="/g) || []).length >= 3);
cierto("cada uno con su nivel a la vista",
  (comprob.match(/class="niv"/g) || []).length >= 3);
cierto("avisa de las clases sin perfil, que es lo que bloquea el analisis",
  /sin perfil asignado/.test(comprob));
cierto("y enumera cuales, en vez de decir «hay 10»",
  /class="cuales"/.test(comprob));
cierto("LLEVA AL PASO donde se arregla, no solo lo cuenta",
  /data-ir="geom"/.test(comprob));
const fteC = (comprob.match(/data-fte="([^"]+)"/g) || [])
  .map((x) => x.replace(/.*="|"$/g, ""));
cierto("y los avisos citan filas del inventario", fteC.length >= 2);
comp("todas existentes", fteC.filter((id) => !INV.existe(id)), []);
cierto("LA INSIGNIA sale en la propia pestana, como en Reticula",
  /class="ins"/.test(pinto(M.dom, "pasos").innerHTML));

/* ───── LOS ONCE, UNO POR UNO, CONTRA LO QUE EL MODULO DECLARA ─────
   Comprobar dos pasos de once no bastaba: ensenar SIEMPRE los parametros
   del tijeral pasaba la prueba, porque ninguno de los dos pasos que se
   miraban lo distinguia. Esto entra en los ONCE y compara los cuatro
   interruptores con armazon(), que es la propiedad de verdad y no una
   lista de casos. */
const mal = [];
for (const pp of M.win.VISTAS.PASOS) {
  pulsa(M.dom, "pasos", "data-paso", pp.id);
  const a = M.win.VISTAS.armazon(pp.id);
  const debe = {
    vistas: !a.vistas,
    metricas: !a.vistas,
    derecha: !a.derecha,
    izquierda: !a.lados.length,
    "lado-ver": a.lados.indexOf("ver") < 0,
    "lado-parametros": a.lados.indexOf("parametros") < 0,
    "lado-cargas": a.lados.indexOf("cargas") < 0,
    "lado-analisis": a.lados.indexOf("analisis") < 0,
    "lado-diseno": a.lados.indexOf("diseno") < 0,
    "lado-cimen": a.lados.indexOf("cimen") < 0
  };
  /* LA REJA. Ocultar los lados no basta: con tres columnas fijas el
     centro caia en la primera, la de 210 px, y todo salia apretado a la
     izquierda. Visto en Excel, no aqui: aqui el atributo estaba bien. */
  const cls = pinto(M.dom, "obra").className || "";
  if (/sin-izq/.test(cls) !== !a.lados.length) mal.push(pp.id + " · la reja no quita la columna izquierda");
  if (/sin-der/.test(cls) !== !a.derecha) mal.push(pp.id + " · la reja no quita la columna derecha");
  for (const id of Object.keys(debe)) {
    if (pinto(M.dom, id).hidden !== debe[id]) {
      mal.push(pp.id + " · " + id + " deberia estar " +
        (debe[id] ? "oculto" : "a la vista"));
    }
  }
}
comp("LOS ONCE PASOS montan exactamente el armazon que declaran", mal, []);

/* OCULTO ES OCULTO. El DOM de juguete no aplica CSS, y por eso esto paso:
   nav.vistas y .metricas llevan display:flex, que le gana al [hidden] del
   navegador. La barra de vistas se seguia viendo en Datos CON EL ATRIBUTO
   PUESTO. Lo unico que lo impide es esta regla, asi que se exige. */
cierto("hay una regla que hace que hidden oculte DE VERDAD",
  /\[hidden\]\s*\{\s*display:\s*none\s*!important;?\s*\}/.test(modeHtml));
cierto("y la reja tiene una forma para cada armazon",
  /\.obra\.sin-izq\s*\{/.test(modeHtml) && /\.obra\.sin-der\s*\{/.test(modeHtml) &&
  /\.obra\.sin-izq\.sin-der\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\);/.test(modeHtml));

/* ABRIR DIRECTAMENTE EN INICIO O EN COMPROBACION. El galpon solo se
   montaba al pasar por Geometria; abriendo en otro paso, Inicio decia «no
   hay geometria montada» con los parametros puestos y Comprobacion salia
   en blanco. Se carga la pagina OTRA VEZ empezando en cada uno. */
for (const [id, que, re] of [
  ["inicio", "el tablero trae el galpon", /1200 m²/],
  ["comprob", "la comprobacion trae sus avisos", /sin perfil asignado/],
  ["cargas", "el paso sin pantalla dice lo que hara", /E\.020/]
]) {
  const html = modeHtml.replace('var pasoActivo = "geom";', 'var pasoActivo = "' + id + '";');
  cierto("se puede arrancar en " + id, html !== modeHtml);
  const X = carga(html, true);
  cierto("arrancando en " + id + " la pagina no revienta" +
    (X.errApp ? ": " + X.errApp.message : ""), !X.errApp);
  cierto("arrancando en " + id + ", " + que + " sin pasar por Geometria",
    re.test(pinto(X.dom, "centro").innerHTML));
  cierto("y la insignia ya esta en la pestana",
    /class="ins"/.test(pinto(X.dom, "pasos").innerHTML));
}

/* y el boton de «ir a» vuelve a Geometria con su armazon entero */
pulsa(M.dom, "centro", "data-ir", "geom");
comp("volver a Geometria devuelve la barra de vistas",
  pinto(M.dom, "vistas").hidden, false);
comp("y el panel de la izquierda", pinto(M.dom, "izquierda").hidden, false);
cierto("y el galpon se vuelve a dibujar",
  /data-barra=/.test(pinto(M.dom, "centro").innerHTML));

/* EL CANAL */
cierto("el modelador pide el modelo al abrir", /a: "pide"/.test(modeHtml));
cierto("contesta por messageParent", /messageParent/.test(modeHtml));
cierto("y trocea lo que manda", /LIBRO\.troceaMensaje/.test(modeHtml));
cierto("escucha al panel por DialogParentMessageReceived",
  /DialogParentMessageReceived/.test(modeHtml));

/* ================================================================
   3 · EL MISMO GALPÓN EN LAS DOS Y EN NODE
   ================================================================ */
const D = {
  luz_m: 20, largo_m: 60, sepPorticos_m: 6, alturaColumna_m: 6,
  paneles: 6, peralteApoyo_m: 1.2, pendiente: 0.20,
  cuerdas: "dos_aguas", alma: "howe",
  panosArriostradosTecho: [5], panosArriostradosFachada: [5],
  columnasHastiales: [5, 10, 15]
};
const MON = require("../src/montaje.js");
const nav = M.win.MONTAJE.monta(D);
const nod = MON.monta(D);
comp("el modelador y Node dan el mismo conteo", nav.conteo, nod.conteo);
cerca("y el mismo metrado al milímetro",
  M.win.MONTAJE.metrado(nav).total_m, MON.metrado(nod).total_m, 1e-12);
comp("el inventario servido es el mismo", M.win.INVENTARIO.resumen(), INV.resumen());
comp("y el del panel también", P.win.INVENTARIO.resumen(), INV.resumen());
lanza("las guardas siguen negándose dentro del paquete horneado",
  () => M.win.MONTAJE.monta(Object.assign({}, D, { panosArriostradosTecho: [] })),
  "NO HAY ARRIOSTRE DE TECHO");

/* ================================================================
   4 · EL MANIFIESTO
   ================================================================ */
const man = leer("manifest.xml");
cierto("es XML y lo declara", /^<\?xml version="1\.0" encoding="UTF-8"\?>/.test(man));
cierto("es un panel de tareas de Excel",
  /xsi:type="TaskPaneApp"/.test(man) && /<Host Name="Workbook"\/>/.test(man));
cierto("APUNTA AL PANEL, no al modelador: el modelador lo abre el panel",
  /SourceLocation DefaultValue="[^"]*\/panel\.html"/.test(man));
cierto("PIDE DialogApi 1.2, sin el cual no puede contestarle a la ventana",
  /<Set Name="DialogApi" MinVersion="1\.2"\/>/.test(man));
cierto("y explica para qué en un comentario", /messageChild/.test(man));
const guid = /<Id>([^<]+)<\/Id>/.exec(man)[1];
cierto("el Id es un GUID bien formado",
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(guid));
const urls = (man.match(/DefaultValue="(https?:[^"]+)"/g) || [])
  .map((s) => s.replace(/.*="|"$/g, ""));
comp("todas las URL son https y van al sitio",
  urls.filter((u) => u.indexOf("https://vicmezap.github.io/galpon") !== 0), []);
cierto("añade la pestaña Galpón en la cinta",
  /<CustomTab id="mezap\.galpon\.tab">/.test(man));
for (const n of [16, 32, 80]) {
  const b = fs.readFileSync(path.join(DIR, "icono-" + n + ".png"));
  comp("icono-" + n + ".png mide " + n + " px", b.readUInt32BE(16), n);
}

/* ================================================================
   5 · LA PORTADA Y EL GENERADOR
   ================================================================ */
const portada = leer("index.html");
cierto("la portada enlaza el modelador", /href="modelador\.html"/.test(portada));
cierto("y el manifiesto con las instrucciones", /href="manifest\.xml"/.test(portada));
cierto("y dice cuántas filas tiene el inventario, contadas y no a dedo",
  portada.indexOf(INV.resumen().total + " filas") >= 0);

const gen = fs.readFileSync(path.join(__dirname, "..", "scripts",
  "gen_complemento.py"), "utf8");
const saca = (rx) => (gen.match(rx) || [])
  .map((s) => (/"([a-z0-9_]+\.js)"/.exec(s) || [])[1]).filter(Boolean);
const enLista = saca(/^[ \t]*"[a-z0-9_]+\.js",/gm);
const enFuera = saca(/^[ \t]*"[a-z0-9_]+\.js":/gm);
const enSrc = fs.readdirSync(path.join(__dirname, "..", "src"))
  .filter((f) => f.endsWith(".js"));
comp("todo módulo de src/ está en la lista o declarado fuera con su motivo",
  enSrc.filter((f) => enLista.indexOf(f) < 0 && enFuera.indexOf(f) < 0), []);
comp("el único que se queda fuera es la guarda de Node", enFuera, ["bundle.js"]);
cierto("el panel se hornea con una lista corta y propia",
  /MODULOS_PANEL = \["inventario\.js", "libro\.js", "panel\.js"\]/.test(gen));

fin();
