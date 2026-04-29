"use client";

import { useMemo, useState } from "react";

type DepartmentOption = {
  id: string;
  name: string;
};

type DepartmentScope = {
  appliesToAllDepartments: boolean;
  departmentIds: string[];
};

export function DepartmentScopeSelect({
  departments,
  initialScope,
}: {
  departments: DepartmentOption[];
  initialScope?: DepartmentScope;
}) {
  const initialValues = useMemo(
    () =>
      initialScope?.appliesToAllDepartments === false
        ? initialScope.departmentIds
        : ["all"],
    [initialScope],
  );
  const [selected, setSelected] = useState<string[]>(initialValues);
  const appliesToAll = selected.includes("all");
  const value = appliesToAll ? ["all"] : selected;
  const unavailableDepartmentIds = selected.filter(
    (id) => id !== "all" && !departments.some((department) => department.id === id),
  );

  return (
    <div className="grid gap-2">
      <select
        className="focus-ring min-h-32 w-full border border-[var(--line)] bg-white px-3 py-2 text-sm"
        multiple
        name="departmentScope"
        onChange={(event) => {
          const values = Array.from(event.currentTarget.selectedOptions).map(
            (option) => option.value,
          );
          const selectedAll = values.includes("all");
          const selectedDepartments = values.filter((item) => item !== "all");
          setSelected((current) => {
            if (selectedAll && !current.includes("all")) return ["all"];
            return selectedAll && selectedDepartments.length === 0 ? ["all"] : selectedDepartments;
          });
        }}
        value={value}
      >
        <option value="all">All Departments</option>
        {departments.map((department) => (
          <option key={department.id} value={department.id}>
            {department.name}
          </option>
        ))}
        {unavailableDepartmentIds.map((departmentId) => (
          <option key={departmentId} value={departmentId}>
            {departmentId} (inactive)
          </option>
        ))}
      </select>
      <div className="text-xs text-[var(--muted)]">
        {appliesToAll
          ? "Applies to all departments."
          : selected.length
            ? `Applies to ${selected.length} selected department${selected.length === 1 ? "" : "s"}.`
            : "Select All Departments or at least one department."}
      </div>
    </div>
  );
}
