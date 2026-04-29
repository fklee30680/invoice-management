"use client";

import { MultiSelectDropdown } from "./multi-select-dropdown";

type ScheduleOption = {
  id: string;
  name: string;
  enabled: boolean;
};

export function ScheduleMultiSelect({
  initialSelected = [],
  schedules,
}: {
  initialSelected?: string[];
  schedules: ScheduleOption[];
}) {
  const selectedSet = new Set(initialSelected);
  const options = [
    ...schedules
      .filter((schedule) => schedule.enabled || selectedSet.has(schedule.id))
      .map((schedule) => ({
        id: schedule.id,
        inactive: !schedule.enabled,
        label: schedule.name,
      })),
    ...initialSelected
      .filter((id) => !schedules.some((schedule) => schedule.id === id))
      .map((id) => ({ id, inactive: true, label: id })),
  ];

  return (
    <MultiSelectDropdown
      emptyLabel="No enabled escalation schedules are available."
      initialSelected={initialSelected}
      name="assignedScheduleIds"
      options={options}
      placeholder="Select schedules"
      summaryPluralLabel="schedules"
    />
  );
}
