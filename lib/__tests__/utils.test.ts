import { describe, expect, it } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn', () => {
  it('junta classes', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('resolve conflito do Tailwind mantendo a última', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('ignora valores falsos', () => {
    expect(cn('a', false && 'b', undefined, 'c')).toBe('a c')
  })
})
