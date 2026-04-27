import Image from "next/image";
import { signIn } from "@/lib/auth-actions";
import { readData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const data = await readData();
  const branding = data.branding;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <form
        action={signIn}
        className="w-full max-w-md border border-[var(--line)] bg-[var(--panel)] p-6"
      >
        {branding.logo ? (
          <Image
            alt={`${branding.appTitle} logo`}
            className="mb-4 max-h-14 max-w-44 object-contain"
            height={56}
            src="/branding/logo"
            unoptimized
            width={176}
          />
        ) : null}
        <p className="text-sm font-semibold uppercase tracking-normal text-[var(--accent)]">
          {branding.appTitle}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-normal">Sign in</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Choose a seeded MVP account. This can be replaced by Microsoft login later.
        </p>
        <label className="mt-6 block text-xs font-semibold uppercase text-[var(--muted)]">
          Account
          <select
            className="focus-ring mt-1 min-h-11 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
            name="userId"
            required
          >
            {data.users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.role})
              </option>
            ))}
          </select>
        </label>
        <button className="focus-ring mt-5 w-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
          Continue
        </button>
      </form>
    </main>
  );
}
