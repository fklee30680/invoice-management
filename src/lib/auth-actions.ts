"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "./session";
import { readData } from "./store";

export async function signIn(formData: FormData) {
  const userId = String(formData.get("userId") || "");
  const data = await readData();
  const user = data.users.find((item) => item.id === userId);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  if (user?.role === "DEPARTMENT") {
    redirect("/department");
  }
  redirect("/");
}

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}
