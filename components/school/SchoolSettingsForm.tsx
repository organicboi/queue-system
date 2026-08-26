'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { saveSchoolSettingsAction } from '@/lib/actions/school-admin'
import type { SchoolSettingsDTO, SchoolLanguage } from '@/lib/db/school-types'

interface Props {
  branchId: string
  settings: SchoolSettingsDTO | null
  fallbackName: string
}

// Common Gulf timezones plus UTC. A school runs in one place; a free-text
// IANA field would only invite typos that silently break the daily reset.
const TIMEZONES = [
  'Asia/Qatar', 'Asia/Dubai', 'Asia/Riyadh', 'Asia/Bahrain',
  'Asia/Kuwait', 'Asia/Muscat', 'Asia/Kolkata', 'Europe/London', 'UTC',
]

export function SchoolSettingsForm({ branchId, settings, fallbackName }: Props) {
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    schoolNameEn: settings?.schoolNameEn || fallbackName,
    schoolNameAr: settings?.schoolNameAr ?? '',
    logoUrl: settings?.logoUrl ?? '',
    languages: (settings?.languages ?? ['en']) as SchoolLanguage[],
    ticketFooterEn: settings?.ticketFooterEn ?? '',
    ticketFooterAr: settings?.ticketFooterAr ?? '',
    kioskIdleSeconds: settings?.kioskIdleSeconds ?? 20,
    priorityEnabled: settings?.priorityEnabled ?? true,
    announceEnabled: settings?.announceEnabled ?? true,
    printEnabled: settings?.printEnabled ?? true,
    timezone: settings?.timezone ?? 'Asia/Qatar',
    dayStartTime: (settings?.dayStartTime ?? '00:00').slice(0, 5),
  })

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function toggleLanguage(lang: SchoolLanguage) {
    setForm((prev) => {
      const has = prev.languages.includes(lang)
      // At least one language must stay on or the kiosk has nothing to render.
      if (has && prev.languages.length === 1) return prev
      return {
        ...prev,
        languages: has ? prev.languages.filter((l) => l !== lang) : [...prev.languages, lang],
      }
    })
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveSchoolSettingsAction({ branchId, ...form })
      if (result.error) toast.error(result.error)
      else toast.success('Settings saved')
    })
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">School identity</h2>
        <div className="space-y-1.5">
          <Label htmlFor="schoolNameEn">School name</Label>
          <Input
            id="schoolNameEn"
            value={form.schoolNameEn}
            onChange={(e) => set('schoolNameEn', e.target.value)}
            maxLength={120}
          />
          <p className="text-[11px] text-muted-foreground">Shown on the TV board and printed on every ticket.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="schoolNameAr">School name (Arabic)</Label>
          <Input
            id="schoolNameAr"
            dir="rtl"
            value={form.schoolNameAr}
            onChange={(e) => set('schoolNameAr', e.target.value)}
            maxLength={120}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="logoUrl">Logo URL</Label>
          <Input
            id="logoUrl"
            value={form.logoUrl}
            onChange={(e) => set('logoUrl', e.target.value)}
            placeholder="https://…"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Kiosk</h2>
        <div className="space-y-2">
          <Label>Languages</Label>
          <div className="flex gap-2">
            {(['en', 'ar'] as SchoolLanguage[]).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => toggleLanguage(lang)}
                className={
                  form.languages.includes(lang)
                    ? 'rounded-xl border-2 border-accent-400 bg-accent-50 px-4 py-2 text-sm font-semibold text-accent-700'
                    : 'rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 active:bg-slate-50'
                }
              >
                {lang === 'en' ? 'English' : 'العربية'}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            With both on, the kiosk shows a language switch and the ticket prints bilingually.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="kioskIdleSeconds">Show the token for</Label>
          <div className="flex items-center gap-2">
            <Input
              id="kioskIdleSeconds"
              type="number"
              min={3}
              max={120}
              className="w-24"
              value={form.kioskIdleSeconds}
              onChange={(e) => set('kioskIdleSeconds', Number(e.target.value))}
            />
            <span className="text-sm text-muted-foreground">seconds, then reset</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ticketFooterEn">Ticket footer</Label>
          <Input
            id="ticketFooterEn"
            value={form.ticketFooterEn}
            onChange={(e) => set('ticketFooterEn', e.target.value)}
            maxLength={200}
            placeholder="Please watch the screen for your number"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ticketFooterAr">Ticket footer (Arabic)</Label>
          <Input
            id="ticketFooterAr"
            dir="rtl"
            value={form.ticketFooterAr}
            onChange={(e) => set('ticketFooterAr', e.target.value)}
            maxLength={200}
          />
        </div>
        <ToggleRow
          label="Print a ticket"
          hint="Turn off for a screen-only kiosk with no printer attached"
          checked={form.printEnabled}
          onChange={(v) => set('printEnabled', v)}
        />
        <ToggleRow
          label="Priority queue"
          hint="Adds a priority button to the kiosk for senior citizens and visitors needing assistance"
          checked={form.priorityEnabled}
          onChange={(v) => set('priorityEnabled', v)}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Display &amp; day</h2>
        <ToggleRow
          label="Announce calls aloud"
          hint="The TV reads each token and counter out loud when it is called"
          checked={form.announceEnabled}
          onChange={(v) => set('announceEnabled', v)}
        />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="timezone">Time zone</Label>
            <select
              id="timezone"
              value={form.timezone}
              onChange={(e) => set('timezone', e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-white px-2 text-sm"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dayStartTime">New day starts at</Label>
            <Input
              id="dayStartTime"
              type="time"
              value={form.dayStartTime}
              onChange={(e) => set('dayStartTime', e.target.value)}
            />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Token numbers restart from the beginning at this time, in this time zone. Set it to
          something like 06:00 if your reports should treat a late evening event as the same
          school day.
        </p>
      </section>

      <Button
        onClick={handleSave}
        disabled={pending}
        className="w-full bg-accent-600 hover:bg-accent-700 text-white"
      >
        {pending ? 'Saving…' : 'Save Settings'}
      </Button>
    </div>
  )
}

function ToggleRow({ label, hint, checked, onChange }: {
  label: string
  hint: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
