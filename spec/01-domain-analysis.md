# Domain Analysis — What a Family-House Project in Slovakia Consists Of

This document is the **domain truth** for ArchiTrack's default project template
("Rodinný dom SK"). It reflects Slovak practice under the current building law,
**zákon č. 25/2025 Z. z. (Stavebný zákon)**, in force since 1 April 2025, which replaced
the old two-step system (územné rozhodnutie + stavebné povolenie of zákon 50/1976 Zb.)
with **rozhodnutie o stavebnom zámere** (decision on the building intent) followed by
**overenie projektu stavby** (verification of the construction project).

The template must be **editable** — legislation and practice change; phases and tasks
below are seed data, not hard-coded logic.

## 1. Lifecycle phases (template: "Rodinný dom SK")

Ordered phases, each with default tasks. Slovak names are shown because the UI default
language is Slovak; EN translations in parentheses are used for the EN locale.

### Phase 1 — Zadanie a prieskumy (Brief & surveys)

| Default task | Notes |
|---|---|
| Úvodné stretnutie, zadanie klienta | Client brief: requirements, budget, lifestyle |
| Obhliadka pozemku | Site visit |
| Zameranie pozemku (geodet) | Survey by geodesist — external profession |
| Inžinierskogeologický prieskum (IGP) | Soil survey — needed for foundations/statics |
| Radónový prieskum | Radon measurement |
| Územnoplánovacia informácia | Zoning info from municipality (what may be built) |
| Overenie sietí (elektrina, voda, kanalizácia, plyn, telekom) | Utility availability statements |

### Phase 2 — Architektonická štúdia (Architectural study)

| Default task | Notes |
|---|---|
| Koncept / prvé návrhy | 2–3 variants typically |
| Prezentácia klientovi, pripomienky | Iteration loop with client — chat & comments heavily used here |
| Finálna štúdia (pôdorysy, pohľady, vizualizácie) | Deliverable the client signs off |
| Odsúhlasenie štúdie klientom | Explicit client approval milestone |

### Phase 3 — Projekt pre stavebný zámer (Building-intent documentation)

Documentation submitted to obtain **rozhodnutie o stavebnom zámere**.

| Default task | Notes |
|---|---|
| Architektúra — situácia, pôdorysy, rezy, pohľady | Core drawings by the architect |
| Sprievodná a súhrnná technická správa | Accompanying/technical report |
| Osadenie stavby na pozemku, odstupové vzdialenosti | Siting & setbacks |
| Napojenie na siete — prípojky (koncept) | Utility connections concept |

### Phase 4 — Profesie (Engineering professions)

Sub-deliverables usually produced by external specialists; the architect coordinates.
Each is both a **task group** and a **file folder** in the project.

| Profession (SK) | EN | External specialist |
|---|---|---|
| Statika | Structural engineering | statik |
| Zdravotechnika (ZTI — voda, kanalizácia) | Plumbing & sewage | projektant ZTI |
| Elektroinštalácie + bleskozvod | Electrical + lightning protection | elektroprojektant |
| Vykurovanie | Heating | projektant ÚK |
| Plynoinštalácia | Gas installation (if applicable) | projektant plynu |
| Vetranie / rekuperácia | Ventilation / heat recovery (optional) | — |
| Požiarna ochrana | Fire protection report | špecialista PO |
| Energetické hodnotenie (projektové) | Energy performance assessment | — |
| Prípojky (voda, kanalizácia, NN, plyn) | Utility connection designs | — |

Modelling note: professions are ordinary **tasks with the `EXTERNAL` assignee type** and a
free-text contact (name/phone/email of the statik etc.). No login for externals in v1.

### Phase 5 — Povoľovací proces (Permitting)

| Default task | Notes |
|---|---|
| Vyjadrenia dotknutých orgánov | Statements: hygiena, hasiči (PO), životné prostredie, pamiatkový úrad (if relevant), doprava |
| Vyjadrenia správcov sietí | ZSE/SSE/VSD, vodárne, SPP-D, telekom operators |
| Podanie stavebného zámeru na stavebný úrad | Filing (electronically via URBION or in person) |
| Rozhodnutie o stavebnom zámere | The decision itself — milestone, has a date & document |
| Overenie projektu stavby | Project verification (valid 2 years) |
| Správne poplatky | Admin fee (~€300 for a family house, 2026) |

Domain quirks the app must tolerate: statements (`vyjadrenia`) have **limited validity**
(typically 12 months) → tasks support due dates and the file entity supports an optional
`valid_until` date with dashboard warnings.

### Phase 6 — Realizačný projekt (Detailed design for construction)

| Default task | Notes |
|---|---|
| Realizačné výkresy — architektúra | Construction-level drawings |
| Realizačné výkresy — profesie | Updated profession drawings |
| Výkaz výmer / rozpočet | Bill of quantities / budget (optional service) |
| Výber dodávateľa — podklady | Tender support (optional) |

### Phase 7 — Realizácia a autorský dozor (Construction & author's supervision)

| Default task | Notes |
|---|---|
| Odovzdanie staveniska | Site handover |
| Kontrolné dni | Periodic site inspections — photos uploaded to Files |
| Zmeny počas výstavby | Change management |
| Energetický certifikát | Energy certificate (needed for approval) |
| Kolaudácia | Final approval/occupancy — milestone |

## 2. Consequences for the product

1. **Phases are ordered and named**, have a status (`upcoming / active / done`), a client-visible
   description, and a weight for progress calculation. Default weights:
   Phase 1: 5 %, 2: 15 %, 3: 15 %, 4: 20 %, 5: 15 %, 6: 20 %, 7: 10 %.
2. **Not every project has every phase/task** — e.g. no gas, or the client orders only the
   study. Template application = copy + prune, fully editable afterwards.
3. **Files map naturally to phases and professions** → folder tree is seeded from the
   template (one folder per phase, sub-folders per profession in Phase 4).
4. **External parties** (statik, elektroprojektant, geodet, stavebný úrad) appear as task
   assignees of type EXTERNAL and as `Contact` records — no accounts.
5. **Milestones**: "Odsúhlasenie štúdie", "Rozhodnutie o stavebnom zámere",
   "Overenie projektu stavby", "Kolaudácia" are tasks flagged `milestone: true`; they render
   prominently on the client timeline.
6. **Dates that expire** (vyjadrenia, overenie platí 2 roky) → `valid_until` on files,
   surfacing in an "Expiring soon" widget for the architect.
7. Terminology in the SK locale must use the **current law's terms** (stavebný zámer,
   rozhodnutie o stavebnom zámere, overenie projektu stavby) — clients will hear these
   from authorities. Keep old terms (stavebné povolenie) out of UI copy except where
   colloquially explained in help text.

## 3. Sources

- [Stavebné konanie 2026 — aksamec.sk](https://www.aksamec.sk/stavebne-konanie-2026/) — process under zákon 25/2025 Z. z.
- [Ako vybaviť stavebné povolenie — twg.sk](https://www.twg.sk/blog/ako-vybavit-stavebne-povolenie) — documentation, authorities, fees, validity of statements
- Practice knowledge of Slovak residential design workflow (professions & deliverables); the in-app template is seed data and editable by the architect.
