"use client";

import type { EscalationRecipientConfig, OrganizationEscalationContact } from "@/lib/types";
import { MultiSelectDropdown } from "./multi-select-dropdown";

const triggeredScheduleOption = "includeOrganizationContactsForTriggeredSchedule";

export function DepartmentRecipientMultiSelect({
  config,
}: {
  config: Pick<
    EscalationRecipientConfig,
    | "includeDepartmentEmail"
    | "includeDepartmentHeadEmail"
    | "includeDepartmentEscalationEmail"
  >;
}) {
  const initialSelected = [
    config.includeDepartmentEmail ? "includeDepartmentEmail" : "",
    config.includeDepartmentHeadEmail ? "includeDepartmentHeadEmail" : "",
    config.includeDepartmentEscalationEmail ? "includeDepartmentEscalationEmail" : "",
  ].filter(Boolean);

  return (
    <MultiSelectDropdown
      clearLabel="Clear department recipients"
      emptyLabel="No department recipient options are available."
      initialSelected={initialSelected}
      inputNameForOption={(id) => id}
      inputValueForOption={() => "on"}
      options={[
        { id: "includeDepartmentEmail", label: "Department Email" },
        { id: "includeDepartmentHeadEmail", label: "Department Head Email" },
        { id: "includeDepartmentEscalationEmail", label: "Department Escalation Email" },
      ]}
      placeholder="Select department recipients"
      summaryPluralLabel="department recipients"
    />
  );
}

export function OrganizationContactMultiSelect({
  config,
  contacts,
}: {
  config: Pick<
    EscalationRecipientConfig,
    | "includeOrganizationContactsForTriggeredSchedule"
    | "specificOrganizationContactIds"
  >;
  contacts: OrganizationEscalationContact[];
}) {
  const selectedContactIds = new Set(config.specificOrganizationContactIds);
  const initialSelected = [
    config.includeOrganizationContactsForTriggeredSchedule ? triggeredScheduleOption : "",
    ...config.specificOrganizationContactIds,
  ].filter(Boolean);
  const contactOptions = [
    ...contacts
      .filter((contact) => contact.enabled || selectedContactIds.has(contact.id))
      .map((contact) => ({
        group: "Specific Contacts",
        id: contact.id,
        inactive: !contact.enabled,
        label: `${contact.title} - ${contact.name} (${contact.email})`,
      })),
    ...config.specificOrganizationContactIds
      .filter((id) => !contacts.some((contact) => contact.id === id))
      .map((id) => ({
        group: "Specific Contacts",
        id,
        inactive: true,
        label: id,
      })),
  ];

  return (
    <MultiSelectDropdown
      clearLabel="Clear organization contacts"
      emptyLabel="No organization contacts are available."
      initialSelected={initialSelected}
      inputNameForOption={(id) =>
        id === triggeredScheduleOption
          ? "includeOrganizationContactsForTriggeredSchedule"
          : "specificOrganizationContactIds"
      }
      inputValueForOption={(id) => (id === triggeredScheduleOption ? "on" : id)}
      options={[
        {
          group: "Dynamic Contact Sources",
          id: triggeredScheduleOption,
          label: "Assigned contacts for triggered schedule",
        },
        ...contactOptions,
      ]}
      placeholder="Select organization contacts"
      summaryPluralLabel="organization contact options"
    />
  );
}
