'use client'

import { PERMISSION_GROUPS, type PermissionKey } from '@/lib/permissions'

export function PermissionPicker({
  selected,
  onChange,
}: {
  selected: PermissionKey[]
  onChange: (next: PermissionKey[]) => void
}) {
  function toggle(key: PermissionKey) {
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key])
  }

  return (
    <div className="space-y-4">
      {PERMISSION_GROUPS.map((group) => (
        <div key={group.id}>
          <p className="mb-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {group.label}
          </p>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {group.permissions.map((permission) => (
              <label
                key={permission.key}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(permission.key)}
                  onChange={() => toggle(permission.key)}
                  className="size-4 rounded border-zinc-300 accent-zinc-900 dark:border-zinc-600"
                />
                {permission.label}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
