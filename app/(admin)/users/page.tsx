import { requireAdmin } from '@/lib/dal/session'
import { getUsers } from '@/lib/dal/users'
import { getBranches } from '@/lib/dal/branches'
import { UsersManager } from '@/components/admin/UsersManager'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const profile = await requireAdmin()
  const [users, branches] = await Promise.all([
    getUsers(profile.customerId),
    getBranches(profile.customerId),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{users.length} team member{users.length !== 1 ? 's' : ''}</p>
        </div>
      </div>
      <UsersManager users={users} branches={branches} currentUserId={profile.id} />
    </div>
  )
}
