import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { i18nError } from '@shared/i18nMessage'
import type { Group, GroupInput } from '@shared/types'

interface GroupRow {
  id: string
  name: string
  description: string
  device_count: number
  created_at: string
  updated_at: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function mapGroup(row: GroupRow): Group {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    deviceCount: row.device_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function normalizeInput(input: GroupInput): GroupInput {
  const name = input.name.trim()
  const description = input.description.trim()

  if (!name) {
    throw i18nError('errors.group.nameRequired')
  }

  if (name.length > 80) {
    throw i18nError('errors.group.nameTooLong')
  }

  if (description.length > 200) {
    throw i18nError('errors.group.descriptionTooLong')
  }

  return { name, description }
}

function assertUniqueName(database: DatabaseSync, name: string, excludeId?: string): void {
  const row = (
    excludeId
      ? database
          .prepare(
            'SELECT id FROM groups WHERE name = ? COLLATE NOCASE AND id != ? LIMIT 1'
          )
          .get(name, excludeId)
      : database.prepare('SELECT id FROM groups WHERE name = ? COLLATE NOCASE LIMIT 1').get(name)
  ) as { id: string } | undefined

  if (row) {
    throw i18nError('errors.group.nameTaken')
  }
}

function getById(database: DatabaseSync, id: string): Group {
  const row = database
    .prepare(
      `
      SELECT
        g.id, g.name, g.description, g.created_at, g.updated_at,
        COUNT(t.id) AS device_count
      FROM groups g
      LEFT JOIN targets t ON t.group_id = g.id
      WHERE g.id = ?
      GROUP BY g.id
    `
    )
    .get(id) as GroupRow | undefined

  if (!row) {
    throw i18nError('errors.group.notFound')
  }

  return mapGroup(row)
}

export function groupExists(database: DatabaseSync, id: string): boolean {
  const row = database.prepare('SELECT id FROM groups WHERE id = ?').get(id) as
    | { id: string }
    | undefined
  return Boolean(row)
}

export function listGroups(database: DatabaseSync): Group[] {
  const rows = database
    .prepare(
      `
      SELECT
        g.id, g.name, g.description, g.created_at, g.updated_at,
        COUNT(t.id) AS device_count
      FROM groups g
      LEFT JOIN targets t ON t.group_id = g.id
      GROUP BY g.id
      ORDER BY g.name COLLATE NOCASE ASC
    `
    )
    .all() as unknown as GroupRow[]

  return rows.map(mapGroup)
}

export function createGroup(database: DatabaseSync, input: GroupInput): Group {
  const normalized = normalizeInput(input)
  assertUniqueName(database, normalized.name)

  const timestamp = nowIso()
  const id = randomUUID()

  database
    .prepare(
      `
      INSERT INTO groups (id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `
    )
    .run(id, normalized.name, normalized.description, timestamp, timestamp)

  return getById(database, id)
}

export function updateGroup(database: DatabaseSync, id: string, input: GroupInput): Group {
  getById(database, id)
  const normalized = normalizeInput(input)
  assertUniqueName(database, normalized.name, id)

  database
    .prepare(
      `
      UPDATE groups
      SET name = ?, description = ?, updated_at = ?
      WHERE id = ?
    `
    )
    .run(normalized.name, normalized.description, nowIso(), id)

  return getById(database, id)
}

export function deleteGroup(database: DatabaseSync, id: string): void {
  getById(database, id)
  database.prepare('DELETE FROM groups WHERE id = ?').run(id)
}
