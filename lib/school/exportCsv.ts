'use client'

import type { SchoolDepartmentDTO, SchoolTokenDTO } from '@/lib/db/school-types'

// Excel interprets a leading =, +, - or @ as a formula, so any field that
// starts with one is prefixed with a quote. Token codes and department names
// are user-editable, which is exactly how a CSV export turns into an injection.
function cell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value)
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return `"${safe.replace(/"/g, '""')}"`
}

function waitMinutes(token: SchoolTokenDTO): string {
  if (!token.calledAt) return ''
  const mins = Math.round(
    (new Date(token.calledAt).getTime() - new Date(token.joinedAt).getTime()) / 60000
  )
  return mins >= 0 ? String(mins) : ''
}

export function buildTokensCsv(
  tokens: SchoolTokenDTO[],
  departments: Map<string, SchoolDepartmentDTO>
): string {
  const header = [
    'Date', 'Token', 'Department', 'Status', 'Priority',
    'Issued at', 'Called at', 'Served at', 'Wait (minutes)', 'Times called', 'Source',
  ]

  const rows = tokens.map((t) => [
    t.serviceDate,
    t.tokenCode,
    departments.get(t.departmentId)?.nameEn ?? '',
    t.status,
    t.isPriority ? 'Yes' : 'No',
    t.joinedAt,
    t.calledAt ?? '',
    t.servedAt ?? '',
    waitMinutes(t),
    t.callCount,
    t.source,
  ])

  return [header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n')
}

export function downloadTokensCsv(
  tokens: SchoolTokenDTO[],
  departments: Map<string, SchoolDepartmentDTO>,
  filename: string
): void {
  // The BOM is what makes Excel read the Arabic department names as UTF-8.
  const blob = new Blob(['﻿' + buildTokensCsv(tokens, departments)], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
