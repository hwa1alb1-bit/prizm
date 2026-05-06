import { afterEach, describe, expect, it, vi } from 'vitest'
import { recordAuditEvent } from '@/lib/server/audit'
import { sendDeletionReceiptEmail } from '@/lib/server/deletion/email'
import { checkDeletionSurvivors, runDeletionSweep } from '@/lib/server/deletion/runtime'
import { deleteOrVerifyS3Object } from '@/lib/server/deletion/s3'
import {
  listExpiredDocuments,
  listExpiredStatements,
  listStaleDeletionSurvivors,
  markDocumentDeleted,
  markStatementDeleted,
  markStatementsDeletedForDocument,
  recordDeletionReceipt,
  recordDeletionSweepRun,
} from '@/lib/server/deletion/store'
import { captureMessage } from '@/lib/server/sentry'

vi.mock('@/lib/server/audit', () => ({
  recordAuditEvent: vi.fn(),
}))

vi.mock('@/lib/server/deletion/email', () => ({
  sendDeletionReceiptEmail: vi.fn(),
}))

vi.mock('@/lib/server/deletion/s3', () => ({
  deleteOrVerifyS3Object: vi.fn(),
}))

vi.mock('@/lib/server/deletion/store', () => ({
  listExpiredDocuments: vi.fn(),
  listExpiredStatements: vi.fn(),
  listStaleDeletionSurvivors: vi.fn(),
  markDocumentDeleted: vi.fn(),
  markStatementDeleted: vi.fn(),
  markStatementsDeletedForDocument: vi.fn(),
  recordDeletionReceipt: vi.fn(),
  recordDeletionSweepRun: vi.fn(),
}))

vi.mock('@/lib/server/sentry', () => ({
  captureMessage: vi.fn(),
}))

const listExpiredDocumentsMock = vi.mocked(listExpiredDocuments)
const listExpiredStatementsMock = vi.mocked(listExpiredStatements)
const listStaleDeletionSurvivorsMock = vi.mocked(listStaleDeletionSurvivors)
const markDocumentDeletedMock = vi.mocked(markDocumentDeleted)
const markStatementDeletedMock = vi.mocked(markStatementDeleted)
const markStatementsDeletedForDocumentMock = vi.mocked(markStatementsDeletedForDocument)
const recordDeletionReceiptMock = vi.mocked(recordDeletionReceipt)
const recordDeletionSweepRunMock = vi.mocked(recordDeletionSweepRun)
const deleteOrVerifyS3ObjectMock = vi.mocked(deleteOrVerifyS3Object)
const sendDeletionReceiptEmailMock = vi.mocked(sendDeletionReceiptEmail)
const recordAuditEventMock = vi.mocked(recordAuditEvent)
const captureMessageMock = vi.mocked(captureMessage)

describe('runDeletionSweep', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('deletes expired documents, tombstones linked statements, audits, receipts, and records evidence', async () => {
    const now = new Date('2026-05-06T00:30:00.000Z')
    listExpiredDocumentsMock.mockResolvedValue([
      {
        id: 'doc_123',
        workspaceId: 'workspace_123',
        uploadedBy: 'user_123',
        recipientEmail: 'owner@example.com',
        filename: 'May Statement.pdf',
        s3Bucket: 'prizm-uploads-test',
        s3Key: 'user_123/doc_123/May_Statement.pdf',
        expiresAt: '2026-05-06T00:00:00.000Z',
      },
    ])
    listExpiredStatementsMock.mockResolvedValue([
      {
        id: 'stmt_orphan',
        documentId: 'doc_missing',
        workspaceId: 'workspace_123',
        expiresAt: '2026-05-06T00:00:00.000Z',
      },
    ])
    deleteOrVerifyS3ObjectMock.mockResolvedValue({ ok: true, state: 'deleted' })
    markStatementsDeletedForDocumentMock.mockResolvedValue(1)
    markDocumentDeletedMock.mockResolvedValue(undefined)
    markStatementDeletedMock.mockResolvedValue(undefined)
    sendDeletionReceiptEmailMock.mockResolvedValue({ ok: true, id: 'email_123' })
    recordDeletionReceiptMock.mockResolvedValue(undefined)
    recordDeletionSweepRunMock.mockResolvedValue(undefined)
    recordAuditEventMock.mockResolvedValue({ ok: true, id: 'audit_123' })

    const result = await runDeletionSweep({ trigger: 'test', now, batchSize: 50 })

    expect(result).toEqual({
      status: 'ok',
      expiredDocuments: 1,
      expiredStatements: 1,
      deletedDocuments: 1,
      deletedStatements: 2,
      s3Deleted: 1,
      s3Absent: 0,
      receiptsSent: 1,
      receiptFailures: 0,
      failures: [],
    })
    expect(deleteOrVerifyS3ObjectMock).toHaveBeenCalledWith({
      bucket: 'prizm-uploads-test',
      key: 'user_123/doc_123/May_Statement.pdf',
    })
    expect(markStatementsDeletedForDocumentMock).toHaveBeenCalledWith({
      documentId: 'doc_123',
      deletedAt: now.toISOString(),
    })
    expect(markDocumentDeletedMock).toHaveBeenCalledWith({
      documentId: 'doc_123',
      deletedAt: now.toISOString(),
    })
    expect(markStatementDeletedMock).toHaveBeenCalledWith({
      statementId: 'stmt_orphan',
      deletedAt: now.toISOString(),
    })
    expect(recordAuditEventMock).toHaveBeenCalledWith({
      eventType: 'document.deleted',
      workspaceId: 'workspace_123',
      actorUserId: null,
      targetType: 'document',
      targetId: 'doc_123',
      metadata: {
        trigger: 'test',
        s3_state: 'deleted',
        expires_at: '2026-05-06T00:00:00.000Z',
      },
    })
    expect(sendDeletionReceiptEmailMock).toHaveBeenCalledWith({
      to: 'owner@example.com',
      filename: 'May Statement.pdf',
      deletedAt: now.toISOString(),
    })
    expect(recordDeletionReceiptMock).toHaveBeenCalledWith({
      documentId: 'doc_123',
      workspaceId: 'workspace_123',
      recipientUserId: 'user_123',
      recipientEmail: 'owner@example.com',
      sentAt: now.toISOString(),
      status: 'sent',
      errorCode: null,
    })
    expect(recordDeletionSweepRunMock).toHaveBeenCalledWith({
      trigger: 'test',
      startedAt: now.toISOString(),
      finishedAt: now.toISOString(),
      status: 'ok',
      expiredDocumentCount: 1,
      expiredStatementCount: 1,
      deletedDocumentCount: 1,
      deletedStatementCount: 2,
      s3DeletedCount: 1,
      s3AbsentCount: 0,
      receiptCount: 1,
      receiptFailureCount: 0,
      survivorCount: 0,
      errorDetail: null,
    })
  })

  it('pages P1 and audits when expired rows survive beyond the deletion grace window', async () => {
    const now = new Date('2026-05-06T00:30:00.000Z')
    listStaleDeletionSurvivorsMock.mockResolvedValue({
      documentSurvivors: 2,
      statementSurvivors: 1,
    })
    recordAuditEventMock.mockResolvedValue({ ok: true, id: 'audit_survivor' })

    const result = await checkDeletionSurvivors({ now, graceMinutes: 5 })

    expect(result).toEqual({
      status: 'red',
      documentSurvivors: 2,
      statementSurvivors: 1,
      totalSurvivors: 3,
    })
    expect(listStaleDeletionSurvivorsMock).toHaveBeenCalledWith({
      olderThan: '2026-05-06T00:25:00.000Z',
    })
    expect(captureMessageMock).toHaveBeenCalledWith('P1 deletion survivor SLA breach', {
      severity: 'P1',
      document_survivors: 2,
      statement_survivors: 1,
      older_than: '2026-05-06T00:25:00.000Z',
    })
    expect(recordAuditEventMock).toHaveBeenCalledWith({
      eventType: 'deletion.stale_survivors_detected',
      actorUserId: null,
      targetType: 'deletion_runtime',
      metadata: {
        severity: 'P1',
        document_survivors: 2,
        statement_survivors: 1,
        older_than: '2026-05-06T00:25:00.000Z',
      },
    })
  })

  it('does not double-delete expired statements already covered by an expired document', async () => {
    const now = new Date('2026-05-06T00:30:00.000Z')
    listExpiredDocumentsMock.mockResolvedValue([
      {
        id: 'doc_123',
        workspaceId: 'workspace_123',
        uploadedBy: 'user_123',
        recipientEmail: 'owner@example.com',
        filename: 'May Statement.pdf',
        s3Bucket: 'prizm-uploads-test',
        s3Key: 'user_123/doc_123/May_Statement.pdf',
        expiresAt: '2026-05-06T00:00:00.000Z',
      },
    ])
    listExpiredStatementsMock.mockResolvedValue([
      {
        id: 'stmt_linked',
        documentId: 'doc_123',
        workspaceId: 'workspace_123',
        expiresAt: '2026-05-06T00:00:00.000Z',
      },
    ])
    deleteOrVerifyS3ObjectMock.mockResolvedValue({ ok: true, state: 'deleted' })
    markStatementsDeletedForDocumentMock.mockResolvedValue(1)
    markDocumentDeletedMock.mockResolvedValue(undefined)
    sendDeletionReceiptEmailMock.mockResolvedValue({ ok: true, id: 'email_123' })
    recordDeletionReceiptMock.mockResolvedValue(undefined)
    recordDeletionSweepRunMock.mockResolvedValue(undefined)
    recordAuditEventMock.mockResolvedValue({ ok: true, id: 'audit_123' })

    const result = await runDeletionSweep({ trigger: 'test', now, batchSize: 50 })

    expect(result).toMatchObject({
      status: 'ok',
      expiredDocuments: 1,
      expiredStatements: 0,
      deletedDocuments: 1,
      deletedStatements: 1,
    })
    expect(markStatementDeletedMock).not.toHaveBeenCalled()
  })
})
