/**
 * Seed script (spec/03-data-model.md §3.6):
 *   - one ADMIN user (from env SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD)
 *   - the full "Rodinný dom SK" template exactly as specified in
 *     spec/01-domain-analysis.md §1 (SK + EN translations)
 *   - one demo project generated from it, with a demo client
 *
 * Run with: pnpm db:seed  (wraps `tsx prisma/seed.ts`)
 */
import "dotenv/config";
import { PrismaClient, type AssigneeType, type Visibility } from "@prisma/client";
import argon2 from "argon2";

const db = new PrismaClient();

interface TaskSeed {
  titleSk: string;
  titleEn: string;
  milestone?: boolean;
  assigneeType?: AssigneeType;
  defaultVisibility?: Visibility;
}

interface PhaseSeed {
  key: string;
  nameSk: string;
  nameEn: string;
  descriptionSk: string;
  descriptionEn: string;
  weight: number;
  tasks: TaskSeed[];
}

// ---------------------------------------------------------------------------------
// "Rodinný dom SK" template — verbatim from spec/01-domain-analysis.md §1.
// Weights per §2.1: Phase 1: 5%, 2: 15%, 3: 15%, 4: 20%, 5: 15%, 6: 20%, 7: 10%.
// ---------------------------------------------------------------------------------
const RD_SK_TEMPLATE: PhaseSeed[] = [
  {
    key: "sk_house.brief_surveys",
    nameSk: "Zadanie a prieskumy",
    nameEn: "Brief & surveys",
    descriptionSk: "Úvodné stretnutia, obhliadka pozemku a prieskumy potrebné pred návrhom.",
    descriptionEn: "Initial meetings, site visit, and surveys needed before design work begins.",
    weight: 5,
    tasks: [
      { titleSk: "Úvodné stretnutie, zadanie klienta", titleEn: "Client brief: requirements, budget, lifestyle" },
      { titleSk: "Obhliadka pozemku", titleEn: "Site visit" },
      { titleSk: "Zameranie pozemku (geodet)", titleEn: "Survey by geodesist", assigneeType: "EXTERNAL" },
      { titleSk: "Inžinierskogeologický prieskum (IGP)", titleEn: "Soil survey (IGP)", assigneeType: "EXTERNAL" },
      { titleSk: "Radónový prieskum", titleEn: "Radon measurement", assigneeType: "EXTERNAL" },
      { titleSk: "Územnoplánovacia informácia", titleEn: "Zoning info from municipality" },
      {
        titleSk: "Overenie sietí (elektrina, voda, kanalizácia, plyn, telekom)",
        titleEn: "Utility availability statements (electricity, water, sewage, gas, telecom)",
      },
    ],
  },
  {
    key: "sk_house.architectural_study",
    nameSk: "Architektonická štúdia",
    nameEn: "Architectural study",
    descriptionSk: "Návrh koncepcie domu, prezentácia klientovi a finálne odsúhlasenie štúdie.",
    descriptionEn: "Designing the house concept, presenting to the client, and final study sign-off.",
    weight: 15,
    tasks: [
      { titleSk: "Koncept / prvé návrhy", titleEn: "Concept / first drafts (typically 2–3 variants)" },
      {
        titleSk: "Prezentácia klientovi, pripomienky",
        titleEn: "Client presentation & feedback loop",
        defaultVisibility: "CLIENT_VISIBLE",
      },
      {
        titleSk: "Finálna štúdia (pôdorysy, pohľady, vizualizácie)",
        titleEn: "Final study (floor plans, elevations, visualizations)",
        defaultVisibility: "CLIENT_VISIBLE",
      },
      {
        titleSk: "Odsúhlasenie štúdie klientom",
        titleEn: "Client approval of the study",
        milestone: true,
        defaultVisibility: "CLIENT_VISIBLE",
      },
    ],
  },
  {
    key: "sk_house.building_intent_docs",
    nameSk: "Projekt pre stavebný zámer",
    nameEn: "Building-intent documentation",
    descriptionSk: "Dokumentácia predkladaná na získanie rozhodnutia o stavebnom zámere.",
    descriptionEn: "Documentation submitted to obtain the building-intent decision.",
    weight: 15,
    tasks: [
      {
        titleSk: "Architektúra — situácia, pôdorysy, rezy, pohľady",
        titleEn: "Architecture — site plan, floor plans, sections, elevations",
      },
      { titleSk: "Sprievodná a súhrnná technická správa", titleEn: "Accompanying & summary technical report" },
      { titleSk: "Osadenie stavby na pozemku, odstupové vzdialenosti", titleEn: "Siting on the plot & setbacks" },
      { titleSk: "Napojenie na siete — prípojky (koncept)", titleEn: "Utility connections concept" },
    ],
  },
  {
    key: "sk_house.professions",
    nameSk: "Profesie",
    nameEn: "Engineering professions",
    descriptionSk: "Sub-dodávky externých špecialistov, koordinované architektom.",
    descriptionEn: "Sub-deliverables from external specialists, coordinated by the architect.",
    weight: 20,
    tasks: [
      { titleSk: "Statika", titleEn: "Structural engineering", assigneeType: "EXTERNAL" },
      { titleSk: "Zdravotechnika (ZTI — voda, kanalizácia)", titleEn: "Plumbing & sewage (ZTI)", assigneeType: "EXTERNAL" },
      { titleSk: "Elektroinštalácie + bleskozvod", titleEn: "Electrical + lightning protection", assigneeType: "EXTERNAL" },
      { titleSk: "Vykurovanie", titleEn: "Heating", assigneeType: "EXTERNAL" },
      { titleSk: "Plynoinštalácia", titleEn: "Gas installation (if applicable)", assigneeType: "EXTERNAL" },
      { titleSk: "Vetranie / rekuperácia", titleEn: "Ventilation / heat recovery (optional)", assigneeType: "EXTERNAL" },
      { titleSk: "Požiarna ochrana", titleEn: "Fire protection report", assigneeType: "EXTERNAL" },
      { titleSk: "Energetické hodnotenie (projektové)", titleEn: "Energy performance assessment (design stage)", assigneeType: "EXTERNAL" },
      { titleSk: "Prípojky (voda, kanalizácia, NN, plyn)", titleEn: "Utility connection designs", assigneeType: "EXTERNAL" },
    ],
  },
  {
    key: "sk_house.permitting",
    nameSk: "Povoľovací proces",
    nameEn: "Permitting",
    descriptionSk: "Vyjadrenia dotknutých orgánov a správcov sietí, podanie a rozhodnutie o stavebnom zámere.",
    descriptionEn: "Statements from authorities and utility operators, filing, and the building-intent decision.",
    weight: 15,
    tasks: [
      {
        titleSk: "Vyjadrenia dotknutých orgánov",
        titleEn: "Statements from relevant authorities (hygiene, fire, environment, heritage, transport)",
      },
      {
        titleSk: "Vyjadrenia správcov sietí",
        titleEn: "Statements from utility operators (electricity, water, gas, telecom)",
      },
      {
        titleSk: "Podanie stavebného zámeru na stavebný úrad",
        titleEn: "Filing the building intent with the building authority",
      },
      {
        titleSk: "Rozhodnutie o stavebnom zámere",
        titleEn: "Building-intent decision",
        milestone: true,
        defaultVisibility: "CLIENT_VISIBLE",
      },
      {
        titleSk: "Overenie projektu stavby",
        titleEn: "Construction project verification (valid 2 years)",
        milestone: true,
        defaultVisibility: "CLIENT_VISIBLE",
      },
      { titleSk: "Správne poplatky", titleEn: "Administrative fees (~€300 for a family house, 2026)" },
    ],
  },
  {
    key: "sk_house.detailed_design",
    nameSk: "Realizačný projekt",
    nameEn: "Detailed design for construction",
    descriptionSk: "Realizačné výkresy architektúry a profesií, prípadne výkaz výmer a podklady na výber dodávateľa.",
    descriptionEn: "Construction-level drawings for architecture and professions, plus optional bill of quantities and tender support.",
    weight: 20,
    tasks: [
      { titleSk: "Realizačné výkresy — architektúra", titleEn: "Construction-level drawings — architecture" },
      { titleSk: "Realizačné výkresy — profesie", titleEn: "Updated construction-level profession drawings" },
      { titleSk: "Výkaz výmer / rozpočet", titleEn: "Bill of quantities / budget (optional service)" },
      { titleSk: "Výber dodávateľa — podklady", titleEn: "Tender support (optional)" },
    ],
  },
  {
    key: "sk_house.construction_supervision",
    nameSk: "Realizácia a autorský dozor",
    nameEn: "Construction & author's supervision",
    descriptionSk: "Odovzdanie staveniska, kontrolné dni, zmeny počas výstavby, energetický certifikát a kolaudácia.",
    descriptionEn: "Site handover, periodic inspections, change management, energy certificate, and final occupancy approval.",
    weight: 10,
    tasks: [
      { titleSk: "Odovzdanie staveniska", titleEn: "Site handover", defaultVisibility: "CLIENT_VISIBLE" },
      {
        titleSk: "Kontrolné dni",
        titleEn: "Periodic site inspections (photos uploaded to Files)",
        defaultVisibility: "CLIENT_VISIBLE",
      },
      { titleSk: "Zmeny počas výstavby", titleEn: "Change management during construction" },
      { titleSk: "Energetický certifikát", titleEn: "Energy certificate (required for approval)" },
      {
        titleSk: "Kolaudácia",
        titleEn: "Final approval / occupancy",
        milestone: true,
        defaultVisibility: "CLIENT_VISIBLE",
      },
    ],
  },
];

async function seedTemplate() {
  const existing = await db.projectTemplate.findFirst({ where: { name: "Rodinný dom SK" } });
  if (existing) {
    console.log(`Template "Rodinný dom SK" already exists (${existing.id}), skipping template seed.`);
    return existing;
  }

  const template = await db.projectTemplate.create({
    data: {
      name: "Rodinný dom SK",
      phases: {
        create: RD_SK_TEMPLATE.map((phase, phaseIndex) => ({
          key: phase.key,
          nameSk: phase.nameSk,
          nameEn: phase.nameEn,
          descriptionSk: phase.descriptionSk,
          descriptionEn: phase.descriptionEn,
          order: phaseIndex + 1,
          weight: phase.weight,
          tasks: {
            create: phase.tasks.map((task, taskIndex) => ({
              titleSk: task.titleSk,
              titleEn: task.titleEn,
              order: taskIndex + 1,
              milestone: task.milestone ?? false,
              assigneeType: task.assigneeType ?? "ARCHITECT",
              defaultVisibility: task.defaultVisibility ?? "INTERNAL",
            })),
          },
        })),
      },
    },
    include: { phases: { include: { tasks: true } } },
  });

  console.log(`Created template "Rodinný dom SK" (${template.id}) with ${template.phases.length} phases.`);
  return template;
}

async function seedAdmin() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@architrack.local").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const admin = await db.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Architect Admin",
      passwordHash,
      role: "ADMIN",
      locale: "sk",
      isActive: true,
    },
  });

  console.log(`Admin user ready: ${admin.email}`);
  return admin;
}

async function seedDemoClient() {
  const email = "klient@architrack.local";
  const passwordHash = await argon2.hash("DemoClient123!", { type: argon2.argon2id });

  const client = await db.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Ján Novák",
      passwordHash,
      role: "CLIENT",
      locale: "sk",
      isActive: true,
    },
  });

  console.log(`Demo client ready: ${client.email}`);
  return client;
}

async function seedDemoProject(template: { id: string }, admin: { id: string }, client: { id: string }) {
  const slug = "rd-novakovci-pezinok";
  const existing = await db.project.findUnique({ where: { slug } });
  if (existing) {
    console.log(`Demo project already exists (${existing.id}), skipping.`);
    return existing;
  }

  // Reload the template with its phases/tasks (in case it was found pre-existing above,
  // `template` might be the lightweight `findFirst` result without relations).
  const fullTemplate = await db.projectTemplate.findUniqueOrThrow({
    where: { id: template.id },
    include: { phases: { include: { tasks: true }, orderBy: { order: "asc" } } },
  });

  const project = await db.project.create({
    data: {
      name: "RD Novákovci — Pezinok",
      slug,
      status: "ACTIVE",
      locationText: "Pezinok, okres Pezinok",
      description:
        "Novostavba rodinného domu pre rodinu Novákovcov na okraji Pezinka — jednopodlažný dom s obytným podkrovím.",
      startDate: new Date("2026-02-01"),
      targetDate: new Date("2027-10-01"),
      members: {
        create: [{ userId: admin.id }, { userId: client.id }],
      },
    },
  });

  // Root system folders.
  const professionsFolder = await db.folder.create({
    data: { projectId: project.id, name: "Profesie", order: 4, visibility: "INTERNAL" },
  });
  await db.folder.create({
    data: {
      projectId: project.id,
      name: "Od klienta",
      order: 100,
      systemKey: "from_client",
      visibility: "CLIENT_VISIBLE",
    },
  });
  await db.folder.create({
    data: { projectId: project.id, name: "Chat", order: 101, systemKey: "chat", visibility: "CLIENT_VISIBLE" },
  });

  for (const [phaseIndex, phaseTemplate] of fullTemplate.phases.entries()) {
    const isFirstPhase = phaseIndex === 0;

    const phase = await db.phase.create({
      data: {
        projectId: project.id,
        name: phaseTemplate.nameSk,
        templateKey: phaseTemplate.key,
        order: phaseIndex + 1,
        weight: phaseTemplate.weight,
        description: phaseTemplate.descriptionSk,
        status: isFirstPhase ? "ACTIVE" : "UPCOMING",
        visibility: "CLIENT_VISIBLE",
      },
    });

    // Folder per phase; professions become sub-folders of "Profesie" (§2.3 of domain doc).
    const isProfessionsPhase = phaseTemplate.key === "sk_house.professions";
    const phaseFolder = isProfessionsPhase
      ? null
      : await db.folder.create({
          data: {
            projectId: project.id,
            name: phaseTemplate.nameSk,
            order: phaseIndex + 1,
            visibility: "INTERNAL",
          },
        });

    for (const [taskIndex, taskTemplate] of phaseTemplate.tasks.entries()) {
      // Only mark a couple of tasks done/in-progress in the demo so the board looks alive.
      const isDemoDone = isFirstPhase && taskIndex < 2;
      const isDemoInProgress = isFirstPhase && taskIndex === 2;

      await db.task.create({
        data: {
          phaseId: phase.id,
          title: taskTemplate.titleSk,
          order: taskIndex + 1,
          milestone: taskTemplate.milestone,
          assigneeType: taskTemplate.assigneeType,
          visibility: taskTemplate.defaultVisibility,
          status: isDemoDone ? "DONE" : isDemoInProgress ? "IN_PROGRESS" : "TODO",
          doneAt: isDemoDone ? new Date() : null,
        },
      });

      if (isProfessionsPhase) {
        await db.folder.upsert({
          where: {
            projectId_parentId_name: {
              projectId: project.id,
              parentId: professionsFolder.id,
              name: taskTemplate.titleSk,
            },
          },
          update: {},
          create: {
            projectId: project.id,
            parentId: professionsFolder.id,
            name: taskTemplate.titleSk,
            order: taskIndex + 1,
            visibility: "INTERNAL",
          },
        });
      }
    }

    void phaseFolder;
  }

  await db.activityLog.create({
    data: {
      projectId: project.id,
      actorId: admin.id,
      action: "project.created",
      meta: { via: "seed", template: "Rodinný dom SK" },
    },
  });

  console.log(`Created demo project "${project.name}" (${project.id}).`);
  return project;
}

async function main() {
  console.log("Seeding ArchiTrack database…");
  const admin = await seedAdmin();
  const client = await seedDemoClient();
  const template = await seedTemplate();
  await seedDemoProject(template, admin, client);
  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
