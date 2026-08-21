import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Group, GroupInput } from '@shared/types'
import { tError } from '../lib/translate'
import { ConfirmDialog } from './ConfirmDialog'

interface GroupsModalProps {
  groups: Group[]
  onClose: () => void
  onChanged: () => Promise<void>
}

interface FormState {
  name: string
  description: string
}

const emptyForm: FormState = {
  name: '',
  description: ''
}

export function GroupsModal({ groups, onClose, onChanged }: GroupsModalProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Group | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!editingId) {
      return
    }

    const editing = groups.find((group) => group.id === editingId)
    if (!editing) {
      setEditingId(null)
      setForm(emptyForm)
    }
  }, [editingId, groups])

  function startEdit(group: Group): void {
    setEditingId(group.id)
    setForm({ name: group.name, description: group.description })
    setError(null)
  }

  function resetForm(): void {
    setEditingId(null)
    setForm(emptyForm)
    setError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setSaving(true)
    setError(null)

    const input: GroupInput = {
      name: form.name,
      description: form.description
    }

    try {
      if (editingId) {
        await window.pingAlert.updateGroup(editingId, input)
      } else {
        await window.pingAlert.createGroup(input)
      }

      resetForm()
      await onChanged()
    } catch (saveError) {
      setError(tError(saveError, 'groups.saveError'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(): Promise<void> {
    if (!pendingDelete) {
      return
    }

    setDeleting(true)

    try {
      await window.pingAlert.deleteGroup(pendingDelete.id)
      if (editingId === pendingDelete.id) {
        resetForm()
      }
      setPendingDelete(null)
      await onChanged()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={t('common.close')}
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="border-b border-slate-800 px-6 py-4">
          <h2 className="text-lg font-medium text-slate-100">{t('groups.title')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('groups.subtitle')}</p>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3 px-6 py-4">
          <label className="block text-sm">
            <span className="text-slate-300">{t('groups.name')}</span>
            <input
              required
              maxLength={80}
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-teal-500"
              placeholder={t('groups.namePlaceholder')}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-300">{t('groups.description')}</span>
            <input
              maxLength={200}
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-teal-500"
              placeholder={t('groups.descriptionPlaceholder')}
            />
          </label>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <div className="flex justify-end gap-2">
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                {t('groups.new')}
              </button>
            ) : null}
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-teal-400 disabled:opacity-60"
            >
              {saving ? t('common.saving') : editingId ? t('groups.update') : t('groups.add')}
            </button>
          </div>
        </form>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-slate-800">
          {groups.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-slate-500">{t('groups.empty')}</p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {groups.map((group) => (
                <li key={group.id} className="flex items-center gap-3 px-6 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-100">{group.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {t('groups.deviceCount', { count: group.deviceCount })}
                      {group.description ? ` · ${group.description}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startEdit(group)}
                    className="rounded-lg px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
                  >
                    {t('common.edit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(group)}
                    className="rounded-lg px-3 py-1.5 text-sm text-red-400 hover:bg-slate-800"
                  >
                    {t('common.delete')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-slate-800 px-6 py-4 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            {t('common.close')}
          </button>
        </div>
      </div>

      {pendingDelete ? (
        <ConfirmDialog
          title={t('groups.deleteTitle')}
          message={t('groups.deleteMessage', { name: pendingDelete.name })}
          confirmLabel={t('common.delete')}
          busy={deleting}
          onCancel={() => {
            if (!deleting) {
              setPendingDelete(null)
            }
          }}
          onConfirm={() => void handleDelete()}
        />
      ) : null}
    </div>
  )
}
