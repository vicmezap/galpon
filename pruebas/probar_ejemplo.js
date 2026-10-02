/* =====================================================================
   probar_ejemplo.js — el proyecto de muestra · fila V.ejemplo

   El ejemplo existe para probar las hojas de una vez, así que tiene que
   estar COMPLETO de verdad: los ocho pasos, todas las barras cumpliendo,
   y la hoja CARGAS con cada fórmula igual al motor.  Si un cambio del
   motor lo rompe, que salte aquí y no en la cara del usuario.
   ===================================================================== */
"use strict";

const { comp, cierto, fin } = require("./_comun.js");
const EJ = require("../src/ejemplo.js");
const R = require("../src/resultados.js");
const P = require("../src/perfiles.js");
const L = require("../src/libro.js");
const H = require("../src/hojas.js");
const MON = require("../src/montaje.js");
const INV = require("../src/inventario.js");

comp("la fila que cita existe", Object.keys(EJ.ART).filter((id) => !INV.existe(id)), []);
const m = EJ.modelo();
cierto("es un modelo que el libro guarda y vuelve a leer idéntico",
  JSON.stringify(L.deserializa(L.serializa(m, "2026-10-02T00:00:00Z")).modelo.sitio) === JSON.stringify(m.sitio));
cierto("cada vez uno nuevo: tocar uno no ensucia el siguiente", (() => { const a = EJ.modelo(); a.sitio.V_kmh = 1; return EJ.modelo().sitio.V_kmh === 75; })());
const m3 = MON.monta(m.parametros);
comp("con perfil en las doce clases", require("../src/vistas.js").tablaPerfiles(m3, m).sinPerfil, 0);
const ai = R.analisis(m3, m, P, "interior"), af = R.analisis(m3, m, P, "fachada");
comp("los ocho pasos, completos", R.pendientes({ m3: m3, modelo: m, perfiles: P, analisis: ai }).filter((x) => !x.completo)
  .map((x) => x.paso), []);
for (const [p, a] of [["interior", ai], ["fachada", af]]) {
  const d = R.diseno(m3, m, P, a, p);
  comp("pórtico " + p + ": todas las barras cumplen", d.v.resumen.cumplen, d.v.resumen.total);
  comp("y sus uniones", R.conexiones(m3, m, P, a, p).cumple, true);
}
const lo = R.longitudinal(m3, m, P, ai, af);
comp("lo que trabaja a lo largo, todo cumple", lo.diseno.piezas.filter((x) => !x.cumple).map((x) => x.pieza || x.nombre), []);
comp("las correas cumplen, sin avisos", [R.correas(m3, m, P, ai, af).cumple, R.avisosCorreas(R.correas(m3, m, P, ai, af)).length], [true, 0]);
comp("las cuatro zapatas cumplen", R.TIPOS_ZAPATA.map((t) => { const c = R.cimentacion(m3, m, P, null, t); return c.ok && c.z.cumple; }),
  [true, true, true, true]);
const h = H.hojaCargas({ cargas: R.cargas(m3, m.sitio), sitio: m.sitio, proyecto: m.proyecto, interior: ai.r, fachada: af.r });
cierto("la hoja CARGAS, con el cortante de los dos pórticos y cada fórmula igual al motor",
  h.comprobacion.ok && h.comprobacion.comprobadas > 130 && !!h.nombres.V_i && !!h.nombres.V_f);

fin();
