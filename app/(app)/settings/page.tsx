'use client'

import { useMemo, useState } from 'react'
import { getCompanySettings, saveCompanySettings, uploadCompanyLogo, companyLogoUrl } from '@/services/inventoryService'
import type { Tables } from '@/types/database.types'
import { errorMessage } from '@/utils/errors'
import { useAsyncData } from '@/hooks/useAsyncData'
import { AsyncBoundary } from '@/components/AsyncBoundary'
import { usePreferences } from '@/components/PreferencesProvider'
import { LANDING_OPTIONS, PAGE_SIZE_OPTIONS, type ThemePreference } from '@/lib/preferences'
import { Button, Card, Field, Input, Label, Notice, PageHeader, Select, Textarea } from '@/components/ui'

const MAX_LOGO_BYTES = 5 * 1024 * 1024
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type CompanyRow = Tables<'company_settings'>

type ErrorMap = Partial<Record<'name' | 'email', string>>

function CompanyEditor({ initial, onSaved }: { initial: CompanyRow | null; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [logoPath, setLogoPath] = useState<string | null>(initial?.logo_path ?? null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formErrors, setFormErrors] = useState<ErrorMap>({})
  const [notice, setNotice] = useState<string | null>(null)

  const preview = useMemo(
    () => (logoFile ? URL.createObjectURL(logoFile) : companyLogoUrl(logoPath)),
    [logoFile, logoPath],
  )

  async function save() {
    if (logoFile && (!logoFile.type.startsWith('image/') || logoFile.size > MAX_LOGO_BYTES)) {
      setError('Logo must be an image under 5 MB.')
      return
    }
    const errors: ErrorMap = {}
    if (!name.trim()) errors.name = 'Company name is required.'
    if (email.trim() && !EMAIL.test(email.trim())) errors.email = 'Enter a valid email address.'
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return

    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      let path = logoPath
      if (logoFile) path = await uploadCompanyLogo(logoFile)
      await saveCompanySettings({
        name: name.trim(),
        address: address.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        logo_path: path,
      })
      setLogoFile(null)
      setNotice('Company information saved')
      onSaved()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Company information</p>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Stored app-wide in the database, so every device sees the same details.
        </p>
      </div>

      <div className="space-y-3 p-4">
        {notice && <Notice>{notice}</Notice>}
        {error && <Notice tone="bad">{error}</Notice>}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Company name" htmlFor="co-name" required error={formErrors.name} className="sm:col-span-2">
            <Input id="co-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Logo" htmlFor="co-logo" className="sm:col-span-2">
            <div className="flex flex-wrap items-center gap-3">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Company logo preview" className="h-16 w-16 rounded-md border border-zinc-200 object-contain dark:border-zinc-700" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed border-zinc-300 text-xs text-zinc-400 dark:border-zinc-700">
                  none
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <Input id="co-logo" type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy || (!logoFile && !logoPath)}
                    onClick={() => {
                      setLogoFile(null)
                      setLogoPath(null)
                    }}
                  >
                    Remove logo
                  </Button>
                </div>
              </div>
            </div>
          </Field>
          <Field label="Address" htmlFor="co-address" className="sm:col-span-2">
            <Textarea id="co-address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
          <Field label="Phone" htmlFor="co-phone">
            <Input id="co-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Email" htmlFor="co-email" error={formErrors.email}>
            <Input id="co-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <Button variant="primary" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </Card>
  )
}

export default function SettingsPage() {
  const { preferences, update, reset } = usePreferences()
  const company = useAsyncData(getCompanySettings)

  return (
    <>
      <PageHeader
        title="Settings"
        description="Company details are stored app-wide; the preferences below are stored in this browser only."
      />

      <div className="max-w-xl space-y-4">
        <AsyncBoundary loading={company.loading} error={company.error} errorCode={company.errorCode} onRetry={company.reload}>
          <CompanyEditor initial={company.data} onSaved={company.reload} />
        </AsyncBoundary>

        <Card className="p-4">
          <p className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">Personal preferences</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="st-theme">Theme</Label>
              <Select
                id="st-theme"
                value={preferences.theme}
                onChange={(e) => update({ theme: e.target.value as ThemePreference })}
              >
                <option value="system">Follow device</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="st-page-size">Rows per page</Label>
              <Select
                id="st-page-size"
                value={preferences.pageSize}
                onChange={(e) => update({ pageSize: Number(e.target.value) })}
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="st-landing">Landing page</Label>
              <Select
                id="st-landing"
                value={preferences.defaultPage}
                onChange={(e) => update({ defaultPage: e.target.value })}
              >
                {LANDING_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                The first visit to the app in a session starts here. The Dashboard stays one click away in the sidebar.
              </p>
            </div>
          </div>
        </Card>

        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Reset preferences</p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Back to the default theme, Dashboard landing page and 25 rows per page. Company information is not touched.
            </p>
          </div>
          <Button variant="secondary" onClick={reset}>
            Reset to defaults
          </Button>
        </Card>
      </div>
    </>
  )
}