import { describe, expect, it } from 'vitest'
import { isExpectedTextractProbeMiss } from '@/lib/server/textract'

describe('Textract health probe classification', () => {
  it('accepts the expected missing-job response', () => {
    expect(
      isExpectedTextractProbeMiss({
        name: 'InvalidJobIdException',
        message: 'The job id is invalid.',
      }),
    ).toBe(true)
  })

  it('does not treat AWS auth failures as healthy probe misses', () => {
    expect(
      isExpectedTextractProbeMiss({
        name: 'InvalidClientTokenId',
        message: 'The security token included in the request is invalid.',
      }),
    ).toBe(false)
    expect(
      isExpectedTextractProbeMiss({
        name: 'InvalidSignatureException',
        message: 'The request signature is invalid.',
      }),
    ).toBe(false)
  })
})
