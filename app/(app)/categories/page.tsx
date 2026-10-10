'use client'

import { useState } from 'react'
import { getCategories, createCategory, updateCategory, deleteCategory } from '@/services/inventoryService'
import type { Tables } from '@/types/database.types'
import { errorMessage } from '@/utils/errors'
import { useAsyncData } from '@/hooks/useAsyncData'
import { AsyncBoundary } from '@/components/AsyncBoundary'
import { DataTable, type Column } from '@/components/DataTable'
import { Modal } from '@/components/Modal'
import { Button, Card, EmptyState, Field, Input, Notice, PageHeader, Textarea } from '@/components/ui'

type Row = Tables<'categories'>

const EMPTY = { name: '', description: '' }

export default function CategoriesPage() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [deleting, setDeleting] = useState<Row | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [nameError, setNameError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const state = useAsyncData(getCategories)

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  function openCreate() {
    setForm(EMPTY)
    setNameError(null)
    setFormError(null)
    setCreating(true)
  }

  function openEdit(row: Row) {
    setForm({ name: row.name, description: row.description ?? '' })
    setNameError(null)
    setFormError(null)
    setEditing(row)
  }

  function closeForm() {
    setCreating(false)
    setEditing(null)
  }

  async function submit() {
    if (!form.name.trim()) {
      setNameError('Name is required.')
      return
    }
    setNameError(null)
    setBusy(true)
    setFormError(null)
    try {
      const values = { name: form.name.trim(), description: form.description.trim() || null }
      if (editing) {
        await updateCategory(editing.id, values)
        setNotice(`Updated ${values.name}`)
      } else {
        await createCategory(values)
        setNotice(`Created ${values.name}`)
      }
      closeForm()
      state.reload()
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
      await deleteCategory(deleting.id)
      setNotice(`Deleted ${deleting.name}`)
      setDeleting(null)
      state.reload()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const columns: Column<Row>[] = [
    { key: 'id', header: 'ID', render: (r) => <span className="font-mono text-xs">{r.id}</span> },
    { key: 'name', header: 'Name', render: (r) => <span className="font-medium text-zinc-900 dark:text-zinc-100">{r.name}</span> },
    { key: 'description', header: 'Description', render: (r) => r.description ?? <span className="text-zinc-400">—</span> },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" onClick={() => openEdit(r)}>
            Edit
          </Button>
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
        title="Categories"
        description="Reference data used to classify inventory items."
        actions={
          <Button variant="primary" onClick={openCreate}>
            New category
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
            rowKey={(r) => r.id}
            empty={<EmptyState title="No categories" hint="Add a category to classify inventory items." />}
          />
        </AsyncBoundary>
      </Card>

      <Modal
        open={creating || editing !== null}
        title={editing ? `Edit ${editing.name}` : 'New category'}
        onClose={closeForm}
        footer={
          <>
            <Button variant="secondary" onClick={closeForm} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Create category'}
            </Button>
          </>
        }
      >
        {formError && <Notice tone="bad" className="mb-3">{formError}</Notice>}
        <div className="grid gap-3">
          <Field label="Name" htmlFor="cat-name" required error={nameError ?? undefined}>
            <Input id="cat-name" value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="Description" htmlFor="cat-desc">
            <Textarea id="cat-desc" value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="Optional" />
          </Field>
        </div>
      </Modal>

      <Modal
        open={deleting !== null}
        title="Delete category"
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
          Delete <span className="font-medium text-zinc-900 dark:text-zinc-100">{deleting?.name}</span>? Items still
          assigned to it must be reassigned first.
        </p>
      </Modal>
    </>
  )
}