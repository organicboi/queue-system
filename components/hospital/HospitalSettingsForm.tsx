'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Lock, QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { saveHospitalSettingsAction } from '@/lib/actions/hospital-admin'
import type { HospitalSettingsDTO } from '@/lib/db/hospital-types'
import type { Locale } from '@/lib/region'
import {
  coerceLocales, defaultLocale, dirFor, LOCALE_LABEL, pickLocale, region, regionLocales,
} from '@/lib/region'

interface Props {
  branchId: string
  settings: HospitalSettingsDTO | null
  fallbackName: string
  publicTrackingGranted: boolean
}

const ALL_TIMEZONES = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Qatar', 'Asia/Riyadh', 'Asia/Kathmandu',
  'Asia/Colombo', 'Asia/Dhaka', 'Europe/London', 'UTC',
]
const TIMEZONES = [
  region().defaultTimezone,
  ...ALL_TIMEZONES.filter((tz) => tz !== region().defaultTimezone),
]

// India OPD tickets read C104 — the prefix spelled, then the digits. {token}
// and {room} are the placeholders the announcer fills.
const DEFAULT_ANNOUNCE = 'Token {token}, please proceed to {room}'

export function HospitalSettingsForm({ branchId, settings, fallbackName, publicTrackingGranted }: Props) {
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    languages: coerceLocales(settings?.languages).slice(0, 3),
    ticketFooter: Object.fromEntries(
      regionLocales().map((l) => [l, settings?.ticketFooter?.[l] ?? '']),
    ) as Record<Locale, string>,
    announceTemplate: Object.fromEntries(
      regionLocales().map((l) => [l, settings?.announceTemplate?.[l] ?? '']),
    ) as Record<Locale, string>,
    kioskIdleSeconds: settings?.kioskIdleSeconds ?? 20,
    priorityEnabled: settings?.priorityEnabled ?? true,
    priorityGraceMinutes: settings?.priorityGraceMinutes ?? 10,
    announceEnabled: settings?.announceEnabled ?? true,
    printEnabled: settings?.printEnabled ?? true,
    apptWalkinRatio: settings?.apptWalkinRatio ?? 2,
    followupFreeDays: settings?.followupFreeDays ?? 7,
    patientDataRetentionDays: settings?.patientDataRetentionDays ?? null as number | null,
    publicTrackingEnabled: settings?.publicTrackingEnabled ?? true,
    timezone: settings?.timezone ?? region().defaultTimezone,
    dayStartTime: (settings?.dayStartTime ?? '00:00').slice(0, 5),
  })

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function toggleLanguage(lang: Locale) {
    if (lang === defaultLocale()) return
    setForm((prev) => {
      const has = prev.languages.includes(lang)
      const next = has
        ? prev.languages.filter((l) => l !== lang)
        : regionLocales().filter((l) => l === lang || prev.languages.includes(l))
      return { ...prev, languages: next.slice(0, 3) }
    })
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveHospitalSettingsAction({ branchId, ...form })
      if (result.error) toast.error(result.error)
      else toast.success('Settings saved')
    })
  }

  const identityName = pickLocale(settings?.hospitalName, defaultLocale()) || fallbackName

  return (
    <div className="space-y-4">
      {/* Read-only: the name and logo brand the board and every ticket, so they
          belong to whoever sold the system. The server action ignores them. */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-800">Hospital identity</h2>
          <span className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
            <Lock className="size-3" />
            Set by your provider
          </span>
        </div>
        <div className="flex items-center gap-3">
          {settings?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={settings.logoUrl}
              alt=""
              className="size-12 shrink-0 rounded-xl border border-slate-200 object-contain bg-white"
            />
          ) : (
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-300 text-[10px] text-slate-400">
              No logo
            </div>
          )}
          <p className="truncate text-sm font-semibold text-slate-800">{identityName}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Kiosk</h2>
        <div className="space-y-2">
          <Label>Languages (up to 3)</Label>
          <div className="flex flex-wrap gap-2">
            {regionLocales().map((lang) => {
              const on = form.languages.includes(lang)
              const locked = lang === defaultLocale()
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => toggleLanguage(lang)}
                  disabled={locked}
                  dir={dirFor(lang)}
                  className={
                    on
                      ? 'rounded-xl border-2 border-accent-400 bg-accent-50 px-4 py-2 text-sm font-semibold text-accent-700 disabled:opacity-100'
                      : 'rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 active:bg-slate-50'
                  }
                >
                  {LOCALE_LABEL[lang]}
                </button>
              )
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {LOCALE_LABEL[defaultLocale()]} is always on. Applies to the kiosk UI, the printed
            token, board text and the voice announcement.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="kioskIdleSeconds">Show the token for</Label>
          <div className="flex items-center gap-2">
            <Input
              id="kioskIdleSeconds" type="number" min={3} max={120} className="w-24"
              value={form.kioskIdleSeconds}
              onChange={(e) => set('kioskIdleSeconds', Number(e.target.value))}
            />
            <span className="text-sm text-muted-foreground">seconds, then reset</span>
          </div>
        </div>
        {regionLocales().map((l, i) => (
          <div key={l} className="space-y-1.5">
            <Label htmlFor={`ticketFooter_${l}`}>
              {i === 0 ? 'Ticket footer' : `Ticket footer (${LOCALE_LABEL[l]})`}
            </Label>
            <Input
              id={`ticketFooter_${l}`}
              dir={dirFor(l)}
              value={form.ticketFooter[l] ?? ''}
              onChange={(e) => set('ticketFooter', { ...form.ticketFooter, [l]: e.target.value })}
              maxLength={200}
              placeholder={i === 0 ? 'Watch the board for your token. Keep this slip.' : undefined}
            />
          </div>
        ))}
        <ToggleRow
          label="Print a token"
          hint="Turn off for a screen-only kiosk with no printer attached"
          checked={form.printEnabled}
          onChange={(v) => set('printEnabled', v)}
        />
        <ToggleRow
          label="Priority categories"
          hint="Adds a self-declared priority toggle for senior citizens, pregnant, emergency and differently-abled patients"
          checked={form.priorityEnabled}
          onChange={(v) => set('priorityEnabled', v)}
        />
        {form.priorityEnabled && (
          <div className="space-y-1.5">
            <Label htmlFor="priorityGraceMinutes">Priority grace window</Label>
            <div className="flex items-center gap-2">
              <Input
                id="priorityGraceMinutes" type="number" min={0} max={120} className="w-24"
                value={form.priorityGraceMinutes}
                onChange={(e) => set('priorityGraceMinutes', Number(e.target.value))}
              />
              <span className="text-sm text-muted-foreground">minutes</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              A priority patient jumps ahead only of people who have waited less than this — so the
              normal lane is never starved.
            </p>
          </div>
        )}
        {publicTrackingGranted ? (
          <ToggleRow
            label="Public token tracking (QR)"
            hint="Prints a QR on every token linking to a live waiting-position page patients check from their own phone"
            checked={form.publicTrackingEnabled}
            onChange={(v) => set('publicTrackingEnabled', v)}
          />
        ) : (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-dashed border-slate-200 px-3 py-2.5 opacity-70">
            <div className="min-w-0 flex items-center gap-2">
              <QrCode className="size-4 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-600">Public token tracking (QR)</p>
                <p className="text-[11px] text-muted-foreground">
                  Not included in your plan. Ask your provider to add it.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Board &amp; announcements</h2>
        <ToggleRow
          label="Announce calls aloud"
          hint="The board reads each token and room out loud when it is called"
          checked={form.announceEnabled}
          onChange={(v) => set('announceEnabled', v)}
        />
        {form.announceEnabled && regionLocales().map((l, i) => (
          <div key={l} className="space-y-1.5">
            <Label htmlFor={`announceTemplate_${l}`}>
              {i === 0 ? 'Announcement wording' : `Announcement wording (${LOCALE_LABEL[l]})`}
            </Label>
            <Input
              id={`announceTemplate_${l}`}
              dir={dirFor(l)}
              value={form.announceTemplate[l] ?? ''}
              onChange={(e) => set('announceTemplate', { ...form.announceTemplate, [l]: e.target.value })}
              maxLength={200}
              placeholder={i === 0 ? DEFAULT_ANNOUNCE : undefined}
            />
          </div>
        ))}
        {form.announceEnabled && (
          <p className="text-[11px] text-muted-foreground">
            Use <code>{'{token}'}</code> and <code>{'{room}'}</code> as placeholders. Left blank, the
            board uses “{DEFAULT_ANNOUNCE}”.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Queue behaviour &amp; day</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="apptWalkinRatio">Appointments per walk-in</Label>
            <Input
              id="apptWalkinRatio" type="number" min={1} max={20}
              value={form.apptWalkinRatio}
              onChange={(e) => set('apptWalkinRatio', Number(e.target.value))}
            />
            <p className="text-[11px] text-muted-foreground">
              Serve this many appointments before a walk-in when both are waiting (Phase 2).
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="followupFreeDays">Free follow-up window</Label>
            <div className="flex items-center gap-2">
              <Input
                id="followupFreeDays" type="number" min={0} max={90} className="w-24"
                value={form.followupFreeDays}
                onChange={(e) => set('followupFreeDays', Number(e.target.value))}
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="retention">Patient data retention</Label>
          <div className="flex items-center gap-2">
            <Input
              id="retention" type="number" min={0} max={3650} className="w-28"
              value={form.patientDataRetentionDays ?? ''}
              placeholder="Keep"
              onChange={(e) =>
                set('patientDataRetentionDays', e.target.value === '' ? null : Number(e.target.value))
              }
            />
            <span className="text-sm text-muted-foreground">days after a visit completes</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            DPDP Act 2023: patient contact details are cleared this many days after the visit ends.
            Leave blank to keep until you set a policy.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="timezone">Time zone</Label>
            <select
              id="timezone"
              value={form.timezone}
              onChange={(e) => set('timezone', e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-white px-2 text-sm"
            >
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dayStartTime">New day starts at</Label>
            <Input
              id="dayStartTime" type="time"
              value={form.dayStartTime}
              onChange={(e) => set('dayStartTime', e.target.value)}
            />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Token numbers restart at this time, in this time zone.
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
