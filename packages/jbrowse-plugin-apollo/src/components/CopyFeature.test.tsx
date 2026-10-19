import { describe, expect, it, jest } from '@jest/globals'
import React, { type ComponentProps, type PropsWithChildren } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Render the form without the dialog's browser-only portal.
jest.unstable_mockModule('./Dialog', () => ({
  Dialog: ({ children }: PropsWithChildren) => <div>{children}</div>,
}))

const { CopyFeature } = await import('./CopyFeature')

type Props = ComponentProps<typeof CopyFeature>

const session = {
  assemblyManager: {
    assemblyList: [
      { name: 'source', displayName: 'Source' },
      { name: 'target', displayName: 'Target' },
    ],
  },
} as unknown as Props['session']

describe('Copy feature coordinates', () => {
  it.each([
    [0, '1'],
    [100, '101'],
  ])(
    'prefills a feature starting at interbase %s as position %s',
    (min, position) => {
      const markup = renderToStaticMarkup(
        <CopyFeature
          session={session}
          sourceFeature={{ min } as Props['sourceFeature']}
          sourceAssemblyId="source"
          changeManager={{} as Props['changeManager']}
          handleClose={jest.fn()}
        />,
      )
      const input = /<input[^>]*type="number"[^>]*>/.exec(markup)?.[0]
      expect(input).toContain(`value="${position}"`)
    },
  )
})
