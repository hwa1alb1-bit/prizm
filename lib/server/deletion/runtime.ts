import 'server-only'

import { recordAuditEvent } from '../audit'
import { captureMessage } from '../sentry'
import { sendDeletionReceiptEmail } from './email'
import { deleteOrVerifyS3Object } from './s3'
import {
  listExpiredDocuments,
  listExpiredStatements,
  listStaleDeletionSurvivors,
  markDocumentDeleted,
  markStatementDeleted,
  markStatementsDeletedForDocument,
  recordDeletionReceipt,
  recordDeletionSweepRun,
  type DeletionSweepTrigger,
} from './store'

export type DeletionSweepFailure = {
  targetType: 'document' | 'statement' | 'receipt' | 'audit'
  targetId: string
  errorCode: string
}

export type DeletionSweepResult = {
  status: 'ok' | 'partial' | 'failed'
  expiredDocuments: number
  expiredStatements: number
  deletedDocuments: number
  deletedStatements: number
  s3Deleted: number
  s3Absent: number
  receiptsSent: number
  receiptFailures: number
  failures: DeletionSweepFailure[]
}

export type DeletionSurvivorMonitorResult = {
  status: 'green' | 'red'
  documentSurvivors: number
  statementSurvivors: number
  totalSurvivors: number
}

export async function runDeletionSweep(input: {
  trigger: DeletionSweepTrigger
  now?: Date
  batchSize?: number
}): Promise<DeletionSweepResult> {
  const now = input.now ?? new Date()
  const nowIso = now.toISOString()
  const batchSize = input.batchSize ?? 100
  const failures: DeletionSweepFailure[] = []
  let deletedDocuments = 0
  let deletedStatements = 0
  let s3Deleted = 0
  let s3Absent = 0
  let receiptsSent = 0
  let receiptFailures = 0

  const [documents, statements] = await Promise.all([
    listExpiredDocuments({ now: nowIso, limit: batchSize }),
    listExpiredStatements({ now: nowIso, limit: batchSize }),
  ])
  const expiredDocumentIds = new Set(documents.map((document) => document.id))
  const independentStatements = statements.filter(
    (statement) => !expiredDocumentIds.has(statement.documentId),
  )

  for (const document of documents) {
    const s3 = await deleteOrVerifyS3Object({
      bucket: document.s3Bucket,
      key: document.s3Key,
    })

    if (!s3.ok) {
      failures.push({
        targetType: 'document',
        targetId: document.id,
        errorCode: s3.errorCode,
      })
      continue
    }

    const linkedStatementCount = await markStatementsDeletedForDocument({
      documentId: document.id,
      deletedAt: nowIso,
    })
    await markDocumentDeleted({ documentId: document.id, deletedAt: nowIso })
    deletedDocuments += 1
    deletedStatements += linkedStatementCount
    if (s3.state === 'deleted') s3Deleted += 1
    if (s3.state === 'absent') s3Absent += 1

    const audit = await recordAuditEvent({
      eventType: 'document.deleted',
      workspaceId: document.workspaceId,
      actorUserId: null,
      targetType: 'document',
      targetId: document.id,
      metadata: {
        trigger: input.trigger,
        s3_state: s3.state,
        expires_at: document.expiresAt,
      },
    })
    if (!audit.ok) {
      failures.push({
        targetType: 'audit',
        targetId: document.id,
        errorCode: 'audit_write_failed',
      })
    }

    if (!document.recipientEmail) {
      receiptFailures += 1
      failures.push({
        targetType: 'receipt',
        targetId: document.id,
        errorCode: 'receipt_recipient_missing',
      })
      await recordDeletionReceipt({
        documentId: document.id,
        workspaceId: document.workspaceId,
        recipientUserId: document.uploadedBy,
        recipientEmail: '',
        sentAt: nowIso,
        status: 'failed',
        errorCode: 'receipt_recipient_missing',
      })
      continue
    }

    const receipt = await sendDeletionReceiptEmail({
      to: document.recipientEmail,
      filename: document.filename,
      deletedAt: nowIso,
    })

    await recordDeletionReceipt({
      documentId: document.id,
      workspaceId: document.workspaceId,
      recipientUserId: document.uploadedBy,
      recipientEmail: document.recipientEmail,
      sentAt: nowIso,
      status: receipt.ok ? 'sent' : 'failed',
      errorCode: receipt.ok ? null : receipt.errorCode,
    })

    if (receipt.ok) {
      receiptsSent += 1
    } else {
      receiptFailures += 1
      failures.push({
        targetType: 'receipt',
        targetId: document.id,
        errorCode: receipt.errorCode,
      })
    }
  }

  for (const statement of independentStatements) {
    await markStatementDeleted({ statementId: statement.id, deletedAt: nowIso })
    deletedStatements += 1
    const audit = await recordAuditEvent({
      eventType: 'statement.deleted',
      workspaceId: statement.workspaceId,
      actorUserId: null,
      targetType: 'statement',
      targetId: statement.id,
      metadata: {
        trigger: input.trigger,
        document_id: statement.documentId,
        expires_at: statement.expiresAt,
      },
    })
    if (!audit.ok) {
      failures.push({
        targetType: 'audit',
        targetId: statement.id,
        errorCode: 'audit_write_failed',
      })
    }
  }

  const status = computeSweepStatus({
    failures: failures.length,
    expiredDocuments: documents.length,
    expiredStatements: independentStatements.length,
    deletedDocuments,
    deletedStatements,
  })

  await recordDeletionSweepRun({
    trigger: input.trigger,
    startedAt: nowIso,
    finishedAt: nowIso,
    status,
    expiredDocumentCount: documents.length,
    expiredStatementCount: independentStatements.length,
    deletedDocumentCount: deletedDocuments,
    deletedStatementCount: deletedStatements,
    s3DeletedCount: s3Deleted,
    s3AbsentCount: s3Absent,
    receiptCount: receiptsSent,
    receiptFailureCount: receiptFailures,
    survivorCount: failures.filter((failure) => failure.targetType !== 'receipt').length,
    errorDetail:
      failures.length > 0 ? failures.map((failure) => failure.errorCode).join(',') : null,
  })

  return {
    status,
    expiredDocuments: documents.length,
    expiredStatements: independentStatements.length,
    deletedDocuments,
    deletedStatements,
    s3Deleted,
    s3Absent,
    receiptsSent,
    receiptFailures,
    failures,
  }
}

export async function checkDeletionSurvivors(
  input: {
    now?: Date
    graceMinutes?: number
  } = {},
): Promise<DeletionSurvivorMonitorResult> {
  const now = input.now ?? new Date()
  const graceMinutes = input.graceMinutes ?? 5
  const olderThan = new Date(now.getTime() - graceMinutes * 60 * 1000).toISOString()
  const survivors = await listStaleDeletionSurvivors({ olderThan })
  const totalSurvivors = survivors.documentSurvivors + survivors.statementSurvivors

  if (totalSurvivors > 0) {
    const metadata = {
      severity: 'P1',
      document_survivors: survivors.documentSurvivors,
      statement_survivors: survivors.statementSurvivors,
      older_than: olderThan,
    }
    captureMessage('P1 deletion survivor SLA breach', metadata)
    await recordAuditEvent({
      eventType: 'deletion.stale_survivors_detected',
      actorUserId: null,
      targetType: 'deletion_runtime',
      metadata,
    })
  }

  return {
    status: totalSurvivors > 0 ? 'red' : 'green',
    documentSurvivors: survivors.documentSurvivors,
    statementSurvivors: survivors.statementSurvivors,
    totalSurvivors,
  }
}

function computeSweepStatus(input: {
  failures: number
  expiredDocuments: number
  expiredStatements: number
  deletedDocuments: number
  deletedStatements: number
}): DeletionSweepResult['status'] {
  if (input.failures === 0) return 'ok'
  const expiredTargets = input.expiredDocuments + input.expiredStatements
  const deletedTargets = input.deletedDocuments + input.deletedStatements
  if (expiredTargets > 0 && deletedTargets === 0) return 'failed'
  return 'partial'
}
