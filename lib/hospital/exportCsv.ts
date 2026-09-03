'use client'

import type { HospitalDepartmentDTO, HospitalTokenDTO } from '@/lib/db/hospital-types'
import { pickLocale } from '@/lib/region'

// Excel reads a leading =, +, - or @ as a formula, so any field starting with
// one is quote-prefixed — token codes and department names are user-editable,
// which is exactly how a CSV export turns into an injection.
function cell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value)
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return `"${safe.replace(/"/g, '""')}"`
}

function waitMinutes(t: HospitalTokenDTO): string {
  if (!t.calledAt) return ''
  const m = Math.round((new Date(t.calledAt).getTime() - new Date(t.joinedAt).getTime()) / 60000)
  return m >= 0 ? String(m) : ''
}

export function buildHospitalTokensCsv(
  tokens: HospitalTokenDTO[],
  departments: Map<string, HospitalDepartmentDTO>
): string {
  const header = [
    'Date', 'Token', 'Department', 'Stage', 'Status', 'Priority',
    'Issued at', 'Called at', 'Served at', 'Wait (minutes)', 'Times called', 'Source',
  ]
  const rows = tokens.map((t) => [
    t.serviceDate,
    t.tokenCode,
    pickLocale(departments.get(t.departmentId)?.name, 'en'),
    t.stage,
    t.status,
    t.priorityCategory ?? '',
    t.joinedAt,
    t.calledAt ?? '',
    t.servedAt ?? '',
    waitMinutes(t),
    t.callCount,
    t.source,
  ])
  return [header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n')
}

export function downloadHospitalTokensCsv(
  tokens: HospitalTokenDTO[],
  departments: Map<string, HospitalDepartmentDTO>,
  filename: string
): void {
  const blob = new Blob(['﻿' + buildHospitalTokensCsv(tokens, departments)], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
