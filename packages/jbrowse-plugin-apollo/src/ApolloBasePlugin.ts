import Plugin from '@jbrowse/core/Plugin'
import { FC } from 'react'

import { AttributeValueEditorProps } from './components'

export abstract class ApolloBasePlugin extends Plugin {
  abstract apolloRegisterReservedKeys(): [
    string,
    FC<AttributeValueEditorProps>,
  ][]
}
