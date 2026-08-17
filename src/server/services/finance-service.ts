/**
 * Finance service — non-clinical income and expense bookkeeping, categorized
 * (e.g. canteen rent, generator fuel) and kept apart from patient billing.
 */
import {
  financeIncomesRepo,
  financeExpensesRepo,
} from "@/server/repositories";
import { toFinanceEntryDTO } from "@/server/repositories/mappers";
import { type QueryOptions } from "@/server/db/adapter";
import {
  type FinanceIncomeRow,
  type FinanceExpenseRow,
} from "@/server/db/tables";
import { validate, validatePartial } from "@/server/lib/validation";
import { displayDate } from "@/server/services/helpers";
import { audit } from "@/server/services/audit";
import { type Session } from "@/server/auth/session";
import { type Repository } from "@/server/repositories/base";
import { scopeToHospital, assertOwnedByHospital } from "@/server/services/hospital-scope";

export const INCOME_CATEGORIES = [
  "Canteen Rent", "Parking Fees", "Health Campaign", "Equipment Rental",
  "Training & Workshops", "Donation", "Miscellaneous",
] as const;

export const EXPENSE_CATEGORIES = [
  "Electricity Bill", "Water Bill", "Generator Fuel", "Equipment Maintenance",
  "Housekeeping", "Security Services", "Stationery", "Waste Disposal",
  "Miscellaneous",
] as const;

const entrySchema = (categories: readonly string[]) =>
  ({
    category: { type: "enum", required: true, values: categories },
    description: { type: "string", required: true, min: 2, max: 240 },
    invoiceNumber: { type: "string", required: false, max: 40, default: "" },
    amount: { type: "number", required: true, min: 0 },
    date: { type: "string", required: false, max: 40, default: "" },
  }) as const;

export const FINANCE_LIST_CONFIG = {
  searchColumns: ["category", "description", "invoice_number"],
  filterable: ["category"],
  sortable: ["entry_date", "amount", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

type EntryRow = FinanceIncomeRow | FinanceExpenseRow;
type EntryRepo = Repository<EntryRow, ReturnType<typeof toFinanceEntryDTO>>;

function makeEntryService(
  repo: EntryRepo,
  entity: string,
  categories: readonly string[],
) {
  return {
    async list(options: QueryOptions, actor: Session) {
      return repo.list(scopeToHospital(options, actor));
    },

    async get(id: number, actor: Session) {
      const row = await repo.getRow(id);
      assertOwnedByHospital(row, actor, "Entry");
      return toFinanceEntryDTO(row);
    },

    async create(input: unknown, actor: Session) {
      const data = validate(entrySchema(categories), input);
      const row = await repo.create({
        hospital_id: actor.hospitalId,
        category: data.category,
        description: data.description,
        invoice_number: data.invoiceNumber,
        amount: data.amount,
        entry_date: data.date || displayDate(),
      });
      await audit(actor, "create", entity, row.id);
      return toFinanceEntryDTO(row);
    },

    async update(id: number, input: unknown, actor: Session) {
      const existing = await repo.getRow(id);
      assertOwnedByHospital(existing, actor, "Entry");
      const data = validatePartial(entrySchema(categories), input);
      const patch: Record<string, unknown> = {};
      if ("category" in data) patch.category = data.category;
      if ("description" in data) patch.description = data.description;
      if ("invoiceNumber" in data) patch.invoice_number = data.invoiceNumber;
      if ("amount" in data) patch.amount = data.amount;
      if ("date" in data) patch.entry_date = data.date;
      const row = await repo.update(id, patch);
      await audit(actor, "update", entity, id, patch);
      return toFinanceEntryDTO(row as EntryRow);
    },

    async remove(id: number, actor: Session) {
      const existing = await repo.getRow(id);
      assertOwnedByHospital(existing, actor, "Entry");
      await repo.remove(id);
      await audit(actor, "delete", entity, id);
    },
  };
}

export const incomeService = makeEntryService(
  financeIncomesRepo as EntryRepo,
  "finance-income",
  INCOME_CATEGORIES,
);

export const expenseService = makeEntryService(
  financeExpensesRepo as EntryRepo,
  "finance-expense",
  EXPENSE_CATEGORIES,
);
