import { useCallback, useEffect, useState } from 'react'
import type { Target, TargetInput } from '@shared/types'
import i18n from '../i18n'
import { tError } from '../lib/translate'

export function useTargets() {
  const [targets, setTargets] = useState<Target[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)

    try {
      const nextTargets = await window.pingAlert.listTargets()
      setTargets(nextTargets)
    } catch (loadError) {
      setError(tError(loadError, 'devices.listError'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    return window.pingAlert.onTargetStatus((update) => {
      setTargets((current) =>
        current.map((target) =>
          target.id === update.id
            ? {
                ...target,
                status: update.status,
                responseTimeMs: update.responseTimeMs,
                lastCheckedAt: update.lastCheckedAt,
                message: update.message,
                uptimePercent: update.uptimePercent
              }
            : target
        )
      )
    })
  }, [])

  const createTarget = useCallback(async (input: TargetInput) => {
    const created = await window.pingAlert.createTarget(input)
    setTargets((current) =>
      [...current, created].sort((left, right) => left.name.localeCompare(right.name, i18n.language))
    )
    return created
  }, [])

  const updateTarget = useCallback(async (id: string, input: TargetInput) => {
    const updated = await window.pingAlert.updateTarget(id, input)
    setTargets((current) =>
      current
        .map((target) => (target.id === id ? updated : target))
        .sort((left, right) => left.name.localeCompare(right.name, i18n.language))
    )
    return updated
  }, [])

  const deleteTarget = useCallback(async (id: string) => {
    await window.pingAlert.deleteTarget(id)
    setTargets((current) => current.filter((target) => target.id !== id))
  }, [])

  return {
    targets,
    loading,
    error,
    refresh,
    createTarget,
    updateTarget,
    deleteTarget
  }
}
