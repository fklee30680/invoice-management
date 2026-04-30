import {
  addMenuItem,
  addSubmenuItem,
  deleteMenuItem,
  updateMenuSettings,
} from "@/lib/actions";
import {
  menuItemAvailable,
  menuTargetByHref,
  menuTargetOptions,
} from "@/lib/menu-registry";
import { requireApUser } from "@/lib/session";
import { readData } from "@/lib/store";
import type { MenuConfigItem, MenuRole } from "@/lib/types";
import { ResetMenuButton } from "@/components/reset-menu-button";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const roles: MenuRole[] = ["AP", "DEPARTMENT"];

export default async function MenuSetupPage() {
  await requireApUser();
  const data = await readData();
  const menuItems = [...data.menuSettings.items].sort((a, b) => a.order - b.order);
  const groups = menuItems.filter((item) => item.type === "group");
  const targets = menuTargetOptions();

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="border-b border-[var(--line)] pb-5">
          <h1 className="text-3xl font-semibold tracking-normal">Menu Setup</h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
            Configure the top navigation menu. Rename, hide, reorder, and group
            existing app pages.
          </p>
        </header>

        <form
          action={updateMenuSettings}
          className="space-y-5 border border-[var(--line)] bg-[var(--panel)] p-4"
        >
          <section className="space-y-3">
            <div>
              <h2 className="text-base font-semibold">Top-Level Menu</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Order controls left-to-right placement. Locked items stay enabled.
              </p>
            </div>
            <div className="overflow-x-auto border border-[var(--line)] bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[var(--panel-strong)] text-xs uppercase text-[var(--muted)]">
                  <tr>
                    <th className="px-3 py-2">Order</th>
                    <th className="px-3 py-2">Label</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Destination</th>
                    <th className="px-3 py-2">Roles</th>
                    <th className="px-3 py-2">Enabled</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {menuItems.map((item) => (
                    <MenuConfigRow item={item} key={item.id} targets={targets} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-base font-semibold">Submenus</h2>
            {groups.map((group) => (
              <div className="border border-[var(--line)] bg-white p-3" key={group.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">{group.label}</h3>
                  <span className="text-xs text-[var(--muted)]">
                    {(group.children || []).length} links
                  </span>
                </div>
                <div className="mt-3 overflow-x-auto border border-[var(--line)]">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-[var(--panel-strong)] text-xs uppercase text-[var(--muted)]">
                      <tr>
                        <th className="px-3 py-2">Order</th>
                        <th className="px-3 py-2">Label</th>
                        <th className="px-3 py-2">Destination</th>
                        <th className="px-3 py-2">Roles</th>
                        <th className="px-3 py-2">Enabled</th>
                        <th className="px-3 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(group.children || [])
                        .sort((a, b) => a.order - b.order)
                        .map((child) => (
                          <MenuConfigRow
                            childOf={group.id}
                            item={child}
                            key={child.id}
                            targets={targets}
                          />
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </section>

          <div className="flex justify-end">
            <button className="focus-ring bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
              Save Menu Setup
            </button>
          </div>
        </form>

        {menuItems.map((item) => (
          <DeleteMenuForm item={item} key={`delete-${item.id}`} />
        ))}

        <section className="grid gap-4 lg:grid-cols-2">
          <form
            action={addMenuItem}
            className="space-y-3 border border-[var(--line)] bg-[var(--panel)] p-4"
          >
            <h2 className="text-base font-semibold">Add Menu Item</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold uppercase text-[var(--muted)]">
                Type
                <select
                  className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
                  name="itemType"
                >
                  <option value="link">Direct Link</option>
                  <option value="group">Dropdown Group</option>
                </select>
              </label>
              <label className="text-xs font-semibold uppercase text-[var(--muted)]">
                Label
                <input
                  className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
                  name="label"
                  placeholder="Menu label"
                />
              </label>
            </div>
            <DestinationSelect required={false} targets={targets} />
            <RoleCheckboxes name="roles" selected={["AP"]} />
            <button className="focus-ring bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
              Add Menu Item
            </button>
          </form>

          <form
            action={addSubmenuItem}
            className="space-y-3 border border-[var(--line)] bg-[var(--panel)] p-4"
          >
            <h2 className="text-base font-semibold">Add Submenu Link</h2>
            <label className="text-xs font-semibold uppercase text-[var(--muted)]">
              Dropdown Group
              <select
                className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
                name="groupId"
                required
              >
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase text-[var(--muted)]">
              Label
              <input
                className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
                name="label"
                placeholder="Use page label"
              />
            </label>
            <DestinationSelect targets={targets} />
            <button className="focus-ring bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
              Add Submenu Link
            </button>
          </form>
        </section>

        <section className="border border-[var(--line)] bg-[var(--panel)] p-4">
          <h2 className="text-base font-semibold">Available Pages</h2>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {targets.map((target) => (
              <div className="border border-[var(--line)] bg-white p-3" key={target.id}>
                <div className="font-semibold">{target.label}</div>
                <div className="text-xs text-[var(--muted)]">{target.href}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="border border-red-200 bg-white p-4">
          <h2 className="text-base font-semibold text-red-800">Reset</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Restore the default menu layout without changing invoices, users, or other
            settings.
          </p>
          <div className="mt-3">
            <ResetMenuButton />
          </div>
        </section>
      </div>
    </main>
  );
}

function MenuConfigRow({
  childOf,
  item,
  targets,
}: {
  childOf?: string;
  item: MenuConfigItem;
  targets: ReturnType<typeof menuTargetOptions>;
}) {
  const unavailable = item.type === "link" && !menuItemAvailable(item);

  return (
    <tr className="border-t border-[var(--line)] align-top">
      <td className="px-3 py-2">
        {childOf ? <input name={`childId-${childOf}`} type="hidden" value={item.id} /> : null}
        {!childOf ? <input name="menuItemId" type="hidden" value={item.id} /> : null}
        <input
          className="focus-ring min-h-9 w-16 border border-[var(--line)] px-2"
          defaultValue={item.order}
          min={1}
          name={`order-${item.id}`}
          step={1}
          type="number"
        />
      </td>
      <td className="px-3 py-2">
        <input
          className="focus-ring min-h-9 w-52 border border-[var(--line)] px-2"
          defaultValue={item.label}
          name={`label-${item.id}`}
          required
        />
        {item.locked ? (
          <div className="mt-1 text-xs text-[var(--muted)]">Locked</div>
        ) : null}
      </td>
      <td className="px-3 py-2">
        <input name={`type-${item.id}`} type="hidden" value={item.type} />
        <span className="text-sm capitalize">{item.type === "group" ? "Dropdown" : "Link"}</span>
      </td>
      <td className="px-3 py-2">
        {item.type === "link" ? (
          <>
            <DestinationSelect
              currentHref={item.href}
              disabled={item.locked}
              name={`href-${item.id}`}
              targets={targets}
            />
            {item.locked ? <input name={`href-${item.id}`} type="hidden" value={item.href} /> : null}
            {unavailable ? (
              <div className="mt-1 text-xs text-red-700">Unavailable route</div>
            ) : null}
          </>
        ) : (
          <span className="text-sm text-[var(--muted)]">Dropdown group</span>
        )}
      </td>
      <td className="px-3 py-2">
        <RoleCheckboxes
          disabled={item.locked}
          name={`roles-${item.id}`}
          selected={item.roles}
        />
        {item.locked
          ? item.roles.map((role) => (
              <input key={role} name={`roles-${item.id}`} type="hidden" value={role} />
            ))
          : null}
      </td>
      <td className="px-3 py-2">
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            className="h-4 w-4 accent-[var(--accent)]"
            defaultChecked={item.enabled}
            disabled={item.locked}
            name={`enabled-${item.id}`}
            type="checkbox"
          />
          Show
        </label>
      </td>
      <td className="px-3 py-2">
        {!item.locked ? (
          <button
            className="focus-ring border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
            form={`delete-menu-item-${childOf || "top"}-${item.id}`}
            type="submit"
          >
            Delete
          </button>
        ) : (
          <span className="text-xs text-[var(--muted)]">Protected</span>
        )}
      </td>
    </tr>
  );
}

function DestinationSelect({
  currentHref,
  disabled = false,
  name = "href",
  required = true,
  targets,
}: {
  currentHref?: string;
  disabled?: boolean;
  name?: string;
  required?: boolean;
  targets: ReturnType<typeof menuTargetOptions>;
}) {
  const currentTarget = menuTargetByHref(currentHref);

  return (
    <select
      className="focus-ring min-h-9 w-64 border border-[var(--line)] bg-white px-2 text-sm"
      defaultValue={currentHref || ""}
      disabled={disabled}
      name={name}
      required={required}
    >
      <option value="">Select page</option>
      {currentHref && !currentTarget ? (
        <option value={currentHref}>{currentHref} - unavailable</option>
      ) : null}
      {targets.map((target) => (
        <option key={target.id} value={target.href}>
          {target.label} - {target.href}
        </option>
      ))}
    </select>
  );
}

function RoleCheckboxes({
  disabled = false,
  name,
  selected,
}: {
  disabled?: boolean;
  name: string;
  selected: MenuRole[];
}) {
  return (
    <div className="flex flex-col gap-1">
      {roles.map((role) => (
        <label className="inline-flex items-center gap-2 text-xs" key={role}>
          <input
            className="h-4 w-4 accent-[var(--accent)]"
            defaultChecked={selected.includes(role)}
            disabled={disabled}
            name={name}
            type="checkbox"
            value={role}
          />
          {role === "AP" ? "AP" : "Department"}
        </label>
      ))}
    </div>
  );
}

function DeleteMenuForm({ item }: { item: MenuConfigItem }) {
  return (
    <>
      <form
        action={deleteMenuItem}
        className="hidden"
        id={`delete-menu-item-top-${item.id}`}
      >
        <input name="itemId" type="hidden" value={item.id} />
      </form>
      {(item.children || []).map((child) => (
        <form
          action={deleteMenuItem}
          className="hidden"
          id={`delete-menu-item-${item.id}-${child.id}`}
          key={child.id}
        >
          <input name="parentId" type="hidden" value={item.id} />
          <input name="itemId" type="hidden" value={child.id} />
        </form>
      ))}
    </>
  );
}
