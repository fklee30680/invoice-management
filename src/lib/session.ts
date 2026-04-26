import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readData } from "./store";
import type { Invoice, User } from "./types";

const SESSION_COOKIE = "invoice_user_id";

export async function currentUser(): Promise<User | undefined> {
  const cookieStore = await cookies();
  const userId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!userId) return undefined;
  const data = await readData();
  return data.users.find((user) => user.id === userId);
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireApUser() {
  const user = await requireUser();
  if (user.role !== "AP") redirect("/department");
  return user;
}

export function canAccessInvoice(user: User, invoice: Invoice) {
  if (user.role === "AP") return true;
  return Boolean(user.departmentId && user.departmentId === invoice.departmentId);
}

export { SESSION_COOKIE };
