/** Prefer Margaret (demo patient) when present; otherwise first roster row. */
export function pickDefaultPatientId(
  patients: ReadonlyArray<{ id: string }>,
  preferredId = "margaret-ellison",
): string | undefined {
  if (patients.length === 0) return undefined;
  if (patients.some((p) => p.id === preferredId)) return preferredId;
  return patients[0]?.id;
}
