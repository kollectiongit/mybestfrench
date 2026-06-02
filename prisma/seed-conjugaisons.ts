import { PrismaClient } from "../app/generated/prisma";

const prisma = new PrismaClient();

type Temps = "présent" | "imparfait" | "passé composé" | "futur simple";

interface ConjugaisonInput {
  infinitif: string;
  groupe: number;
  temps: Temps;
  personne: string; // "je","tu","il","nous","vous","elles"
  radical: string; // "" si forme entière à saisir
  terminaison: string; // forme entière si radical === ""
}

const PERSONNES = ["je", "tu", "il", "nous", "vous", "elles"] as const;

/**
 * Construit 6 lignes (une par personne) pour un verbe régulier (1er/2e groupe)
 * à un temps simple : on fournit le radical commun + les 6 terminaisons.
 */
function reguliere(
  infinitif: string,
  groupe: number,
  temps: Temps,
  radical: string,
  terminaisons: [string, string, string, string, string, string]
): ConjugaisonInput[] {
  return PERSONNES.map((personne, i) => ({
    infinitif,
    groupe,
    temps,
    personne,
    radical,
    terminaison: terminaisons[i],
  }));
}

/**
 * Construit 6 lignes pour un cas "forme entière" (radical vide) :
 * 3e groupe à tous les temps, et passé composé de tous les verbes.
 * On fournit les 6 formes complètes (sans pronom sujet).
 */
function formeEntiere(
  infinitif: string,
  groupe: number,
  temps: Temps,
  formes: [string, string, string, string, string, string]
): ConjugaisonInput[] {
  return PERSONNES.map((personne, i) => ({
    infinitif,
    groupe,
    temps,
    personne,
    radical: "",
    terminaison: formes[i],
  }));
}

const data: ConjugaisonInput[] = [
  // ----------------------------------------------------------------------------
  // MANGER (1er groupe)
  // ----------------------------------------------------------------------------
  ...reguliere("manger", 1, "présent", "mang", ["e", "es", "e", "eons", "ez", "ent"]),
  ...reguliere("manger", 1, "imparfait", "mang", ["eais", "eais", "eait", "ions", "iez", "eaient"]),
  ...reguliere("manger", 1, "futur simple", "manger", ["ai", "as", "a", "ons", "ez", "ont"]),
  ...formeEntiere("manger", 1, "passé composé", [
    "ai mangé",
    "as mangé",
    "a mangé",
    "avons mangé",
    "avez mangé",
    "ont mangé",
  ]),

  // ----------------------------------------------------------------------------
  // NOURRIR (2e groupe)
  // ----------------------------------------------------------------------------
  ...reguliere("nourrir", 2, "présent", "nourr", ["is", "is", "it", "issons", "issez", "issent"]),
  ...reguliere("nourrir", 2, "imparfait", "nourriss", ["ais", "ais", "ait", "ions", "iez", "aient"]),
  ...reguliere("nourrir", 2, "futur simple", "nourrir", ["ai", "as", "a", "ons", "ez", "ont"]),
  ...formeEntiere("nourrir", 2, "passé composé", [
    "ai nourri",
    "as nourri",
    "a nourri",
    "avons nourri",
    "avez nourri",
    "ont nourri",
  ]),

  // ----------------------------------------------------------------------------
  // ALLER (3e groupe) — radical vide partout
  // ----------------------------------------------------------------------------
  ...formeEntiere("aller", 3, "présent", ["vais", "vas", "va", "allons", "allez", "vont"]),
  ...formeEntiere("aller", 3, "imparfait", ["allais", "allais", "allait", "allions", "alliez", "allaient"]),
  ...formeEntiere("aller", 3, "futur simple", ["irai", "iras", "ira", "irons", "irez", "iront"]),
  ...formeEntiere("aller", 3, "passé composé", [
    "suis allé",
    "es allé",
    "est allé",
    "sommes allés",
    "êtes allés",
    "sont allées",
  ]),

  // ----------------------------------------------------------------------------
  // ÊTRE (3e groupe)
  // ----------------------------------------------------------------------------
  ...formeEntiere("être", 3, "présent", ["suis", "es", "est", "sommes", "êtes", "sont"]),
  ...formeEntiere("être", 3, "imparfait", ["étais", "étais", "était", "étions", "étiez", "étaient"]),
  ...formeEntiere("être", 3, "futur simple", ["serai", "seras", "sera", "serons", "serez", "seront"]),
  ...formeEntiere("être", 3, "passé composé", [
    "ai été",
    "as été",
    "a été",
    "avons été",
    "avez été",
    "ont été",
  ]),

  // ----------------------------------------------------------------------------
  // AVOIR (3e groupe)
  // ----------------------------------------------------------------------------
  ...formeEntiere("avoir", 3, "présent", ["ai", "as", "a", "avons", "avez", "ont"]),
  ...formeEntiere("avoir", 3, "imparfait", ["avais", "avais", "avait", "avions", "aviez", "avaient"]),
  ...formeEntiere("avoir", 3, "futur simple", ["aurai", "auras", "aura", "aurons", "aurez", "auront"]),
  ...formeEntiere("avoir", 3, "passé composé", [
    "ai eu",
    "as eu",
    "a eu",
    "avons eu",
    "avez eu",
    "ont eu",
  ]),

  // ----------------------------------------------------------------------------
  // MENTIR (3e groupe)
  // ----------------------------------------------------------------------------
  ...formeEntiere("mentir", 3, "présent", ["mens", "mens", "ment", "mentons", "mentez", "mentent"]),
  ...formeEntiere("mentir", 3, "imparfait", ["mentais", "mentais", "mentait", "mentions", "mentiez", "mentaient"]),
  ...formeEntiere("mentir", 3, "futur simple", ["mentirai", "mentiras", "mentira", "mentirons", "mentirez", "mentiront"]),
  ...formeEntiere("mentir", 3, "passé composé", [
    "ai menti",
    "as menti",
    "a menti",
    "avons menti",
    "avez menti",
    "ont menti",
  ]),

  // ----------------------------------------------------------------------------
  // CROIRE (3e groupe)
  // ----------------------------------------------------------------------------
  ...formeEntiere("croire", 3, "présent", ["crois", "crois", "croit", "croyons", "croyez", "croient"]),
  ...formeEntiere("croire", 3, "imparfait", ["croyais", "croyais", "croyait", "croyions", "croyiez", "croyaient"]),
  ...formeEntiere("croire", 3, "futur simple", ["croirai", "croiras", "croira", "croirons", "croirez", "croiront"]),
  ...formeEntiere("croire", 3, "passé composé", [
    "ai cru",
    "as cru",
    "a cru",
    "avons cru",
    "avez cru",
    "ont cru",
  ]),

  // ----------------------------------------------------------------------------
  // VENIR (3e groupe)
  // ----------------------------------------------------------------------------
  ...formeEntiere("venir", 3, "présent", ["viens", "viens", "vient", "venons", "venez", "viennent"]),
  ...formeEntiere("venir", 3, "imparfait", ["venais", "venais", "venait", "venions", "veniez", "venaient"]),
  ...formeEntiere("venir", 3, "futur simple", ["viendrai", "viendras", "viendra", "viendrons", "viendrez", "viendront"]),
  ...formeEntiere("venir", 3, "passé composé", [
    "suis venu",
    "es venu",
    "est venu",
    "sommes venus",
    "êtes venus",
    "sont venues",
  ]),
];

async function main() {
  // Invariant de sûreté : radical + terminaison === verbe_conjugue
  for (const c of data) {
    const verbe_conjugue = c.radical + c.terminaison;
    await prisma.conjugaison.upsert({
      where: {
        infinitif_temps_personne: {
          infinitif: c.infinitif,
          temps: c.temps,
          personne: c.personne,
        },
      },
      update: {
        groupe: c.groupe,
        radical: c.radical,
        terminaison: c.terminaison,
        verbe_conjugue,
      },
      create: {
        infinitif: c.infinitif,
        groupe: c.groupe,
        temps: c.temps,
        personne: c.personne,
        radical: c.radical,
        terminaison: c.terminaison,
        verbe_conjugue,
      },
    });
  }

  const count = await prisma.conjugaison.count();
  console.log(`✅ Seed terminé : ${data.length} conjugaisons traitées, ${count} en base.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
