'use client'

import { useState } from 'react'
import { getLoginUsers, createLoginUser, deleteLoginUser, type LoginUserRow } from '@/services/inventoryService'
import { errorMessage } from '@/utils/errors'
import { useAsyncData } from '@/hooks/useAsyncData'
import { AsyncBoundary } from '@/components/AsyncBoundary'
import { DataTable, type Column } from '@/components/DataTable'
import { Modal } from '@/components/Modal'
import { Button, Card, EmptyState, Field, Input, Notice, PageHeader } from '@/components/ui'

const EMPTY = { username: '', display_name: '', password: '' }

export default function UsersPage() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<LoginUserRow | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const state = useAsyncData(getLoginUsers)

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  function openCreate() {
    setForm(EMPTY)
    setUsernameError(null)
    setPasswordError(null)
    setFormError(null)
    setCreating(true)
  }

  function closeForm() {
    setCreating(false)
  }

  async function submit() {
    if (!form.username.trim()) {
      setUsernameError('Username is required.')
      return
    }
    setUsernameError(null)
    if (form.password.length < 4) {
      setPasswordError('Password must be at least 4 characters.')
      return
    }
    setPasswordError(null)
    setBusy(true)
    setFormError(null)
    try {
      const created = await createLoginUser(form.username.trim(), form.password, form.display_name.trim())
      if (created) {
        setNotice(`Created ${form.username.trim()}`)
        closeForm()
        state.reload()
      } else {
        setFormError('That username is already taken.')
      }
    } catch (e) {
      setFormError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!deleting) return
    setBusy(true)
    setError(null)
    try {
      await deleteLoginUser(deleting.username)
      setNotice(`Deleted ${deleting.username}`)
      setDeleting(null)
      state.reload()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const columns: Column<LoginUserRow>[] = [
    { key: 'username', header: 'Username', render: (r) => <span className="font-medium text-zinc-900 dark:text-zinc-100">{r.username}</span> },
    { key: 'display_name', header: 'Display name', render: (r) => r.display_name ?? <span className="text-zinc-400">—</span> },
    {
      key: 'created_at',
      header: 'Created',
      render: (r) => <span className="text-zinc-500 dark:text-zinc-400">{new Date(r.created_at).toLocaleDateString()}</span>,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="danger" onClick={() => { setError(null); setDeleting(r) }}>
            Delete
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Users"
        description="Accounts that can sign in on the /login page."
        actions={
          <Button variant="primary" onClick={openCreate}>
            New user
          </Button>
        }
      />

      {notice && <Notice className="mb-3">{notice}</Notice>}
      {error && <Notice tone="bad" className="mb-3">{error}</Notice>}

      <Card>
        <AsyncBoundary loading={state.loading} error={state.error} errorCode={state.errorCode} onRetry={state.reload}>
          <DataTable
            columns={columns}
            rows={state.data ?? []}
            rowKey={(r) => r.username}
            empty={<EmptyState title="No users" hint="Create a user so someone can sign in." />}
          />
        </AsyncBoundary>
      </Card>

      <Modal
        open={creating}
        title="New user"
        onClose={closeForm}
        footer={
          <>
            <Button variant="secondary" onClick={closeForm} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} disabled={busy}>
              {busy ? 'Creating…' : 'Create user'}
            </Button>
          </>
        }
      >
        {formError && <Notice tone="bad" className="mb-3">{formError}</Notice>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Username" htmlFor="user-username" required error={usernameError ?? undefined}>
            <Input id="user-username" value={form.username} onChange={(e) => set({ username: e.target.value })} autoComplete="off" />
          </Field>
          <Field label="Display name" htmlFor="user-display" hint="Shown after a successful sign-in.">
            <Input id="user-display" value={form.display_name} onChange={(e) => set({ display_name: e.target.value })} autoComplete="off" />
          </Field>
          <Field label="Password" htmlFor="user-password" required error={passwordError ?? undefined} hint="At least 4 characters." className="sm:col-span-2">
            <Input
              id="user-password"
              type="password"
              value={form.password}
              onChange={(e) => set({ password: e.target.value })}
              autoComplete="new-password"
            />
          </Field>
        </div>
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
            <Button variant="danger" onClick={remove} disabled={busy}>
              {busy ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Delete <span className="font-medium text-zinc-900 dark:text-zinc-100">{deleting?.username}</span>? They will no
          longer be able to sign in.
          {deleting?.username === 'admin' ? (
            <span className="mt-1 block text-amber-700 dark:text-amber-400">
              The seeded admin account is a sign-in key; deleting it locks everyone out until another user exists.
            </span>
          ) : null}
        </p>
      </Modal>
    </>
  )
}