/**
 * Roles & access: what each role may do in each part of the app. The hospital's admin sets it; the server enforces it.
 *
 *   none  → hidden                       read  → view only
 *   add   → view and create new records  edit  → view, create and change
 *   write → everything, including delete (shown to people as "Full")
 */
export type AccessLevel = "none" | "read" | "add" | "edit" | "write";

export const ACCESS_LABEL: Record<AccessLevel, string> = { none: "No access", read: "Read only", add: "Add", edit: "Add & edit", write: "Full (with delete)" };
export const ACCESS_HELP: Record<AccessLevel, string> = {
  none: "Can't see it at all.",
  read: "Can look at records but not change anything.",
  add: "Can look at records and add new ones. Can't change or delete existing ones.",
  edit: "Can look, add and change records. Can't delete.",
  write: "Can look, add, change and delete.",
};

export interface RoleAccessDTO {
  /** Every part of the app that can be given a level. */
  resources: string[];
  levels: AccessLevel[];
  roles: {
    role: string;
    /** This role's levels can't be changed (the hospital's own admin always has everything). */
    locked: boolean;
    /** The levels every hospital starts with. */
    defaults: Record<string, AccessLevel>;
    /** The levels in force in this hospital. */
    current: Record<string, AccessLevel>;
    /** How many parts differ from the starting levels. */
    changed: number;
  }[];
}
