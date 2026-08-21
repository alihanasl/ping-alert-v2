import nodemailer from 'nodemailer'
import { i18nError } from '@shared/i18nMessage'
import type { Target } from '@shared/types'
import { writeAppLog } from '../appLog'
import { getDatabase, getDatabaseInfo } from '../db/connection'
import { getEmailRuntimeConfig, type EmailRuntimeConfig } from '../db/settings'
import { tMain, tStoredMain } from '../i18n'

function isReadyToSend(config: EmailRuntimeConfig): boolean {
  return Boolean(config.enabled && config.host && config.to)
}

function createTransport(config: EmailRuntimeConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth:
      config.username.length > 0
        ? {
            user: config.username,
            pass: config.password
          }
        : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  })
}

async function sendMail(config: EmailRuntimeConfig, subject: string, text: string): Promise<void> {
  const transporter = createTransport(config)
  try {
    await transporter.sendMail({
      from: config.from || config.username || config.to,
      to: config.to,
      subject,
      text
    })
  } finally {
    transporter.close()
  }
}

export async function notifyDeviceStatus(target: Target, kind: 'down' | 'up'): Promise<void> {
  if (!getDatabaseInfo().ready) {
    return
  }

  const config = getEmailRuntimeConfig(getDatabase())
  if (!isReadyToSend(config)) {
    return
  }

  if (kind === 'down' && !config.notifyDown) {
    return
  }

  if (kind === 'up' && !config.notifyUp) {
    return
  }

  const time = new Date().toLocaleString()
  const reason = tStoredMain(target.message)
  const subject =
    kind === 'down'
      ? tMain('email.down.subject', { name: target.name })
      : tMain('email.up.subject', { name: target.name })
  const body =
    kind === 'down'
      ? tMain('email.down.body', {
          name: target.name,
          host: target.host,
          reason,
          time
        })
      : tMain('email.up.body', {
          name: target.name,
          host: target.host,
          time
        })

  try {
    await sendMail(config, subject, body)
    writeAppLog('info', 'email', kind === 'down' ? 'log.email.sentDown' : 'log.email.sentUp', {
      name: target.name
    })
  } catch (error) {
    writeAppLog('error', 'email', 'log.email.failed', {
      reason: error instanceof Error ? error.message : tMain('errors.email.sendFailed')
    })
  }
}

export async function sendTestEmail(): Promise<void> {
  if (!getDatabaseInfo().ready) {
    throw i18nError('errors.email.notConfigured')
  }

  const config = getEmailRuntimeConfig(getDatabase())
  if (!isReadyToSend(config)) {
    throw i18nError('errors.email.notConfigured')
  }

  try {
    await sendMail(config, tMain('email.test.subject'), tMain('email.test.body'))
    writeAppLog('info', 'email', 'log.email.sentTest')
  } catch (error) {
    writeAppLog('error', 'email', 'log.email.failed', {
      reason: error instanceof Error ? error.message : tMain('errors.email.sendFailed')
    })
    throw i18nError('errors.email.sendFailed')
  }
}
