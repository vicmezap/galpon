/* =====================================================================
   probar_unidades.js

   La conversión es donde se pierden los proyectos.  Se prueba de tres
   maneras, y la tercera es la que de verdad importa:

     1) contra los factores exactos por definición (la pulgada son 25,4 mm)
     2) ida y vuelta: convertir y desconvertir tiene que devolver el número
     3) POR INVARIANTE: una relación geométrica que se cumple en cualquier
        sistema de unidades tiene que seguir cumpliéndose después de
        convertir.  rx = √(Ix/A) es cierta en pulgadas y en centímetros.
        Si al convertir se usa la potencia equivocada, esa igualdad se
        rompe — y es justo el error que nadie ve leyendo el número.
   ===================================================================== */
"use strict";
const { comp, cerca, cierto, fin } = require("./_comun.js");
const U = require("../src/unidades.js");

/* ---------- 1 · factores exactos -------------------------------------- */
comp("la pulgada son 2,54 cm exactos", U.PULGADA_CM, 2.54);
comp("la libra son 0,45359237 kgf exactos", U.LIBRA_KGF, 0.45359237);
cerca("1 ksi = 70,307 kg/cm²", U.KSI_KGCM2, 70.3069, 1e-5);
cerca("1 MPa = 10,1972 kg/cm²", U.MPA_KGCM2, 10.19716, 1e-5);

/* El módulo de elasticidad: la fila MAT.E del inventario dice 2 039 000
   kg/cm², que sale de los 29 000 ksi del AISC. Se comprueba la cadena. */
cerca("29 000 ksi son ~2 039 000 kg/cm²", U.ksi_a_kgcm2(29000), 2038900, 2e-4);
cerca("200 000 MPa dan lo mismo", U.mpa_a_kgcm2(200000), 2039432, 1e-4);

/* ---------- 2 · ida y vuelta ------------------------------------------ */
const ida = [
  ["longitud", U.in_a_cm, U.cm_a_in, 12.2],
  ["esfuerzo", U.ksi_a_kgcm2, U.kgcm2_a_ksi, 36],
  ["fuerza", U.kip_a_kgf, (v) => v / U.KIP_KGF, 44],
  ["velocidad", U.kmh_a_ms, U.ms_a_kmh, 75]
];
for (const [nombre, a, b, v] of ida) cerca("ida y vuelta · " + nombre, b(a(v)), v, 1e-12);

/* ---------- 3 · invariantes geométricas ------------------------------- */
/* W12X26 del AISCProp13, en unidades imperiales tal como vienen. */
const W12X26 = {
  Shape: "W12X26", "A": 7.65, "d": 12.2, "tw": 0.230, "bf": 6.49, "tf": 0.380,
  "Ix": 204, "Sx": 33.4, "Zx": 37.2, "rx": 5.17,
  "Iy": 17.3, "Sy": 5.34, "Zy": 8.17, "ry": 1.51,
  "J": 0.300, "Cw": 607, "wt./ft.": 26.0
};

const m = U.importaAISC(W12X26);

comp("el perfil conserva su nombre", m.nombre, "W12X26");
comp("y queda marcado como convertido", m.origen, "imperial");

/* LA PRUEBA DE ORO, en dos partes.

   PARTE A · la conversión NO puede alterar una relación geométrica.
   Se calcula el invariante en imperial, se convierte el resultado, y se
   compara con el invariante calculado sobre los valores ya convertidos.
   Esto aísla mi conversión del redondeo del catálogo: si in² llevara 2,54
   en vez de 2,54², la diferencia sería de un factor 2,54, no de un 0,4 %.
   Tolerancia de máquina. */
cerca("la conversión conserva √(Ix/A)",
  U.in_a_cm(Math.sqrt(W12X26.Ix / W12X26.A)),
  Math.sqrt(m.Ix_cm4 / m.A_cm2), 1e-12);
cerca("la conversión conserva √(Iy/A)",
  U.in_a_cm(Math.sqrt(W12X26.Iy / W12X26.A)),
  Math.sqrt(m.Iy_cm4 / m.A_cm2), 1e-12);
cerca("la conversión conserva 2·Ix/d",
  U.in3_a_cm3(2 * W12X26.Ix / W12X26.d),
  2 * m.Ix_cm4 / m.d_cm, 1e-12);

/* PARTE B · el invariante contra el valor TABULADO.
   Aquí la tolerancia no la pone el cálculo: la pone el catálogo, que
   publica tres cifras significativas.  √(17,3/7,65) da 1,5038 y la tabla
   dice 1,51 — un 0,4 % que es redondeo de la fuente, no error nuestro.
   Se comprueba igual, con la tolerancia que el dato permite, porque sirve
   para cazar una columna mal leída al digitalizar. */
const TOL_CATALOGO = 6e-3;
cerca("rx tabulado cuadra con √(Ix/A) · imperial",
  Math.sqrt(W12X26.Ix / W12X26.A), W12X26.rx, TOL_CATALOGO);
cerca("rx tabulado cuadra con √(Ix/A) · métrico",
  Math.sqrt(m.Ix_cm4 / m.A_cm2), m.rx_cm, TOL_CATALOGO);
cerca("ry tabulado cuadra con √(Iy/A) · métrico",
  Math.sqrt(m.Iy_cm4 / m.A_cm2), m.ry_cm, TOL_CATALOGO);
cerca("Sx tabulado cuadra con 2·Ix/d · métrico",
  2 * m.Ix_cm4 / m.d_cm, m.Sx_cm3, TOL_CATALOGO);

/* El peso propio contra el área por el peso específico del acero.
   Fila D.acero.gamma del inventario: 7850 kgf/m³ = 7,85e-3 kgf/cm³ */
cerca("el peso por metro cuadra con A × 7850 kgf/m³",
  m.A_cm2 * 7.85e-3 * 100, m.peso_kgfm, 2e-2);

/* Magnitudes concretas, por si alguien cambia un factor sin querer. */
cerca("A: 7,65 in² son 49,35 cm²", m.A_cm2, 49.354, 1e-4);
cerca("d: 12,2 in son 30,99 cm", m.d_cm, 30.988, 1e-4);
cerca("Ix: 204 in⁴ son 8491 cm⁴", m.Ix_cm4, 8491.4, 1e-4);
cerca("Cw: 607 in⁶ son 1,631e8 cm⁶", m.Cw_cm6, 607 * Math.pow(2.54, 6), 1e-9);

/* ---------- la guarda de nombres -------------------------------------- */
comp("un perfil importado lleva la unidad en todas sus claves",
  U.revisaNombres(m), []);
comp("y detecta una clave sin unidad",
  U.revisaNombres({ A_cm2: 1, peralte: 2 }), ["peralte"]);

/* Un perfil métrico no se toca, solo se marca. */
const p = U.importaMetrico({ nombre: "C 6\"x2\"", A_cm2: 10.76, Ix_cm4: 345.9 });
comp("el perfil métrico queda marcado", p.origen, "metrico");
comp("y conserva su área sin convertir", p.A_cm2, 10.76);

fin();
