"use client";

import { MultiSelectDropdown } from "./multi-select-dropdown";

type StatusOption = {
  id: string;
  label: string;
};

export function StatusFilterSelect({
  formId,
  initialSelected = [],
  name = "statusIds",
  placeholder = "Select statuses",
  statuses,
}: {
  formId?: string;
  initialSelected?: string[];
  name?: string;
  placeholder?: string;
  statuses: StatusOption[];
}) {
  const selectedSet = new Set(initialSelected);
  const options = [
    ...statuses.map((status) => ({
      id: status.id,
      label: status.label,
    })),
    ...initialSelected
      .filter((id) => !statuses.some((status) => status.id === id))
      .map((id) => ({ id, inactive: true, label: id })),
  ];

  return (
    <MultiSelectDropdown
      emptyLabel="No statuses are available."
      formId={formId}
      initialSelected={[...selectedSet]}
      name={name}
      options={options}
      placeholder={placeholder}
      summaryPluralLabel="statuses"
    />
  );
}
