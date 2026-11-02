/* eslint-disable @typescript-eslint/no-explicit-any -- API replies are untyped JSON in these tests */
/**
 * A throw-away hospital to run whole patient journeys in. The flow specs talk to their own in-memory API (port 4100, started by
 * playwright.config.ts) — never the dev database — and each spec creates a brand-new hospital through the platform-admin route, so
 * every run starts from what a real new tenant gets.
 */
import type { APIRequestContext, Browser, BrowserContext, Page, PlaywrightWorkerArgs } from "@playwright/test";

type Playwright = PlaywrightWorkerArgs["playwright"];

export const FLOW_API = process.env.E2E_FLOW_API ?? "http://localhost:4100";
export const FLOW_APP = process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_APP_PORT ?? 3005}`;
export const PASSWORD = "Flow@12345";

export interface Reply<T = any> { status: number; data: T; error?: { code: string; message: string; details?: any }; meta?: any }

/** One signed-in user's API session. */
export class Session {
  constructor(readonly ctx: APIRequestContext, readonly email: string, readonly role: string) {}
  private async send(method: string, path: string, body?: unknown): Promise<Reply> {
    const res = await this.ctx.fetch(path, { method, ...(body !== undefined ? { data: body } : {}) });
    const json = await res.json().catch(() => null);
    return { status: res.status(), data: json?.data, error: json?.error, meta: json?.meta };
  }
  get = (path: string) => this.send("GET", path);
  post = (path: string, body?: unknown) => this.send("POST", path, body ?? {});
  patch = (path: string, body?: unknown) => this.send("PATCH", path, body ?? {});
  put = (path: string, body?: unknown) => this.send("PUT", path, body ?? {});
  del = (path: string) => this.send("DELETE", path);
  /** A browser context signed in as this user, with the app's /api calls answered by the flow API. */
  async browser(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
    const context = await browser.newContext({ storageState: await this.ctx.storageState(), baseURL: FLOW_APP, viewport: { width: 1440, height: 900 } });
    // The dev app proxies /api to the dev API; send it to the flow API instead (the session cookie is shared by host, not port).
    await context.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(FLOW_API).origin) return route.continue();
      // The live event stream never ends, so it can't be fetched-and-fulfilled (that waits for the whole body): send the request on to the flow API.
      if (url.pathname === "/api/events/stream") return route.continue({ url: `${FLOW_API}${url.pathname}${url.search}` });
      const response = await route.fetch({ url: `${FLOW_API}${url.pathname}${url.search}` });
      await route.fulfill({ response });
    });
    const page = await context.newPage();
    return { context, page };
  }
  dispose = () => this.ctx.dispose();
}

export async function signIn(pw: Playwright, email: string, password: string, role = ""): Promise<Session> {
  const ctx = await pw.request.newContext({ baseURL: FLOW_API });
  const res = await ctx.post("/api/auth/login", { data: { email, password } });
  if (res.status() !== 200) throw new Error(`sign in as ${email} failed: ${res.status()} ${await res.text()}`);
  return new Session(ctx, email, role);
}

export const ROLES = {
  admin: "Super Admin", doctor: "Doctor", reception: "Receptionist", nurse: "Head Nurse", lab: "Lab Technician", pharmacist: "Pharmacist",
  billing: "Billing Exec", mrd: "MRD Officer", hr: "HR Manager", cssd: "CSSD Technician", telecaller: "Tele Caller", it: "IT Admin", driver: "Driver",
} as const;
export type RoleKey = keyof typeof ROLES;

export interface Tenant {
  slug: string; name: string; hospitalId: number;
  users: Record<RoleKey, Session>;
  platform: Session;
  doctorId: number; departmentId: number; wardId: number; bedIds: number[]; contractId: number; today: string; tomorrow: string;
  email: (key: RoleKey) => string;
  dispose: () => Promise<void>;
}

const iso = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86_400_000).toLocaleDateString("en-CA");

/** Create a hospital the way the platform operator does, then give it a doctor, a ward with beds, stock and one login per role. */
export async function newHospital(pw: Playwright, label = "Flow"): Promise<Tenant> {
  const slug = `${label.toLowerCase()}${Date.now().toString(36)}${Math.floor(Math.random() * 99)}`;
  const platform = await signIn(pw, "platform-admin@samvaad.dev", "Samvaad@123", "Platform Admin");
  const created = await platform.post("/api/hospitals", { name: `${label} Hospital ${slug}`, city: "Pune", state: "MH", adminName: "Flow Admin", adminEmail: `admin@${slug}.test`, adminPassword: PASSWORD });
  if (created.status !== 201) throw new Error(`could not create a hospital: ${created.status} ${JSON.stringify(created.error)}`);
  const email = (key: RoleKey) => `${key}@${slug}.test`;
  const admin = await signIn(pw, email("admin"), PASSWORD, ROLES.admin);

  const dept = await admin.post("/api/departments", { name: "General Medicine" });
  const doctor = await admin.post("/api/doctors", { name: "Dr. Asha Rao", specialty: "General Physician", departmentId: dept.data.id, phone: "9811100001" });
  const users = { admin } as Record<RoleKey, Session>;
  // The admin's own address is admin@…; every other login is <key>@<slug>.test.
  for (const key of Object.keys(ROLES) as RoleKey[]) {
    if (key === "admin") continue;
    const made = await admin.post("/api/admin/users", { name: `${ROLES[key]} (${key})`, email: email(key), password: PASSWORD, role: ROLES[key], ...(key === "doctor" ? { doctorId: doctor.data.id } : {}) });
    if (made.status !== 201) throw new Error(`could not create the ${ROLES[key]} login: ${made.status} ${JSON.stringify(made.error)}`);
    users[key] = await signIn(pw, email(key), PASSWORD, ROLES[key]);
  }
  const ward = await admin.post("/api/wards", { name: "General Ward", capacity: 4, dailyRate: 1200 });
  const bedIds: number[] = [];
  for (let i = 1; i <= 4; i++) bedIds.push((await admin.post("/api/beds", { bedNumber: `G-0${i}`, ward: "General Ward", wardId: ward.data.id })).data.id);
  await admin.post("/api/pharmacy", { name: "Paracetamol 500mg", category: "Analgesic", stock: 200, minStock: 20, expiryDate: "2028-12-31", supplier: "Cipla" });
  const contracts = await admin.get("/api/setup/contract");
  const premium = contracts.data.find((c: any) => /Premium 2026/.test(c.name));
  return {
    slug, name: `${label} Hospital ${slug}`, hospitalId: created.data.id, users, platform, doctorId: doctor.data.id, departmentId: dept.data.id, wardId: ward.data.id, bedIds,
    contractId: premium.id, today: iso(0), tomorrow: iso(1), email,
    dispose: async () => { await Promise.all([...Object.values(users).map((u) => u.dispose()), platform.dispose()]); },
  };
}

/** A page with no login (what a patient sees when they open a link), with the app's /api calls answered by the flow API. */
export async function anonymousPage(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL: FLOW_APP, viewport: { width: 390, height: 844 } });
  await context.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(FLOW_API).origin) return route.continue();
    await route.fulfill({ response: await route.fetch({ url: `${FLOW_API}${url.pathname}${url.search}` }) });
  });
  return { context, page: await context.newPage() };
}

/** A report file URL the lab and radiology uploads accept (they must be Firebase Storage links). */
export const REPORT_URL = "https://firebasestorage.googleapis.com/v0/b/flow-test/o/report.pdf?alt=media";
/** A one-pixel signature, as the sign page would send it. */
export const SIGNATURE_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
