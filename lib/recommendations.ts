/**
 * lib/recommendations.ts — Motor de recomendaciones personalizadas (COMPARTIDO Web + Móvil).
 *
 *   · TypeScript puro: solo importa de ../lib/energyCalculations y tipos de ../types/database.
 *   · Entrada: aparatos, hábitos registrados, tarifa y factor de CO2.
 *   · Salida: lista ordenada por ahorro económico mensual, cada una con kWh, $ y CO2 estimados.
 *
 * Los porcentajes de ahorro son estimaciones conservadoras de referencia
 * (CONUEE / FIDE / fichas técnicas típicas). Ajusta REDUCTION_FACTORS si tu equipo
 * define otros valores; web y móvil cambian a la vez porque comparten este archivo.
 */
import {
  DEFAULT_CO2_KG_PER_KWH,
  WEEKS_PER_MONTH,
  habitWeeklyKwh,
  round,
  totalWeeklyKwh,
  weeklyKwh,
} from "./energyCalculations";
import type { AccountType, Appliance, DateString, HabitLog } from "../types/database";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
export type RecommendationPriority = "alta" | "media" | "baja";
export type RecommendationSource = "aparato" | "habito" | "general";
export type RecommendationEffort = "sin_costo" | "bajo_costo" | "inversion";

export interface RecommendationSavings {
  kwhMonth: number;
  costMonth: number;
  co2MonthKg: number;
  /** Porcentaje del consumo mensual total que representa este ahorro. */
  pctOfTotal: number;
}

export interface Recommendation {
  /** Estable: sirve como key en listas y para no repetir recomendaciones. */
  id: string;
  title: string;
  description: string;
  actions: string[];
  source: RecommendationSource;
  priority: RecommendationPriority;
  effort: RecommendationEffort;
  categorySlug: string | null;
  applianceId: string | null;
  savings: RecommendationSavings;
}

export interface RecommendationInput {
  appliances: Appliance[];
  habits?: HabitLog[];
  tariffPerKwh: number;
  co2KgPerKwh?: number;
  accountType?: AccountType;
  /** Si se indica, solo se consideran hábitos de los últimos `habitWindowDays` días. */
  today?: DateString;
  habitWindowDays?: number;
  /** Máximo de recomendaciones a devolver (por defecto 10). */
  limit?: number;
}

export const EFFORT_LABELS: Record<RecommendationEffort, string> = {
  sin_costo: "Sin costo",
  bajo_costo: "Bajo costo",
  inversion: "Requiere inversión",
};

export const PRIORITY_LABELS: Record<RecommendationPriority, string> = {
  alta: "Prioridad alta",
  media: "Prioridad media",
  baja: "Prioridad baja",
};

/** Reducciones estimadas usadas por las reglas (fracción del consumo del aparato). */
export const REDUCTION_FACTORS = {
  thermostat2Degrees: 0.14, // subir 2 °C el termostato del aire acondicionado
  inverterUpgrade: 0.3, // minisplit convencional → inverter
  fridgeReplacement: 0.4, // refrigerador de +10 años → eficiente
  fridgeMaintenance: 0.1, // empaques, ubicación, termostato
  displayCaseNightCover: 0.15, // cortinas nocturnas / ajuste de termostato en exhibidor
  kitchenHighPower: 0.25, // usar menos aparatos de cocina de alta potencia
  dryerSunDrying: 0.5, // tender al sol la mitad de las cargas
  computerSleepMode: 0.15, // suspensión automática
  ledFromIncandescent: 0.85, // 60 W → 9 W
  ledFromFluorescent: 0.5, // 20 W → 9–10 W
} as const;

// ---------------------------------------------------------------------------
// Utilidades internas
// ---------------------------------------------------------------------------
function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function has(name: string, ...words: string[]) {
  const n = normalize(name);
  return words.some((w) => n.includes(w));
}

function daysBetween(from: DateString, to: DateString) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

interface Ctx {
  tariff: number;
  co2: number;
  totalMonthKwh: number;
}

function savingsFromWeekly(weeklyKwhSaved: number, ctx: Ctx): RecommendationSavings {
  const kwhMonth = Math.max(weeklyKwhSaved, 0) * WEEKS_PER_MONTH;
  return {
    kwhMonth: round(kwhMonth, 3),
    costMonth: round(kwhMonth * ctx.tariff, 2),
    co2MonthKg: round(kwhMonth * ctx.co2, 3),
    pctOfTotal: ctx.totalMonthKwh > 0 ? round((kwhMonth / ctx.totalMonthKwh) * 100, 1) : 0,
  };
}

function priorityFor(s: RecommendationSavings): RecommendationPriority {
  if (s.pctOfTotal >= 10 || s.costMonth >= 100) return "alta";
  if (s.pctOfTotal >= 3 || s.costMonth >= 25) return "media";
  return "baja";
}

/** kWh/semana que se ahorran quitando `hours` horas diarias de uso a un aparato. */
function weeklyForHours(a: Appliance, hours: number) {
  return weeklyKwh({ ...a, hours_per_day: Math.min(hours, a.hours_per_day) });
}

type Draft = Omit<Recommendation, "priority" | "savings"> & { weeklyKwhSaved: number };

// ---------------------------------------------------------------------------
// Reglas por aparato
// ---------------------------------------------------------------------------
function applianceRules(a: Appliance, accountType: AccountType | undefined): Draft[] {
  const out: Draft[] = [];
  const base = { source: "aparato" as const, categorySlug: a.category_slug, applianceId: a.id };
  const weekly = weeklyKwh(a);
  const perUnitW = a.watts;
  if (weekly <= 0) return out;

  switch (a.category_slug) {
    case "iluminacion": {
      if (perUnitW >= 40) {
        out.push({
          ...base,
          id: `led-${a.id}`,
          title: `Cambia ${a.name} por focos LED`,
          description: `Un foco LED de 9 W ilumina igual que uno incandescente de 60 W y dura hasta 15 veces más.`,
          actions: [`Sustituye ${a.quantity > 1 ? `los ${a.quantity} focos` : "el foco"} por LED de luz equivalente.`, "Busca el sello FIDE en el empaque."],
          effort: "bajo_costo",
          weeklyKwhSaved: weekly * REDUCTION_FACTORS.ledFromIncandescent,
        });
      } else if (perUnitW >= 15) {
        out.push({
          ...base,
          id: `led-${a.id}`,
          title: `Pasa ${a.name} a tecnología LED`,
          description: "Los focos ahorradores (fluorescentes) consumen el doble que un LED equivalente.",
          actions: ["Cuando se fundan, reemplázalos por LED.", "Elige luz cálida (2700–3000 K) para recámaras."],
          effort: "bajo_costo",
          weeklyKwhSaved: weekly * REDUCTION_FACTORS.ledFromFluorescent,
        });
      }
      if (a.hours_per_day >= 6) {
        out.push({
          ...base,
          id: `luz-horas-${a.id}`,
          title: `Reduce 1 hora diaria de ${a.name}`,
          description: `Lo registraste ${a.hours_per_day} h al día. Aprovecha la luz natural y apaga al salir.`,
          actions: ["Abre cortinas durante el día.", "Usa sensores de movimiento en pasillos y baños."],
          effort: "sin_costo",
          weeklyKwhSaved: weeklyForHours(a, 1),
        });
      }
      break;
    }

    case "climatizacion": {
      const isAC = has(a.name, "minisplit", "aire", "clima", "a/c") || perUnitW >= 700;
      const isHeater = has(a.name, "calefactor", "calentador");
      if (isAC && !isHeater) {
        out.push({
          ...base,
          id: `termostato-${a.id}`,
          title: `Programa ${a.name} a 24–25 °C`,
          description: "Cada grado más frío aumenta el consumo cerca de 7 %. Subir 2 °C ahorra alrededor de 14 %.",
          actions: ["Ajusta el termostato a 24–25 °C.", "Limpia los filtros cada mes.", "Cierra puertas y cortinas mientras enfría."],
          effort: "sin_costo",
          weeklyKwhSaved: weekly * REDUCTION_FACTORS.thermostat2Degrees,
        });
        if (a.hours_per_day >= 2) {
          out.push({
            ...base,
            id: `clima-horas-${a.id}`,
            title: `Usa ${a.name} 1 hora menos al día`,
            description: "Combínalo con ventilador: un ventilador consume hasta 15 veces menos que un aire acondicionado.",
            actions: ["Usa el temporizador para que se apague de madrugada.", "Enciende primero el ventilador."],
            effort: "sin_costo",
            weeklyKwhSaved: weeklyForHours(a, 1),
          });
        }
        if (perUnitW >= 1000 && !has(a.name, "inverter")) {
          out.push({
            ...base,
            id: `inverter-${a.id}`,
            title: `Considera un equipo inverter en lugar de ${a.name}`,
            description: "Los minisplits inverter regulan su velocidad y consumen alrededor de 30 % menos.",
            actions: ["Compara el consumo anual (kWh) en la etiqueta de eficiencia.", "Revisa programas de financiamiento FIDE."],
            effort: "inversion",
            weeklyKwhSaved: weekly * REDUCTION_FACTORS.inverterUpgrade,
          });
        }
      } else if (isHeater && a.hours_per_day >= 1) {
        out.push({
          ...base,
          id: `calefactor-${a.id}`,
          title: `Reduce 1 hora el uso de ${a.name}`,
          description: "Los calefactores eléctricos son de los aparatos que más consumen en el hogar.",
          actions: ["Cierra ventanas y puertas.", "Úsalo solo en la habitación ocupada."],
          effort: "sin_costo",
          weeklyKwhSaved: weeklyForHours(a, 1),
        });
      }
      break;
    }

    case "refrigeracion": {
      const isDisplay = has(a.name, "exhibidor", "vitrina");
      const isOld = has(a.name, "antiguo", "viejo", "+10") || (has(a.name, "refri") && perUnitW >= 220);
      if (isDisplay) {
        out.push({
          ...base,
          id: `exhibidor-${a.id}`,
          title: `Ahorra en ${a.name} fuera del horario de venta`,
          description: "Cubrir el exhibidor por la noche y ajustar su termostato reduce cerca de 15 % su consumo.",
          actions: ["Usa cortina nocturna o apaga la iluminación interior al cerrar.", "Revisa que las puertas cierren bien."],
          effort: "bajo_costo",
          weeklyKwhSaved: weekly * REDUCTION_FACTORS.displayCaseNightCover,
        });
      } else if (isOld) {
        out.push({
          ...base,
          id: `refri-cambio-${a.id}`,
          title: `Sustituir ${a.name} podría ahorrar 40 %`,
          description: "Un refrigerador de más de 10 años consume mucho más que uno eficiente actual.",
          actions: ["Busca la etiqueta amarilla de eficiencia energética.", "Revisa programas de sustitución de equipos."],
          effort: "inversion",
          weeklyKwhSaved: weekly * REDUCTION_FACTORS.fridgeReplacement,
        });
      }
      if (!isDisplay) {
        out.push({
          ...base,
          id: "refri-mantenimiento",
          title: `Dale mantenimiento a ${a.name}`,
          description: "Empaques en mal estado y poca ventilación obligan al compresor a trabajar de más.",
          actions: ["Sepáralo 10 cm de la pared.", "Revisa los empaques con una hoja de papel.", "No metas comida caliente."],
          effort: "sin_costo",
          weeklyKwhSaved: weekly * REDUCTION_FACTORS.fridgeMaintenance,
        });
      }
      break;
    }

    case "entretenimiento": {
      const alwaysOnNeeded = has(a.name, "modem", "router", "wifi");
      if (a.hours_per_day >= 20 && !alwaysOnNeeded) {
        out.push({
          ...base,
          id: `standby-${a.id}`,
          title: `Desconecta ${a.name} por la noche`,
          description: "Los aparatos en espera siguen consumiendo energía aunque no los uses.",
          actions: ["Conéctalo a un multicontacto con interruptor.", "Apágalo por completo 8 horas cada noche."],
          effort: "bajo_costo",
          weeklyKwhSaved: weeklyForHours(a, 8),
        });
      } else if (has(a.name, "computadora", "pc", "laptop", "monitor")) {
        out.push({
          ...base,
          id: `suspension-${a.id}`,
          title: `Activa la suspensión automática en ${a.name}`,
          description: "Configurar que la pantalla y el equipo se suspendan tras 10 minutos sin uso ahorra cerca de 15 %.",
          actions: ["Pantalla: apagar a los 5 min.", "Equipo: suspender a los 10 min.", "Baja el brillo."],
          effort: "sin_costo",
          weeklyKwhSaved: weekly * REDUCTION_FACTORS.computerSleepMode,
        });
      } else if (!alwaysOnNeeded && a.hours_per_day >= 3) {
        out.push({
          ...base,
          id: `pantalla-${a.id}`,
          title: `Reduce 1 hora diaria de ${a.name}`,
          description: `Lo registraste ${a.hours_per_day} h al día.`,
          actions: ["Activa el apagado automático.", "Usa el modo de ahorro de energía."],
          effort: "sin_costo",
          weeklyKwhSaved: weeklyForHours(a, 1),
        });
      }
      break;
    }

    case "cocina": {
      const weeklyHours = a.hours_per_day * a.days_per_week;
      if (perUnitW >= 1000 && weeklyHours >= 1.5) {
        const tip = has(a.name, "hervidor")
          ? "Calienta solo el agua que vas a usar."
          : has(a.name, "horno")
            ? "Aprovecha el calor residual: apágalo 5–10 minutos antes."
            : "Planea tus preparaciones para usarlo menos veces.";
        out.push({
          ...base,
          id: `cocina-${a.id}`,
          title: `Usa menos ${a.name}`,
          description: `Es un aparato de alta potencia (${perUnitW} W). Reducir su uso una cuarta parte se nota en el recibo.`,
          actions: [tip, "Tapa las ollas y usa recipientes del tamaño adecuado."],
          effort: "sin_costo",
          weeklyKwhSaved: weekly * REDUCTION_FACTORS.kitchenHighPower,
        });
      }
      break;
    }

    default: {
      if (has(a.name, "secadora de ropa", "secadora electrica") || (has(a.name, "secadora") && perUnitW >= 2000)) {
        out.push({
          ...base,
          id: `secadora-${a.id}`,
          title: "Tiende la ropa al sol",
          description: "La secadora de ropa es de los aparatos que más consumen. Secar al sol la mitad de las cargas reduce su gasto a la mitad.",
          actions: ["Usa tendedero los días soleados.", "Centrifuga bien antes de secar."],
          effort: "sin_costo",
          weeklyKwhSaved: weekly * REDUCTION_FACTORS.dryerSunDrying,
        });
      } else if (has(a.name, "lavadora") && a.days_per_week >= 3) {
        out.push({
          ...base,
          id: `lavadora-${a.id}`,
          title: "Lava solo con carga completa",
          description: `La usas ${a.days_per_week} días a la semana. Juntar ropa permite ahorrar al menos un ciclo semanal.`,
          actions: ["Llena la lavadora antes de usarla.", "Usa agua fría cuando sea posible."],
          effort: "sin_costo",
          weeklyKwhSaved: weeklyKwh({ ...a, days_per_week: 1 }),
        });
      } else if (has(a.name, "plancha") && a.days_per_week >= 2) {
        out.push({
          ...base,
          id: `plancha-${a.id}`,
          title: "Plancha toda la ropa en una sola sesión",
          description: "Calentar la plancha varias veces a la semana desperdicia energía.",
          actions: ["Agrupa la ropa y plancha una vez por semana.", "Desconéctala unos minutos antes de terminar."],
          effort: "sin_costo",
          weeklyKwhSaved: weeklyKwh({ ...a, days_per_week: a.days_per_week - 1 }),
        });
      } else if (has(a.name, "letrero", "anuncio") && a.hours_per_day >= 4) {
        out.push({
          ...base,
          id: `letrero-${a.id}`,
          title: `Pon un temporizador a ${a.name}`,
          description:
            accountType === "negocio"
              ? "Encenderlo solo en el horario con clientes reduce su consumo sin afectar tus ventas."
              : "Encenderlo solo cuando es necesario reduce su consumo.",
          actions: ["Programa encendido al anochecer y apagado al cierre."],
          effort: "bajo_costo",
          weeklyKwhSaved: weeklyForHours(a, 2),
        });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Reglas por hábito
// ---------------------------------------------------------------------------
function habitRules(habits: HabitLog[], appliances: Appliance[]): Draft[] {
  const out: Draft[] = [];
  const avg = (logs: HabitLog[]) => logs.reduce((s, h) => s + habitWeeklyKwh(h), 0) / logs.length;

  const lights = habits.filter((h) => h.habit_type === "luces_sin_necesidad");
  if (lights.length > 0) {
    const avgCount = round(lights.reduce((s, h) => s + h.item_count, 0) / lights.length, 1);
    const avgHours = round(lights.reduce((s, h) => s + h.hours_per_day, 0) / lights.length, 1);
    out.push({
      id: "habito-luces",
      title: "Apaga las luces que nadie está usando",
      description: `En tus registros dejas en promedio ${avgCount} foco(s) encendido(s) sin necesidad durante ${avgHours} h.`,
      actions: ["Revisa las habitaciones antes de salir.", "Asigna a alguien de casa como “guardián de la luz” esta semana."],
      source: "habito",
      effort: "sin_costo",
      categorySlug: "iluminacion",
      applianceId: null,
      weeklyKwhSaved: avg(lights),
    });
  }

  const standby = habits.filter((h) => h.habit_type === "dispositivos_standby");
  if (standby.length > 0) {
    const avgCount = round(standby.reduce((s, h) => s + h.item_count, 0) / standby.length, 1);
    out.push({
      id: "habito-standby",
      title: "Elimina el consumo “vampiro”",
      description: `Registraste en promedio ${avgCount} aparato(s) conectados sin usarse. En conjunto suman consumo todo el día.`,
      actions: ["Usa multicontactos con interruptor.", "Desconecta cargadores cuando no estén cargando."],
      source: "habito",
      effort: "bajo_costo",
      categorySlug: "entretenimiento",
      applianceId: null,
      weeklyKwhSaved: avg(standby),
    });
  }

  // Uso real vs. horas registradas (último registro de cada aparato)
  const latestByAppliance = new Map<string, HabitLog>();
  for (const h of habits) {
    if (h.habit_type !== "uso_aparato" || !h.appliance_id) continue;
    const prev = latestByAppliance.get(h.appliance_id);
    if (!prev || h.log_date > prev.log_date || (h.log_date === prev.log_date && h.created_at > prev.created_at)) {
      latestByAppliance.set(h.appliance_id, h);
    }
  }
  for (const [applianceId, h] of latestByAppliance) {
    const a = appliances.find((x) => x.id === applianceId);
    if (!a) continue;
    if (h.hours_per_day > a.hours_per_day * 1.2 && h.hours_per_day - a.hours_per_day >= 0.5) {
      const extraHours = h.hours_per_day - a.hours_per_day;
      out.push({
        id: `uso-real-${a.id}`,
        title: `${a.name} se usa más de lo que registraste`,
        description: `Registraste ${a.hours_per_day} h/día, pero tu último registro real fue de ${h.hours_per_day} h. Regresar a lo planeado ahorraría ese excedente.`,
        actions: ["Actualiza las horas en Mis aparatos para un cálculo exacto.", "Ponle un temporizador o recordatorio."],
        source: "habito",
        effort: "sin_costo",
        categorySlug: a.category_slug,
        applianceId: a.id,
        weeklyKwhSaved: weeklyKwh({ ...a, hours_per_day: extraHours }),
      });
    } else if (h.hours_per_day < a.hours_per_day * 0.8) {
      out.push({
        id: `uso-real-${a.id}`,
        title: `Actualiza las horas de ${a.name}`,
        description: `Lo usas ${h.hours_per_day} h/día y tienes registradas ${a.hours_per_day} h. Ajustarlo hará tus cálculos más precisos.`,
        actions: ["Edita el aparato en Mis aparatos."],
        source: "habito",
        effort: "sin_costo",
        categorySlug: a.category_slug,
        applianceId: a.id,
        weeklyKwhSaved: 0,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Recomendaciones generales (cuando hay pocos datos)
// ---------------------------------------------------------------------------
const GENERAL_TIPS: Omit<Draft, "weeklyKwhSaved">[] = [
  {
    id: "general-luz-natural",
    title: "Aprovecha la luz natural",
    description: "Organiza tus actividades cerca de ventanas durante el día y pinta de colores claros las paredes.",
    actions: ["Abre cortinas por la mañana.", "Limpia ventanas y lámparas."],
    source: "general",
    effort: "sin_costo",
    categorySlug: "iluminacion",
    applianceId: null,
  },
  {
    id: "general-cargadores",
    title: "Desconecta cargadores y aparatos que no usas",
    description: "Cargadores, bocinas y decodificadores consumen energía aunque estén apagados.",
    actions: ["Desconéctalos al terminar.", "Registra este hábito para medir tu avance."],
    source: "general",
    effort: "sin_costo",
    categorySlug: "entretenimiento",
    applianceId: null,
  },
  {
    id: "general-registra-habitos",
    title: "Registra tus hábitos esta semana",
    description: "Con tus registros diarios identificamos desperdicios concretos y calculamos cuánto puedes ahorrar.",
    actions: ["Anota cuántas luces quedan encendidas sin necesidad.", "Anota cuántos aparatos quedan conectados sin uso."],
    source: "general",
    effort: "sin_costo",
    categorySlug: null,
    applianceId: null,
  },
];

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------
export function generateRecommendations(input: RecommendationInput): Recommendation[] {
  const { appliances, tariffPerKwh, accountType, today, limit = 10 } = input;
  const co2 = input.co2KgPerKwh ?? DEFAULT_CO2_KG_PER_KWH;
  const windowDays = input.habitWindowDays ?? 30;
  const habits = (input.habits ?? []).filter((h) => !today || daysBetween(h.log_date, today) <= windowDays);

  const ctx: Ctx = { tariff: tariffPerKwh, co2, totalMonthKwh: totalWeeklyKwh(appliances) * WEEKS_PER_MONTH };

  if (appliances.length === 0) {
    return [
      {
        id: "general-registra-aparatos",
        title: "Registra tus aparatos para recibir recomendaciones",
        description: "Necesitamos saber qué aparatos usas y cuánto tiempo para encontrar dónde puedes ahorrar.",
        actions: ["Empieza por el refrigerador, los focos y la televisión."],
        source: "general",
        priority: "alta",
        effort: "sin_costo",
        categorySlug: null,
        applianceId: null,
        savings: { kwhMonth: 0, costMonth: 0, co2MonthKg: 0, pctOfTotal: 0 },
      },
    ];
  }

  // Aparatos de mayor a menor consumo: el primero de cada regla compartida gana
  const sorted = [...appliances].sort((x, y) => weeklyKwh(y) - weeklyKwh(x));
  const drafts = [...habitRules(habits, appliances), ...sorted.flatMap((a) => applianceRules(a, accountType))];

  const seen = new Set<string>();
  const recs: Recommendation[] = [];
  for (const d of drafts) {
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    const { weeklyKwhSaved, ...rest } = d;
    const savings = savingsFromWeekly(weeklyKwhSaved, ctx);
    recs.push({ ...rest, savings, priority: priorityFor(savings) });
  }

  // Si hay pocos datos, completa con consejos generales
  if (recs.length < 3) {
    for (const tip of GENERAL_TIPS) {
      if (recs.length >= 3) break;
      if (tip.id === "general-registra-habitos" && habits.length > 0) continue;
      recs.push({ ...tip, priority: "baja", savings: { kwhMonth: 0, costMonth: 0, co2MonthKg: 0, pctOfTotal: 0 } });
    }
  }

  const effortOrder: Record<RecommendationEffort, number> = { sin_costo: 0, bajo_costo: 1, inversion: 2 };
  return recs
    .sort((x, y) => y.savings.costMonth - x.savings.costMonth || effortOrder[x.effort] - effortOrder[y.effort])
    .slice(0, Math.max(1, limit));
}

/**
 * Ahorro potencial total de un conjunto de recomendaciones.
 * Excluye las que requieren inversión (no son acciones inmediatas) y las que
 * tocan el mismo aparato se cuentan una sola vez (la de mayor ahorro), para no inflar el total.
 */
export function summarizeRecommendations(recs: Recommendation[], options: { includeInvestment?: boolean } = {}) {
  const perTarget = new Map<string, Recommendation>();
  for (const r of recs) {
    if (r.effort === "inversion" && !options.includeInvestment) continue;
    const key = r.applianceId ?? r.id;
    const prev = perTarget.get(key);
    if (!prev || r.savings.kwhMonth > prev.savings.kwhMonth) perTarget.set(key, r);
  }
  const list = [...perTarget.values()];
  return {
    count: list.length,
    kwhMonth: round(list.reduce((s, r) => s + r.savings.kwhMonth, 0), 3),
    costMonth: round(list.reduce((s, r) => s + r.savings.costMonth, 0), 2),
    co2MonthKg: round(list.reduce((s, r) => s + r.savings.co2MonthKg, 0), 3),
  };
}
