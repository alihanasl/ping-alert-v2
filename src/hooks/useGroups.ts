import { useCallback, useEffect, useState } from 'react'
import type { Group, GroupInput } from '@shared/types'
import i18n from '../i18n'
import { tError } from '../lib/translate'

export function useGroups() {
  const [groups, setGroups] = useState<Group[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const nextGroups = await window.pingAlert.listGroups()
      setGroups(nextGroups)
      setError(null)
    } catch (loadError) {
      setError(tError(loadError, 'groups.listError'))
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const createGroup = useCallback(async (input: GroupInput) => {
    const created = await window.pingAlert.createGroup(input)
    setGroups((current) =>
      [...current, created].sort((left, right) => left.name.localeCompare(right.name, i18n.language))
    )
    return created
  }, [])

  const updateGroup = useCallback(async (id: string, input: GroupInput) => {
    const updated = await window.pingAlert.updateGroup(id, input)
    setGroups((current) =>
      current
        .map((group) => (group.id === id ? updated : group))
        .sort((left, right) => left.name.localeCompare(right.name, i18n.language))
    )
    return updated
  }, [])

  const deleteGroup = useCallback(async (id: string) => {
    await window.pingAlert.deleteGroup(id)
    setGroups((current) => current.filter((group) => group.id !== id))
  }, [])

  return {
    groups,
    error,
    refresh,
    createGroup,
    updateGroup,
    deleteGroup
  }
}
