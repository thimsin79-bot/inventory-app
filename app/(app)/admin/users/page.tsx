'use client'

import { useCallback, useState } from 'react'
import {
  createAdminUser,
  deleteAdminUser,
  getAdminUsers,
  updateAdminUser,
  writeAdminSecret,
  type AdminUser,
} from '@/services/adminUsersService'
import { errorMessage } from '@/utils/errors'
import { formatDate } from '@/utils/format'
import { useAsyncData } from '@/hooks/useAsyncData'
import { AsyncBoundary } from '@/components/AsyncBoundary'
import { ScreenGate } from '@/components/ScreenGate'
import { useAuth } from '@/components/AuthProvider'
import { DataTable, type Column } from '@/components/DataTable'
import { Modal } from '@/components/Modal'
import { PermissionPicker } from '@/components/PermissionPicker'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  PageHeader,
} from '@/components/ui'
import type { PermissionKey } from '@/lib/permissions'

const EMPTY_CREATE = { email: '', password: '', permissions: [] as PermissionKey[] }

function isBanned(user: AdminUser): boolean {
  return user.banned_until !== null && new Date(user.banned_until).getTime() > Date.now()
}

export default function AdminUsersPage() {
  const { can } = useAuth()
  const manage = can('admin.manage')
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_CREATE)
  const [createErrors, setCreateErrors] = useState<{ email?: string; password?: string }>({})
  const [editingPerms, setEditingPerms] = useState<AdminUser | null>(null)
  const [permDraft, setPermDraft] = useState<PermissionKey[]>([])
  const [resettingPw, setResettingPw] = useState<AdminUser | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [banning, setBanning] = useState<AdminUser | null>(null)
  const [deleting, setDeleting] = useState<AdminUser | null>(null)

  const [secretInput, setSecretInput] = useState('')
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)

  const loadUsers = useCallback(async () => {
    try {
      return await getAdminUsers()
    } finally {
      setVerifying(false)
    }
  }, [])

  const users = useAsyncData(loadUsers)

  const locked = users.errorCode === 'ADMIN_SECRET'

  function submitUnlock() {
    const value = secretInput.trim()
    if (!value) {
      setUnlockError('Enter the admin console secret.')
      return
    }
    setUnlockError(null)
    writeAdminSecret(value)
    setVerifying(true)
    users.reload()
  }

  const run = useCallback(
    async (fn: () => Promise<unknown>, success: string) => {
      setBusy(true)
      setActionError(null)
      try {
        await fn()
        setNotice(success)
        users.reload()
        return true
      } catch (e) {
        setActionError(errorMessage(e))
        return false
      } finally {
        setBusy(false)
      }
    },
    [users],
  )

  function openCreate() {
    setCreateForm(EMPTY_CREATE)
    setCreateErrors({})
    setActionError(null)
    setCreating(true)
  }

  async function submitCreate() {
    const errors: { email?: string; password?: string } = {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createForm.email)) {
      errors.email = 'Enter a valid email address.'
    }
    if (createForm.password.length < 8 || createForm.password.length > 256) {
      errors.password = 'Password must be between 8 and 256 characters.'
    }
    setCreateErrors(errors)
    if (Object.keys(errors).length > 0) return

    const ok = await run(
      () =>
        createAdminUser({
          email: createForm.email,
          password: createForm.password,
          permissions: createForm.permissions,
        }),
      `Created ${createForm.email.trim().toLowerCase()}`,
    )
    if (ok) setCreating(false)
  }

  async function submitPermissions() {
    if (!editingPerms) return
    const ok = await run(
      () => updateAdminUser(editingPerms.id, { permissions: permDraft }),
      `Updated permissions for ${editingPerms.email}`,
    )
    if (ok) setEditingPerms(null)
  }

  async function submitPassword() {
    if (!resettingPw) return
    if (newPassword.length < 8 || newPassword.length > 256) {
      setActionError('Password must be between 8 and 256 characters.')
      return
    }
    const ok = await run(
      () => updateAdminUser(resettingPw.id, { password: newPassword }),
      `Reset password for ${resettingPw.email}`,
    )
    if (ok) {
      setResettingPw(null)
      setNewPassword('')
    }
  }

  async function submitBan() {
    if (!banning) return
    const next = !isBanned(banning)
    const ok = await run(
      () => updateAdminUser(banning.id, { banned: next }),
      next ? `Banned ${banning.email}` : `Unbanned ${banning.email}`,
    )
    if (ok) setBanning(null)
  }

  const columns: Column<AdminUser>[] = [
    {
      key: 'email',
      header: 'Email',
      render: (r) => (
        <span className="font-medium text-zinc-900 dark:text-zinc-100">{r.email}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => {
        if (isBanned(r)) return <Badge tone="bad">Banned</Badge>
        if (!r.email_confirmed_at) return <Badge tone="warn">Unconfirmed</Badge>
        if (!r.last_sign_in_at) return <Badge tone="neutral">Never signed in</Badge>
        return <Badge tone="good">Active</Badge>
      },
    },
    { key: 'created', header: 'Created', render: (r) => formatDate(r.created_at) },
    { key: 'signed-in', header: 'Last sign-in', render: (r) => formatDate(r.last_sign_in_at) },
    {
      key: 'access',
      header: 'Access',
      render: (r) =>
        r.permissions.length === 0 ? (
          <span className="text-zinc-400">—</span>
        ) : (
          <span className="text-zinc-500 dark:text-zinc-400">
            {r.permissions.length} permission{r.permissions.length === 1 ? '' : 's'}
          </span>
        ),
    },
  ]

  if (manage) {
    columns.push({
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button
            size="sm"
            onClick={() => {
              setPermDraft(r.permissions)
              setActionError(null)
              setEditingPerms(r)
            }}
          >
            Permissions
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setNewPassword('')
              setActionError(null)
              setResettingPw(r)
            }}
          >
            Password
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setBanning(r)}>
            {isBanned(r) ? 'Unban' : 'Ban'}
          </Button>
          <Button size="sm" variant="danger" onClick={() => setDeleting(r)}>
            Delete
          </Button>
        </div>
      ),
    })
  }

  const activeUnlockError =
    unlockError ??
    (users.error && users.error !== 'Admin console secret required.' ? users.error : null)

  return (
    <>
      <PageHeader
        title="Admin Console — Users"
        description={users.data ? `${users.data.length} accounts` : undefined}
        actions={
          locked ? undefined : (
            manage && (
              <Button variant="primary" onClick={openCreate}>
                New user
              </Button>
            )
          )
        }
      />

      <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
        Accounts live in Supabase Auth. Permission ticks are stored per user and enforced
        across the app. Changes apply after the account&apos;s session token next refreshes.
      </p>

      {locked ? (
        <Card>
          <div className="space-y-4 p-4 sm:p-6">
            <div>
              <Label htmlFor="admin-console-secret">Admin console secret</Label>
              <Input
                id="admin-console-secret"
                type="password"
                value={secretInput}
                onChange={(e) => setSecretInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitUnlock()
                }}
                placeholder="Shared secret for this console"
                autoFocus
              />
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                This console is locked until the secret matches ADMIN_CONSOLE_SECRET on the
                server. It is kept for this tab only.
              </p>
            </div>
            {!verifying && activeUnlockError && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-300">
                {activeUnlockError}
              </p>
            )}
            <Button variant="primary" onClick={submitUnlock} disabled={verifying}>
              {verifying ? 'Checking…' : 'Unlock'}
            </Button>
          </div>
        </Card>
      ) : (
        <ScreenGate permission="admin.view">
          {notice && (
            <p className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
              {notice}
            </p>
          )}
          {actionError && (
            <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-300">
              {actionError}
            </p>
          )}

          <Card>
            <AsyncBoundary
              loading={users.loading}
              error={users.error}
              errorCode={users.errorCode}
              onRetry={users.reload}
            >
              <DataTable
                columns={columns}
                rows={users.data ?? []}
                rowKey={(r) => r.id}
                empty={
                  <EmptyState
                    title="No accounts yet"
                    hint="Create the first account with New user."
                  />
                }
              />
            </AsyncBoundary>
          </Card>
        </ScreenGate>
      )}

      <Modal
        open={creating}
        title="New user"
        onClose={() => setCreating(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submitCreate} disabled={busy}>
              {busy ? 'Creating…' : 'Create user'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="new-user-email">Email</Label>
            <Input
              id="new-user-email"
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="name@example.com"
            />
            {createErrors.email && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{createErrors.email}</p>
            )}
          </div>
          <div>
            <Label htmlFor="new-user-password">Password</Label>
            <Input
              id="new-user-password"
              type="password"
              value={createForm.password}
              onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="At least 8 characters"
            />
            {createErrors.password && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {createErrors.password}
              </p>
            )}
          </div>
          <div>
            <Label>Permissions</Label>
            <PermissionPicker
              selected={createForm.permissions}
              onChange={(next) => setCreateForm((f) => ({ ...f, permissions: next }))}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={editingPerms !== null}
        title={editingPerms ? `Permissions — ${editingPerms.email}` : 'Permissions'}
        onClose={() => setEditingPerms(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingPerms(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submitPermissions} disabled={busy}>
              {busy ? 'Saving…' : 'Save permissions'}
            </Button>
          </>
        }
      >
        <PermissionPicker selected={permDraft} onChange={setPermDraft} />
      </Modal>

      <Modal
        open={resettingPw !== null}
        title={resettingPw ? `Reset password — ${resettingPw.email}` : 'Reset password'}
        onClose={() => setResettingPw(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setResettingPw(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submitPassword} disabled={busy}>
              {busy ? 'Saving…' : 'Reset password'}
            </Button>
          </>
        }
      >
        <div>
          <Label htmlFor="reset-password">New password</Label>
          <Input
            id="reset-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>
      </Modal>

      <Modal
        open={banning !== null}
        title={banning && isBanned(banning) ? 'Unban user' : 'Ban user'}
        onClose={() => setBanning(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setBanning(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={submitBan} disabled={busy}>
              {busy ? 'Saving…' : banning && isBanned(banning) ? 'Unban' : 'Ban user'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          {banning && isBanned(banning)
            ? `Lift the ban on ${banning.email}? They will be able to sign in again.`
            : `Ban ${banning?.email}? The account cannot sign in until unbanned. The account and its permissions are kept.`}
        </p>
      </Modal>

      <Modal
        open={deleting !== null}
        title="Delete user"
        onClose={() => setDeleting(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                if (!deleting) return
                const ok = await run(
                  () => deleteAdminUser(deleting.id),
                  `Deleted ${deleting.email}`,
                )
                if (ok) setDeleting(null)
              }}
            >
              {busy ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Delete <span className="font-medium text-zinc-900 dark:text-zinc-100">{deleting?.email}</span>?
          The account is removed from Supabase Auth and cannot sign in again. Inventory
          records are not touched.
        </p>
      </Modal>
    </>
  )
}
