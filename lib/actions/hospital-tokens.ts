'use server'

import { createSupabaseServiceClient } from '@/lib/db/server'
import {
  toHospitalTokenDTO, toHospitalVitalsDTO,
  type HospitalTokenDTO, type HospitalVitalsDTO, type HospitalStage,
  type DbHospitalToken, type DbHospitalVitals,
} from '@/lib/db/hospital-types'
import { isRegionLocale } from '@/lib/region'

export interface HospitalTokenResult {
  token?: HospitalTokenDTO
  waitingAhead?: number
  error?: string
}

// ── Board broadcast ───────────────────────────────────────────
// postgres_changes is not the transport here (the anon key can't read these
// patient-linked rows). Calls and recalls go out over a broadcast topic and the
// board's short poll is the state of record. Same mechanism as
// broadcastSchoolCall.
export interface HospitalCallSignal {
  tokenCode: string
  roomLabel: string
  doctorName: string | null
  departmentEn: string
  stage: HospitalStage
  priorityCategory: string | null
  recallCount: number
}

async function broadcastHospitalCall(
  branchId: string,
  event: 'token-called' | 'token-recalled',
  payload: HospitalCallSignal
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, apikey: key },
      body: JSON.stringify({
        messages: [{ topic: `hospital-display-${branchId}`, event, payload }],
      }),
    })
  } catch {
    /* Non-critical — the board still catches up on its safety poll. */
  }
}

// ── Room-token auth ───────────────────────────────────────────
interface VerifiedRoom {
  id: string
  customer_id: string
  branch_id: string
  department_id: string
  label: string
  current_doctor_id: string | null
  is_open: boolean
  is_active: boolean
}

async function verifyRoom(token: string): Promise<VerifiedRoom | null> {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('hospital_rooms')
    .select('id, customer_id, branch_id, department_id, label, current_doctor_id, is_open, is_active')
    .eq('room_token', token)
    .maybeSingle()

  if (!data || !(data as VerifiedRoom).is_active) return null
  return data as VerifiedRoom
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function departmentEn(supabase: any, departmentId: string | null): Promise<string> {
  if (!departmentId) return ''
  const { data } = await supabase
    .from('hospital_departments')
    .select('name')
    .eq('id', departmentId)
    .maybeSingle()
  const name = (data as { name?: Record<string, string> } | null)?.name
  return name?.en ?? ''
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function doctorName(supabase: any, doctorId: string | null): Promise<string | null> {
  if (!doctorId) return null
  const { data } = await supabase
    .from('hospital_doctors')
    .select('name')
    .eq('id', doctorId)
    .maybeSingle()
  return (data as { name: string } | null)?.name ?? null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logEvent(supabase: any, room: VerifiedRoom, token: DbHospitalToken, patch: {
  fromStatus?: string | null
  toStatus: string
  fromStage?: string | null
  toStage?: string | null
  message: string
}) {
  await supabase.from('hospital_token_events').insert({
    customer_id: room.customer_id,
    branch_id: room.branch_id,
    token_id: token.id,
    room_id: room.id,
    department_id: token.department_id,
    doctor_id: token.doctor_id,
    actor: 'room',
    from_status: patch.fromStatus ?? null,
    to_status: patch.toStatus,
    from_stage: patch.fromStage ?? null,
    to_stage: patch.toStage ?? null,
    token_code: token.token_code,
    message: patch.message,
  })
}

async function broadcastForToken(room: VerifiedRoom, token: DbHospitalToken, recall: boolean) {
  const supabase = createSupabaseServiceClient()
  await broadcastHospitalCall(room.branch_id, recall ? 'token-recalled' : 'token-called', {
    tokenCode: token.token_code,
    roomLabel: room.label,
    doctorName: await doctorName(supabase, token.doctor_id),
    departmentEn: await departmentEn(supabase, token.department_id),
    stage: token.stage,
    priorityCategory: token.priority_category,
    recallCount: token.recall_count,
  })
}

// ── Kiosk: issue a walk-in token ──────────────────────────────
// Authenticated by branch_token. The row commits here, before the caller
// attempts to print — a printer failure must never leave a patient with no
// number. No PII is captured at the kiosk (Phase 1): visit_id stays null.
export async function hospitalIssueTokenAction(
  branchToken: string,
  departmentId: string,
  doctorId: string | null,
  priorityCategory: string | null,
  locale?: string | null
): Promise<HospitalTokenResult> {
  const supabase = createSupabaseServiceClient()

  const { data: branch } = await supabase
    .from('branches')
    .select('id, is_active')
    .eq('branch_token', branchToken)
    .maybeSingle()

  if (!branch) return { error: 'Kiosk is not registered' }
  if (!(branch as { is_active: boolean }).is_active) return { error: 'This branch is not active' }

  const PRIORITY = ['senior', 'emergency', 'pregnant', 'differently-abled']
  const { data, error } = await supabase.rpc('claim_hospital_token', {
    p_branch_id: (branch as { id: string }).id,
    p_department_id: departmentId,
    p_doctor_id: doctorId,
    p_source: 'kiosk',
    p_priority_category: priorityCategory && PRIORITY.includes(priorityCategory) ? priorityCategory : null,
    p_locale: isRegionLocale(locale) ? locale : null,
  })

  if (error || !data) {
    // The RPC RAISEs a readable message for "doctor not in today" / "not an OPD
    // department" — surface it so the kiosk can say why.
    return { error: error?.message?.replace(/^.*:\s*/, '') || 'Could not issue a token. Please ask at reception.' }
  }

  const row = data as DbHospitalToken
  return { token: toHospitalTokenDTO(row), waitingAhead: await countWaitingAhead(supabase, row) }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function countWaitingAhead(supabase: any, row: DbHospitalToken): Promise<number | undefined> {
  // The queue is the DOCTOR for OPD, the DEPARTMENT for a service point.
  const q = supabase
    .from('hospital_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('branch_id', row.branch_id)
    .eq('service_date', row.service_date)
    .in('status', ['waiting', 'held'])
    .lt('joined_at', row.joined_at)

  const { count, error } = row.doctor_id
    ? await q.eq('doctor_id', row.doctor_id)
    : await q.eq('department_id', row.department_id)

  if (error) return undefined
  return count ?? 0
}

// ── Room: CALL NEXT ───────────────────────────────────────────
export async function hospitalCallNextAction(roomToken: string): Promise<HospitalTokenResult> {
  const room = await verifyRoom(roomToken)
  if (!room) return { error: 'Room not found' }

  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.rpc('call_next_hospital_token', { p_room_id: room.id })
  if (error) return { error: 'Could not call the next token' }

  // A plpgsql function returning a composite type materialises RETURN NULL as an
  // all-null row, not JSON null — that object is truthy. Test the primary key.
  const row = data as DbHospitalToken | null
  if (!row?.id) return { error: 'Nobody is waiting for this room' }

  await broadcastForToken(room, row, false)
  return { token: toHospitalTokenDTO(row) }
}

// ── Room: current-token helper ───────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function currentToken(supabase: any, roomId: string): Promise<DbHospitalToken | null> {
  const { data } = await supabase
    .from('hospital_tokens')
    .select('*')
    .eq('room_id', roomId)
    .eq('status', 'called')
    .maybeSingle()
  return (data as DbHospitalToken | null) ?? null
}

// ── Room: RECALL ─────────────────────────────────────────────
export async function hospitalRecallAction(roomToken: string): Promise<HospitalTokenResult> {
  const room = await verifyRoom(roomToken)
  if (!room) return { error: 'Room not found' }

  const supabase = createSupabaseServiceClient()
  const row = await currentToken(supabase, room.id)
  if (!row) return { error: 'Nothing to recall' }

  const { data: updated } = await supabase
    .from('hospital_tokens')
    .update({
      recall_count: row.recall_count + 1,
      call_count: row.call_count + 1,
      called_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .select()
    .single()

  const token = (updated ?? row) as DbHospitalToken
  await logEvent(supabase, room, token, {
    fromStatus: 'called', toStatus: 'called', toStage: token.stage,
    message: `${token.token_code} recalled (×${token.recall_count})`,
  })
  await broadcastForToken(room, token, true)
  return { token: toHospitalTokenDTO(token) }
}

// ── Room: DONE / NO SHOW / HOLD ──────────────────────────────
async function closeCurrent(
  roomToken: string,
  status: 'served' | 'no-show' | 'held',
  verb: string
): Promise<HospitalTokenResult> {
  const room = await verifyRoom(roomToken)
  if (!room) return { error: 'Room not found' }

  const supabase = createSupabaseServiceClient()
  const row = await currentToken(supabase, room.id)
  if (!row) return { error: 'No token at this room' }

  const { data: updated, error } = await supabase
    .from('hospital_tokens')
    .update({
      status,
      served_at: status === 'served' ? new Date().toISOString() : null,
      // A held token goes back into the pool unattached; a no-show stays
      // attributed to the room that called it, for the report.
      room_id: status === 'held' ? null : room.id,
    })
    .eq('id', row.id)
    .select()
    .single()

  if (error || !updated) return { error: `Could not mark ${row.token_code} ${verb}` }

  const token = updated as DbHospitalToken
  await logEvent(supabase, room, token, {
    fromStatus: 'called', toStatus: status, fromStage: token.stage, toStage: token.stage,
    message: `${token.token_code} ${verb} at ${room.label}`,
  })
  return { token: toHospitalTokenDTO(token) }
}

export async function hospitalDoneAction(roomToken: string) {
  return closeCurrent(roomToken, 'served', 'served')
}
export async function hospitalNoShowAction(roomToken: string) {
  return closeCurrent(roomToken, 'no-show', 'a no-show')
}
export async function hospitalHoldAction(roomToken: string) {
  return closeCurrent(roomToken, 'held', 'held')
}

// ── Room: SEND TO (transfer to a service point or back for review) ──
const STAGE_FOR_TYPE: Record<string, HospitalStage> = {
  lab: 'lab', radiology: 'radiology', pharmacy: 'pharmacy', billing: 'billing', triage: 'triage',
}

export async function hospitalSendToAction(
  roomToken: string,
  toDepartmentId: string,
  toDoctorId?: string | null
): Promise<HospitalTokenResult> {
  const room = await verifyRoom(roomToken)
  if (!room) return { error: 'Room not found' }

  const supabase = createSupabaseServiceClient()
  const row = await currentToken(supabase, room.id)
  if (!row) return { error: 'No token at this room' }

  const { data: dept } = await supabase
    .from('hospital_departments')
    .select('type, branch_id, is_active')
    .eq('id', toDepartmentId)
    .maybeSingle()
  const d = dept as { type: string; branch_id: string; is_active: boolean } | null
  if (!d || d.branch_id !== room.branch_id || !d.is_active) {
    return { error: 'That department is not available' }
  }
  // OPD target (the triage → consult hop) needs a doctor named; the service
  // points (lab/pharmacy/…) queue by department and take no doctor.
  if (d.type === 'opd' && !toDoctorId) return { error: 'Choose a doctor to send the patient to' }
  const stage = d.type === 'opd' ? 'consult' : STAGE_FOR_TYPE[d.type] ?? 'consult'

  const { data, error } = await supabase.rpc('transfer_hospital_token', {
    p_token_id: row.id,
    p_to_department_id: toDepartmentId,
    p_to_stage: stage,
    p_actor: 'room',
    p_restore_doctor: false,
    p_assign_doctor_id: d.type === 'opd' ? toDoctorId : null,
  })
  if (error || !data) return { error: error?.message?.replace(/^.*:\s*/, '') || `Could not send ${row.token_code} on` }

  return { token: toHospitalTokenDTO(data as DbHospitalToken) }
}

// Lab / radiology → the patient goes back to their doctor at stage 'review'.
export async function hospitalReportReadyAction(roomToken: string): Promise<HospitalTokenResult> {
  const room = await verifyRoom(roomToken)
  if (!room) return { error: 'Room not found' }

  const supabase = createSupabaseServiceClient()
  const row = await currentToken(supabase, room.id)
  if (!row) return { error: 'No token at this room' }
  if (!row.doctor_id) return { error: 'This token has no doctor to return to' }

  const { data: doc } = await supabase
    .from('hospital_doctors')
    .select('department_id')
    .eq('id', row.doctor_id)
    .maybeSingle()
  const toDept = (doc as { department_id: string } | null)?.department_id
  if (!toDept) return { error: 'Could not resolve the doctor’s department' }

  const { data, error } = await supabase.rpc('transfer_hospital_token', {
    p_token_id: row.id,
    p_to_department_id: toDept,
    p_to_stage: 'review',
    p_actor: 'room',
    p_restore_doctor: true,
  })
  if (error || !data) return { error: `Could not return ${row.token_code} for review` }

  return { token: toHospitalTokenDTO(data as DbHospitalToken) }
}

// ── Room: vitals (triage rooms) ──────────────────────────────
export interface HospitalVitalsResult {
  vitals?: HospitalVitalsDTO
  error?: string
}

export async function hospitalRecordVitalsAction(
  roomToken: string,
  input: {
    bpSystolic?: number | null
    bpDiastolic?: number | null
    spo2?: number | null
    tempC?: number | null
    weightKg?: number | null
    notes?: string
  }
): Promise<HospitalVitalsResult> {
  const room = await verifyRoom(roomToken)
  if (!room) return { error: 'Room not found' }

  const supabase = createSupabaseServiceClient()
  const row = await currentToken(supabase, room.id)
  if (!row) return { error: 'No token at this room' }

  const num = (v: number | null | undefined, lo: number, hi: number) =>
    typeof v === 'number' && v >= lo && v <= hi ? v : null

  const { data, error } = await supabase
    .from('hospital_vitals')
    .upsert({
      customer_id: room.customer_id,
      token_id: row.id,
      bp_systolic: num(input.bpSystolic, 40, 300),
      bp_diastolic: num(input.bpDiastolic, 20, 200),
      spo2: num(input.spo2, 40, 100),
      temp_c: num(input.tempC, 30, 45),
      weight_kg: num(input.weightKg, 1, 400),
      notes: (input.notes ?? '').slice(0, 500),
    }, { onConflict: 'token_id' })
    .select()
    .single()

  if (error || !data) return { error: 'Could not save vitals' }
  return { vitals: toHospitalVitalsDTO(data as DbHospitalVitals) }
}

// ── Room presence & open toggle ──────────────────────────────
export async function hospitalRoomHeartbeatAction(roomToken: string): Promise<void> {
  const supabase = createSupabaseServiceClient()
  await supabase
    .from('hospital_rooms')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('room_token', roomToken)
}

export async function hospitalToggleRoomOpenAction(
  roomToken: string
): Promise<{ isOpen?: boolean; error?: string }> {
  const room = await verifyRoom(roomToken)
  if (!room) return { error: 'Room not found' }

  const supabase = createSupabaseServiceClient()
  const next = !room.is_open
  const { error } = await supabase
    .from('hospital_rooms')
    .update({ is_open: next, updated_at: new Date().toISOString() })
    .eq('id', room.id)

  if (error) return { error: 'Could not update the room' }
  return { isOpen: next }
}
