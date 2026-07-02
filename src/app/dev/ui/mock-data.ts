import type {
  ChatMessageItem,
  FileEntry,
  FolderNode,
  MilestoneItem,
  PhaseSummary,
  ProjectCardData,
  TaskSummary,
} from "@/components/shared/types";
import type { NotificationItem } from "@/components/shared/notification-bell";

/** Mock data for the /dev/ui showcase — spec/07-agent-workplan.md WP-2, wave-2 milestone. */

export const mockTasks: TaskSummary[] = [
  {
    id: "t1",
    title: "Zameranie pozemku",
    status: "DONE",
    visibility: "CLIENT_VISIBLE",
    dueDate: "2026-04-02",
    commentCount: 2,
  },
  {
    id: "t2",
    title: "Konzultácia dispozície",
    status: "DONE",
    visibility: "CLIENT_VISIBLE",
    dueDate: "2026-04-18",
    isMilestone: true,
  },
  {
    id: "t3",
    title: "Vypracovanie štúdie",
    status: "IN_PROGRESS",
    visibility: "CLIENT_VISIBLE",
    dueDate: "2026-07-10",
    commentCount: 5,
    assignee: "Ing. arch. Nováková",
  },
  {
    id: "t4",
    title: "Statický posudok",
    status: "IN_PROGRESS",
    visibility: "INTERNAL",
    dueDate: "2026-06-20",
    assignee: "Statik — externý",
  },
  {
    id: "t5",
    title: "Žiadosť o vyjadrenia sietí",
    status: "TODO",
    visibility: "INTERNAL",
    dueDate: "2026-07-25",
  },
  {
    id: "t6",
    title: "Odovzdanie žiadosti o povolenie",
    status: "TODO",
    visibility: "CLIENT_VISIBLE",
    isMilestone: true,
  },
];

export const mockPhases: PhaseSummary[] = [
  {
    id: "p1",
    order: 1,
    name: "Štúdia",
    status: "DONE",
    progress: 100,
    weight: 15,
    tasks: mockTasks.slice(0, 2),
  },
  {
    id: "p2",
    order: 2,
    name: "Povoľovací proces",
    status: "ACTIVE",
    progress: 42,
    weight: 25,
    description: "Práve prebieha: čakáme na vyjadrenia sietí.",
    tasks: mockTasks.slice(2, 5),
  },
  {
    id: "p3",
    order: 3,
    name: "Realizačná dokumentácia",
    status: "UPCOMING",
    progress: 0,
    weight: 30,
    tasks: [mockTasks[5]],
  },
  {
    id: "p4",
    order: 4,
    name: "Stavebný dozor",
    status: "UPCOMING",
    progress: 0,
    weight: 30,
    tasks: [],
  },
];

export const mockMilestones: MilestoneItem[] = [
  { id: "m1", label: "Štúdia schválená", date: "2. 4. 2026", done: true },
  { id: "m2", label: "Podanie žiadosti o povolenie", date: "25. 7. 2026", done: false },
  { id: "m3", label: "Právoplatné povolenie", date: null, done: false },
  { id: "m4", label: "Začiatok výstavby", date: null, done: false },
];

export const mockFiles: FileEntry[] = [
  {
    id: "f1",
    name: "Situácia_1-500.pdf",
    version: 3,
    sizeLabel: "2.4 MB",
    updatedAt: "28. 6. 2026",
    visibility: "CLIENT_VISIBLE",
    commentCount: 1,
    kind: "pdf",
  },
  {
    id: "f2",
    name: "Pôdorys_prízemie.pdf",
    version: 2,
    sizeLabel: "1.1 MB",
    updatedAt: "20. 6. 2026",
    visibility: "CLIENT_VISIBLE",
    kind: "pdf",
  },
  {
    id: "f3",
    name: "Vyjadrenie_SPP.pdf",
    version: 1,
    sizeLabel: "410 KB",
    updatedAt: "12. 6. 2026",
    visibility: "INTERNAL",
    validUntil: "2026-07-20",
    kind: "pdf",
  },
  {
    id: "f4",
    name: "Vizualizácia_juh.jpg",
    version: 1,
    sizeLabel: "3.8 MB",
    updatedAt: "5. 6. 2026",
    visibility: "CLIENT_VISIBLE",
    commentCount: 4,
    kind: "image",
  },
];

export const mockFolders: FolderNode[] = [
  {
    id: "root-study",
    name: "01 Štúdia",
    children: [
      { id: "study-drawings", name: "Výkresy" },
      { id: "study-visuals", name: "Vizualizácie" },
    ],
  },
  {
    id: "root-permit",
    name: "02 Povoľovací proces",
    children: [
      { id: "permit-statements", name: "Vyjadrenia sietí" },
      { id: "permit-static", name: "Statika" },
    ],
  },
  { id: "root-client", name: "Od klienta" },
];

export const mockChatMessages: ChatMessageItem[] = [
  {
    id: "c1",
    authorName: "Ing. arch. Nováková",
    own: false,
    body: "Dobrý deň, pripojila som nové výkresy prízemia k štúdii.",
    createdAt: "2026-06-28T09:12:00",
    attachments: [{ id: "a1", name: "Pôdorys_prízemie.pdf", kind: "pdf" }],
  },
  {
    id: "c2",
    authorName: "Peter Novák",
    own: true,
    body: "Ďakujeme, pozrieme sa na to cez víkend.",
    createdAt: "2026-06-28T10:03:00",
  },
  {
    id: "c3",
    authorName: "Peter Novák",
    own: true,
    body: "Okno v obývačke by sme chceli o niečo väčšie, je to možné doriešiť?",
    createdAt: "2026-06-29T18:47:00",
  },
];

export const mockNotifications: NotificationItem[] = [
  { id: "n1", title: "Ing. arch. pridala 3 nové výkresy", timeLabel: "pred 2 h", read: false },
  { id: "n2", title: "Nová správa od Petra Nováka", timeLabel: "včera", read: false },
  { id: "n3", title: "Fáza „Štúdia“ bola dokončená", timeLabel: "pred 5 dňami", read: true },
];

export const mockProjects: ProjectCardData[] = [
  {
    id: "proj-1",
    name: "RD Novákovci",
    clientNames: ["Peter Novák", "Jana Nováková"],
    phaseName: "Povoľovací proces",
    progress: 42,
    unreadCount: 2,
    overdueCount: 1,
  },
  {
    id: "proj-2",
    name: "Vila Malinovo",
    clientNames: ["Tomáš Krajčí"],
    phaseName: "Realizačná dokumentácia",
    progress: 68,
  },
  {
    id: "proj-3",
    name: "RD Horná Streda",
    clientNames: ["Michal Baran", "Eva Baranová"],
    phaseName: "Štúdia",
    progress: 12,
    unreadCount: 0,
  },
];
