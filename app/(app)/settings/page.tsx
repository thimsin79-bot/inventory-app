'use client'

import { usePreferences } from '@/components/PreferencesProvider'
import { LANDING_OPTIONS, PAGE_SIZE_OPTIONS, type ThemePreference } from '@/lib/preferences'
import { Button, Card, Label, PageHeader, Select } from '@/components/ui'

export default function SettingsPage() {
  const { preferences, update, reset } = usePreferences()

  return (
    <>
      <PageHeader
        title="Settings"
        description="Preferences stored in this browser only — they do not reach the database or other devices."
      />

      <div className="max-w-xl space-y-4">
        <Card className="p-4">
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
              Back to the default theme, Dashboard landing page and 25 rows per page.
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