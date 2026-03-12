import { TABLE_SECTIONS, TABLE_DISPLAY_GROUPS } from '@/lib/constants'

/**
 * Returns the display name with section prefix, e.g., "C8", "GB4", "F12"
 */
export function getTableDisplayName(table: { number: number; section: string }): string {
  const sectionDef = TABLE_SECTIONS.find(s => s.value === table.section)
  const prefix = sectionDef?.prefix || ''
  return `${prefix}${table.number}`
}

/**
 * Returns the section prefix alone, e.g., "C", "GB", "F"
 */
export function getSectionPrefix(section: string): string {
  return TABLE_SECTIONS.find(s => s.value === section)?.prefix || ''
}

/**
 * Groups tables by display group (Coffee, Ground, First) with sub-sections merged.
 * Regular tables appear first, then box tables, both sorted by number.
 */
export function groupTablesByDisplayGroup<T extends { number: number; section: string }>(
  tables: T[],
): { group: string; label: string; tables: T[] }[] {
  return TABLE_DISPLAY_GROUPS.map(dg => ({
    group: dg.group,
    label: dg.label,
    tables: tables
      .filter(t => (dg.sections as readonly string[]).includes(t.section))
      .sort((a, b) => {
        // Regular tables first, then box tables; within each, sort by number
        const sections = dg.sections as readonly string[]
        const aIdx = sections.indexOf(a.section)
        const bIdx = sections.indexOf(b.section)
        if (aIdx !== bIdx) return aIdx - bIdx
        return a.number - b.number
      }),
  })).filter(g => g.tables.length > 0)
}
