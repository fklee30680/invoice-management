"use client";

import { MultiSelectDropdown } from "./multi-select-dropdown";

type StatusOption = {
  id: string;
  includeInEscalation: boolean;
  label: string;
};

export function StatusMultiSelect({
  initialSelected = [],
  name = "statusIds",
  placeholder = "Select statuses",
  statuses,
}: {
  initialSelected?: string[];
  name?: string;
  placeholder?: string;
  statuses: StatusOption[];
}) {
  const selectedSet = new Set(initialSelected);
  const options = [
    ...statuses
      .filter((status) => status.includeInEscalation || selectedSet.has(status.id))
      .map((status) => ({
        id: status.id,
        inactive: !status.includeInEscalation,
        label: status.label,
      })),
    ...initialSelected
      .filter((id) => !statuses.some((status) => status.id === id))
      .map((id) => ({ id, inactive: true, label: id })),
  ];

  return (
    <MultiSelectDropdown
      emptyLabel="No escalation-enabled statuses are available."
      initialSelected={initialSelected}
      name={name}
      options={options}
      placeholder={placeholder}
      summaryPluralLabel="statuses"
    />
  );
}
