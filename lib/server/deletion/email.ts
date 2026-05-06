import 'server-only'

import { getFromAddress, getResendClient } from '../resend'

export type DeletionReceiptEmailInput = {
  to: string
  filename: string
  deletedAt: string
}

export type DeletionReceiptEmailResult =
  | { ok: true; id: string | null }
  | { ok: false; errorCode: string }

export async function sendDeletionReceiptEmail(
  input: DeletionReceiptEmailInput,
): Promise<DeletionReceiptEmailResult> {
  try {
    const result = await getResendClient().emails.send({
      from: getFromAddress(),
      to: input.to,
      subject: 'PRIZM deletion receipt',
      text: [
        'Your PRIZM document has been deleted.',
        '',
        `Document: ${input.filename}`,
        `Deleted at: ${input.deletedAt}`,
        '',
        'This receipt confirms the uploaded PDF and derived statement data were removed from PRIZM runtime storage.',
      ].join('\n'),
    })

    if (result.error) {
      return { ok: false, errorCode: 'receipt_send_failed' }
    }

    return { ok: true, id: result.data?.id ?? null }
  } catch {
    return { ok: false, errorCode: 'receipt_send_failed' }
  }
}
