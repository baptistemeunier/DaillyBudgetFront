/** Readable message of a failed API call (422 violations, problem detail…). */
export function apiErrorMessage(e: unknown, fallback = i18nT('errors.saveFailed')): string {
  const data = (e as { data?: { violations?: { message: string }[]; detail?: string } }).data
  return data?.violations?.map((v) => v.message).join(' ') || data?.detail || fallback
}

export function apiErrorStatus(e: unknown): number | undefined {
  return (e as { status?: number; statusCode?: number }).status ?? (e as { statusCode?: number }).statusCode
}
