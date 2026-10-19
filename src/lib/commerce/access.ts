import { createAccessControl } from "better-auth/plugins/access";

/**
 * Desk roles, using Better Auth's access-control helper
 * (github.com/better-auth/better-auth, plugins/access).
 *
 * Owner is the parent account and the only role that can see cost and profit.
 * A manager runs the desk. Staff can only ship and count stock.
 */
const statement = {
  order: ["read", "fulfill", "refund"],
  catalog: ["read", "update"],
  inventory: ["read", "adjust"],
  customer: ["read"],
  money: ["read"],
  settings: ["update"],
  team: ["manage"],
} as const;

const ac = createAccessControl(statement);

export const roles = {
  owner: ac.newRole({
    order: ["read", "fulfill", "refund"],
    catalog: ["read", "update"],
    inventory: ["read", "adjust"],
    customer: ["read"],
    money: ["read"],
    settings: ["update"],
    team: ["manage"],
  }),
  manager: ac.newRole({
    order: ["read", "fulfill", "refund"],
    catalog: ["read", "update"],
    inventory: ["read", "adjust"],
    customer: ["read"],
    settings: ["update"],
  }),
  staff: ac.newRole({
    order: ["read", "fulfill"],
    inventory: ["read", "adjust"],
  }),
} as const;

export type DeskRole = keyof typeof roles;

/** Seats besides the owner. */
export const STAFF_CAP = 10;

type Request = Parameters<(typeof roles)["owner"]["authorize"]>[0];

export function can(role: DeskRole, request: Request, connector?: "OR" | "AND") {
  return roles[role].authorize(request, connector).success;
}

export function deskPermissions(role: DeskRole) {
  return {
    orders: can(role, { order: ["read"] }),
    fulfill: can(role, { order: ["fulfill"] }),
    refund: can(role, { order: ["refund"] }),
    catalog: can(role, { catalog: ["read"] }),
    inventory: can(role, { inventory: ["read"] }),
    inventoryWrite: can(role, { inventory: ["adjust"] }),
    customers: can(role, { customer: ["read"] }),
    money: can(role, { money: ["read"] }),
    settings: can(role, { settings: ["update"] }),
    team: can(role, { team: ["manage"] }),
  };
}

export type DeskPermissions = ReturnType<typeof deskPermissions>;
export type PermissionRequest = Request;
