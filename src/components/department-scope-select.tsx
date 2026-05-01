"use client";

import { useMemo } from "react";
import { MultiSelectDropdown } from "./multi-select-dropdown";

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
  formId,
  initialScope,
}: {
  departments: DepartmentOption[];
  formId?: string;
  initialScope?: DepartmentScope;
}) {
  const initialValues = useMemo(
    () =>
      initialScope?.appliesToAllDepartments === false
        ? initialScope.departmentIds
        : ["all"],
    [initialScope],
  );
  const unavailableDepartmentIds = initialValues.filter(
    (id) => id !== "all" && !departments.some((department) => department.id === id),
  );
  const options = [
    { id: "all", label: "All Departments" },
    ...departments.map((department) => ({ id: department.id, label: department.name })),
    ...unavailableDepartmentIds.map((departmentId) => ({
      id: departmentId,
      inactive: true,
      label: departmentId,
    })),
  ];

  return (
    <MultiSelectDropdown
      clearLabel="Clear department scope"
      emptyLabel="No departments are available."
      initialSelected={initialValues}
      isClearDisabled={(selected) => selected.includes("all")}
      formId={formId}
      name="departmentScope"
      onNormalizeSelection={(next, previous) => {
        const selectedAll = next.includes("all");
        const selectedDepartments = next.filter((item) => item !== "all");
        if (selectedAll && !previous.includes("all")) return ["all"];
        return selectedDepartments;
      }}
      options={options}
      placeholder="Select department scope"
      summaryPluralLabel="departments"
    />
  );
}
