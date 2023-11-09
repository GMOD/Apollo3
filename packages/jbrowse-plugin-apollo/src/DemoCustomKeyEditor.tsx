import { Button } from '@mui/material'
import React from 'react'

import { AttributeValueEditorProps } from './components'

export function DemoCustomKeyEditor(props: AttributeValueEditorProps) {
  const { onChange, value } = props
  return (
    <div>
      {value}
      <Button
        variant="contained"
        onClick={() => onChange([crypto.randomUUID()])}
      >
        Assign random value
      </Button>
    </div>
  )
}
