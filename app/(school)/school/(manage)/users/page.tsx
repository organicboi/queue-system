import { requireSchoolContext } from '@/lib/dal/school-context'
import { getUsers, getUserBranchMap } from '@/lib/dal/users'
import { UsersManager } from '@/components/admin/UsersManager'

export const dynamic = 'force-dynamic'

// User management is tenancy-level and identical for both products, so this
// reuses the existing manager wholesale rather than forking it.
export default async function SchoolUsersPage() {
  const { profile, branches } = await requireSchoolContext()
  const [users, userBranchMap] = await Promise.all([
    getUsers(profile.customerId),
    getUserBranchMap(profile.customerId),
  ])

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Users</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {users.length} team member{users.length !== 1 ? 's' : ''}
        </p>
      </div>
      <UsersManager
        users={users}
        branches={branches}
        currentUserId={profile.id}
        userBranchMap={userBranchMap}
      />
    </div>
  )
}
