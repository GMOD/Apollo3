/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { TextField, TextFieldProps } from '@mui/material'
import { observer } from 'mobx-react'
import React, { useEffect, useState } from 'react'

interface StringTextFieldProps
  extends Omit<
    TextFieldProps,
    'type' | 'onChange' | 'onKeyDown' | 'onBlur' | 'ref'
  > {
  onChangeCommitted(newValue: string): void
  value: unknown
}

export const StringTextField = observer(function StringTextField({
  onChangeCommitted,
  value: initialValue,
  ...props
}: StringTextFieldProps) {
  const [value, setValue] = useState(String(initialValue))
  const [blur, setBlur] = useState(false)
  const [inputNode, setInputNode] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    setValue(String(initialValue))
  }, [initialValue])

  useEffect(() => {
    if (blur) {
      inputNode?.blur()
      setBlur(false)
    }
  }, [blur, inputNode])

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    setValue(event.target.value)
  }

  return (
    <TextField
      {...props}
      type="text"
      onChange={onChange}
      value={value}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          inputNode?.blur()
        } else if (event.key === 'Escape') {
          setValue(String(initialValue))
          setBlur(true)
        }
      }}
      onBlur={() => {
        if (value !== String(initialValue)) {
          onChangeCommitted(value)
        }
      }}
      inputRef={(node) => {
        setInputNode(node)
      }}
    />
  )
})
