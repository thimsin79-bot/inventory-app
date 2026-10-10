'use client'

import { useState } from 'react'
import { Button, Card, Input, Label, Notice } from '@/components/ui'
import { loginUser } from '@/services/inventoryService'
import { errorMessage } from '@/utils/errors'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setNotice(null)
    try {
      const result = await loginUser(username.trim(), password)
      if (result.ok) {
        setNotice({ tone: 'good', text: `Signed in as ${result.display_name ?? username.trim()}.` })
      } else {
        setNotice({ tone: 'bad', text: 'Invalid username or password.' })
      }
    } catch (error) {
      setNotice({ tone: 'bad', text: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-[100dvh] flex items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Sign in</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Inventory Management</p>
        </div>

        <Card className="p-6">
          {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                required
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <Button type="submit" variant="primary" className="w-full" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  )
}