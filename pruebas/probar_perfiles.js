/* =====================================================================
   probar_perfiles.js — LA PRUEBA DE ORO

   Las siete relaciones de autoverificación (fila CAT.soldados.prueba) se
   corren sobre el catálogo ENTERO, perfil por perfil.  Si cuadran:

     · el parseo del .xls está bien
     · la conversión de unidades está bien
     · y la tabla está bien transcrita

   Tres certezas de un tiro, sin intervención humana, sobre 1500 filas que
   nadie ha mirado a mano.

   Lo que la prueba NO tolera: una columna del catálogo que desaparezca sin
   que nadie se entere.  `_desconocidas` tiene que venir vacía.
   ===================================================================== */
"use strict";
const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const P = require("../src/perfiles.js");
const PR = require("../src/propiedades.js");

const r = P.resumen();

/* ---------- el catálogo cargó ----------------------------------------- */
cierto("hay más de 2400 perfiles", r.total > 2400);
comp("las diecisiete familias: siete del AISC, tres soldadas, ocho Precor y las varillas",
  P.familias(),
  ["2L", "C", "CS", "CVS", "HSS_rect", "HSS_red", "I", "IC", "IU", "L",
   "T", "TC", "TU", "U", "VAR", "VS", "Z"]);
comp("los cuatro catalogos", Object.keys(P.resumen().porCatalogo).sort(),
  ["AISC Shapes Database v13", "FAM Perfis Soldados (ABNT NBR 5884)",
   "Precor · perfiles conformados en frio", "Varillas lisas (geometría del círculo)"]);

/* ---------- LAS VARILLAS · fila CAT.varillas: geometría del círculo ---------- */
{
  const v = P.busca("VAR5/8"), d = 5 / 8 * 2.54;
  cerca("VAR5/8 · A = π·d²/4", v.A_cm2, Math.PI * d * d / 4, 1e-12);
  cerca("r = d/4", v.ry_cm, d / 4, 1e-12);
  cerca("Z = d³/6 (el plástico del círculo)", v.Zx_cm3, d * d * d / 6, 1e-12);
  cerca("y su peso con 7850 kgf/m³", v.peso_kgfm, Math.PI * d * d / 4 / 1e4 * 7850, 1e-12);
  comp("ocho diámetros, de 3/8\" a 1 1/4\"", P.catalogo().filter((x) => x.familia === "VAR").map((x) => x.nombre),
    ["VAR3/8", "VAR1/2", "VAR5/8", "VAR3/4", "VAR7/8", "VAR1", "VAR1-1/8", "VAR1-1/4"]);
}

/* LA LETRA DE FAMILIA CHOCA ENTRE CATALOGOS · «C» es un canal laminado del
   AISC y tambien un canal de alas atiesadas de Precor, que es otra seccion;
   «L» son angulos laminados y conformados.  Se fija la lista: si manana
   entra un catalogo que choca en una tercera letra, esta prueba lo dice. */
comp("las dos letras en conflicto, y solo esas",
  P.familiasEnConflicto().map((x) => x.familia + ":" + x.fabricaciones.join("+")),
  ["C:frio+laminado", "L:frio+laminado"]);
cierto("y el grupo si es univoco",
  P.grupos().length === new Set(P.grupos()).size &&
  P.grupos().indexOf("laminado:C") >= 0 && P.grupos().indexOf("frio:C") >= 0);
comp("pedir el grupo no mezcla fabricaciones",
  new Set(P.catalogo("frio:C").map((x) => x.fabricacion)).size, 1);
cierto("y pedir la letra sola si las mezcla, a proposito",
  P.catalogo("C").length === P.catalogo("frio:C").length + P.catalogo("laminado:C").length);

/* ---------- los 442 conformados en frio, en espera --------------------- */
/* Entran HOY al catalogo y NO se pueden calcular: los gobierna la AISI S100,
   que es la fase 2.  Que se vean es la decision; que no se calculen es la
   guarda.  Las dos se prueban. */
comp("442 perfiles Precor, todos en espera", r.espera, 442);
comp("y ningun otro lo esta", P.catalogo().filter((x) => x.estado === "espera").length, 442);
comp("todos gobernados por la AISI",
  new Set(P.catalogo().filter((x) => x.estado === "espera").map((x) => x.espec)).size, 1);
lanza("calcular con uno PARA en vez de dar un numero sin norma",
  () => P.paraCalcular('L 4"x3" x4.5'), "está en espera");
cierto("pero consultarlo se puede", P.busca('L 4"x3" x4.5').Ix_cm4 > 0);
/* Contraste directo contra la tabla de Precor, dos filas leidas a mano. */
cerca("Precor L 4\"x3\" x4.5 - A", P.busca('L 4"x3" x4.5').A_cm2, 7.67, 1e-3);
cerca("Precor L 4\"x3\" x4.5 - Ix", P.busca('L 4"x3" x4.5').Ix_cm4, 82.8, 1e-3);
cerca("Precor U 12\"x3\" x4.5 - Ix", P.busca('U 12"x3" x4.5').Ix_cm4, 2457, 1e-3);
cerca("Precor IU 12\"x4\" x4.5 - peso", P.busca('IU 12"x4" x4.5').peso_kgfm, 27.67, 1e-3);
/* El nombre de un conformado SI es clave unica: designacion mas espesor.
   Que se repitiera fue el fallo que tuvo la importacion, y lo vigila tanto
   el importador como esto. */
const frios = P.catalogo().filter((x) => x.fabricacion === "frio");
comp("ninguna designacion Precor repetida",
  frios.length - new Set(frios.map((x) => x.nombre)).size, 0);
cierto("ninguna se llama como la cabecera de la tabla",
  !frios.some((x) => /Designaci/.test(x.nombre)));

/* ---------- ninguna columna se perdió en silencio ---------------------- */
const perdidas = P.avisos.filter((a) => a.columnas);
if (perdidas.length) {
  const cols = new Set();
  for (const a of perdidas) a.columnas.forEach((c) => cols.add(c));
  comp("ninguna columna del catálogo quedó sin mapear",
    Array.from(cols).sort(), []);
} else {
  comp("ninguna columna del catálogo quedó sin mapear", [], []);
}
/* LA DESIGNACIÓN NO ES CLAVE ÚNICA · fila CAT.nombre.noUnico.
   VS400x32 nombra dos secciones distintas: 400 mm y ~32 kg/m se consiguen
   con ala de 8×140 y también con 6,3×180. Se fija por nombre: si aparece
   otra colisión, esta prueba lo dice. */
comp("una sola designación ambigua, la conocida",
  P.ambiguas().map((a) => a.nombre), ["VS400x32"]);
lanza("y buscarla por designación PARA en vez de elegir por su cuenta",
  () => P.busca("VS400x32"), "designa 2 secciones distintas");
cierto("por id sí se resuelve, y son distintas",
  P.busca("VS400x32·bf140").bf_cm !== P.busca("VS400x32·bf180").bf_cm);

/* ---------- integridad del catálogo de origen -------------------------
   AISC §B4.2: el espesor de diseño de un HSS es 0,93 del nominal, luego
   tnom/tdes = 1,0753 en toda fila sana.  CINCO no lo cumplen, y son datos
   mal escritos en el .xls del AISC, no en nuestro importador.  Se fijan
   por nombre a propósito: si mañana aparece una sexta, esta prueba lo
   dice en vez de dejarla pasar. */
const KNOWN_ESPESOR_MALO = [
  "HSS16X8X5/8",        /* t(nom) = 0,3125 cuando el perfil es de 5/8"; t(des) sí es 0,581 */
  "HSS3X1-1/2X1/8",
  "HSS8.625X0.322",
  "HSS6.625X0.432",
  "HSS3.500X0.188"
];
const espesorMalo = P.avisos.filter((a) => a.espesorInconsistente).map((a) => a.perfil).sort();
comp("exactamente las cinco filas de espesor inconsistente conocidas",
  espesorMalo, KNOWN_ESPESOR_MALO.slice().sort());
cierto("y el peso de la peor sigue cuadrando, porque el área SÍ es correcta",
  PR.verifica(P.busca("HSS16X8X5/8")).length === 0);

/* ---------- LAS SIETE RELACIONES SOBRE TODO EL CATÁLOGO ---------------- */
/* Solo sobre las familias donde las relaciones tienen sentido: en un
   ángulo simple Sx no es 2·Ix/d porque no hay doble simetría, y el propio
   verifica() lo respeta con el indicador simetriaDoble. */
/* verifica() ya sabe qué relación aplica a qué familia: se le pasa el
   perfil tal cual y él decide. Que el módulo lo sepa y no la prueba es lo
   correcto — si lo supiera solo la prueba, cualquier otro sitio del
   proyecto podría aplicar Cw = Iy·ho²/4 a un canal sin que nadie avisara. */
let revisados = 0;
const fallan = [];
for (const p of P.catalogo()) {
  const f = PR.verifica(p);
  revisados++;
  if (f.length) fallan.push(p.nombre + " · " + f.join(" | "));
}

cierto("se revisaron más de 2400 perfiles", revisados > 2400);

/* El informe completo si algo falla: sin él, saber que «falló uno» no
   sirve de nada sobre mil quinientas filas. */
if (fallan.length) {
  console.log("");
  console.log("  perfiles que no pasan las relaciones (" + fallan.length + " de " + revisados + "):");
  fallan.slice(0, 25).forEach((x) => console.log("    " + x));
  if (fallan.length > 25) console.log("    … y " + (fallan.length - 25) + " más");
}
comp("TODO el catálogo pasa las siete relaciones", fallan.length, 0);

/* ---------- perfiles concretos, contra la tabla ------------------------ */
const W = P.busca("W12X26");
cerca("W12X26 · A", W.A_cm2, 49.354, 1e-3);
cerca("W12X26 · Ix", W.Ix_cm4, 8491, 1e-3);
cerca("W12X26 · peso", W.peso_kgfm, 38.69, 2e-3);
comp("y viene del catálogo AISC", W.catalogo, "AISC Shapes Database v13");
comp("marcado como laminado", W.fabricacion, "laminado");
comp("gobernado por el AISC 360", W.espec, "AISC360");
comp("y activo", W.estado, "activo");

/* Un ángulo: tiene x(bar), que es lo que dobleAngulo() necesita. */
const L = P.busca("L4X4X1/2");
cierto("un ángulo trae xbar", L.xbar_cm > 0);
cierto("y su radio principal menor rz", L.rz_cm > 0);
cierto("rz es el menor de los tres radios", L.rz_cm < L.rx_cm && L.rz_cm < L.ry_cm);

/* ---------- el catálogo alimenta la calculadora ------------------------ */
/* Se toma un ángulo real del catálogo y se emparejan dos con la separación
   de una cartela de 8 mm, que NO está tabulada. */
const par = PR.dobleAngulo({ angulo: L, sep_cm: 0.8 });
/* rx del par se compara contra el rx CALCULADO del ángulo suelto, no contra
   el tabulado: emparejar duplica Ix y A, así que la raíz es idéntica bit a
   bit. Contra el tabulado la diferencia sería el 0,3 % de redondeo de la
   tabla y estaríamos midiendo otra cosa. */
cerca("2L desde el catálogo · rx no cambia al emparejar",
  par.rx_cm, Math.sqrt(L.Ix_cm4 / L.A_cm2), 1e-12);
cerca("y coincide con el rx tabulado, dentro del redondeo del catálogo",
  par.rx_cm, L.rx_cm, PR.TOL_CATALOGO);
cierto("ry sale mayor que rx", par.ry_cm > par.rx_cm);

/* Y se contrasta contra la fila 2L que el AISC SÍ tabula, con separación
   3/8" = 0,9525 cm: tienen que coincidir. Es la validación cruzada entre
   nuestra calculadora y la tabla del AISC. */
const L3 = P.busca("L4X4X1/2");
const parAISC = PR.dobleAngulo({ angulo: L3, sep_cm: 0.9525 });
const tabla2L = P.catalogo("2L").find((x) => x.nombre === "2L4X4X1/2");
if (tabla2L && tabla2L.ry_sep38_cm) {
  cerca("nuestro 2L cuadra con el ry(3/8) tabulado del AISC",
    parAISC.ry_cm, tabla2L.ry_sep38_cm, 0.02);
} else {
  cierto("(no está el 2L4X4X1/2 en la tabla, se omite el contraste)", true);
}

/* ---------- lo que tiene que parar ------------------------------------- */
lanza("un perfil inexistente para",
  () => P.busca("W99X999"), "no está en el catálogo");

fin();
