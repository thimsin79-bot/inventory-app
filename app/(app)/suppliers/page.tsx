'use client'

import { useState } from 'react'
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '@/services/inventoryService'
import type { Tables } from '@/types/database.types'
import { errorMessage } from '@/utils/errors'
import { useAsyncData } from '@/hooks/useAsyncData'
import { AsyncBoundary } from '@/components/AsyncBoundary'
import { DataTable, type Column } from '@/components/DataTable'
import { Modal } from '@/components/Modal'
import { Button, Card, EmptyState, Field, Input, Notice, PageHeader } from '@/components/ui'

type Row = Tables<'suppliers'>

const EMPTY = { company: '', contact: '', phone: '', email: '', address: '' }

type ErrorMap = Partial<Record<'company' | 'email', string>>

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function SuppliersPage() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [deleting, setDeleting] = useState<Row | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [formErrors, setFormErrors] = useState<ErrorMap>({})
  const [formError, setFormError] = useState<string | null>(null)

  const state = useAsyncData(getSuppliers)

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  function openCreate() {
    setForm(EMPTY)
    setFormErrors({})
    setFormError(null)
    setCreating(true)
  }

  function openEdit(row: Row) {
    setForm({
      company: row.company,
      contact: row.contact ?? '',
      phone: row.phone ?? '',
      email: row.email ?? '',
      address: row.address ?? '',
    })
    setFormErrors({})
    setFormError(null)
    setEditing(row)
  }

  function closeForm() {
    setCreating(false)
    setEditing(null)
  }

  async function submit() {
    const errors: ErrorMap = {}
    if (!form.company.trim()) errors.company = 'Company is required.'
    if (form.email.trim() && !EMAIL.test(form.email.trim())) errors.email = 'Enter a valid email address.'
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return

    setBusy(true)
    setFormError(null)
    try {
      const values = {
        company: form.company.trim(),
        contact: form.contact.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
      }
      if (editing) {
        await updateSupplier(editing.id, values)
        setNotice(`Updated ${values.company}`)
      } else {
        await createSupplier(values)
        setNotice(`Created ${values.company}`)
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
      await deleteSupplier(deleting.id)
      setNotice(`Deleted ${deleting.company}`)
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
    { key: 'company', header: 'Company', render: (r) => <span className="font-medium text-zinc-900 dark:text-zinc-100">{r.company}</span> },
    { key: 'contact', header: 'Contact', render: (r) => r.contact ?? <span className="text-zinc-400">—</span> },
    { key: 'phone', header: 'Phone', render: (r) => r.phone ?? <span className="text-zinc-400">—</span> },
    {
      key: 'email',
      header: 'Email',
      render: (r) =>
        r.email ? (
          <a href={`mailto:${r.email}`} className="text-sky-700 hover:underline dark:text-sky-400">
            {r.email}
          </a>
        ) : (
          <span className="text-zinc-400">—</span>
        ),
    },
    { key: 'address', header: 'Address', render: (r) => r.address ?? <span className="text-zinc-400">—</span> },
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
        title="Suppliers"
        description="Vendors referenced by purchase orders."
        actions={
          <Button variant="primary" onClick={openCreate}>
            New supplier
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
            empty={<EmptyState title="No suppliers" hint="Add a vendor to raise purchase orders against." />}
          />
        </AsyncBoundary>
      </Card>

      <Modal
        open={creating || editing !== null}
        title={editing ? `Edit ${editing.company}` : 'New supplier'}
        onClose={closeForm}
        footer={
          <>
            <Button variant="secondary" onClick={closeForm} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Create supplier'}
            </Button>
          </>
        }
      >
        {formError && <Notice tone="bad" className="mb-3">{formError}</Notice>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Company" htmlFor="sup-company" required error={formErrors.company} className="sm:col-span-2">
            <Input id="sup-company" value={form.company} onChange={(e) => set({ company: e.target.value })} />
          </Field>
          <Field label="Contact person" htmlFor="sup-contact">
            <Input id="sup-contact" value={form.contact} onChange={(e) => set({ contact: e.target.value })} placeholder="Optional" />
          </Field>
          <Field label="Phone" htmlFor="sup-phone">
            <Input id="sup-phone" value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="Optional" />
          </Field>
          <Field label="Email" htmlFor="sup-email" error={formErrors.email} className="sm:col-span-2">
            <Input id="sup-email" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} placeholder="Optional" />
          </Field>
          <Field label="Address" htmlFor="sup-address" className="sm:col-span-2">
            <Input id="sup-address" value={form.address} onChange={(e) => set({ address: e.target.value })} placeholder="Optional" />
          </Field>
        </div>
      </Modal>

      <Modal
        open={deleting !== null}
        title="Delete supplier"
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
          Delete <span className="font-medium text-zinc-900 dark:text-zinc-100">{deleting?.company}</span>? Purchase
          orders and items still linked to it must be reassigned first.
        </p>
      </Modal>
    </>
  )
}