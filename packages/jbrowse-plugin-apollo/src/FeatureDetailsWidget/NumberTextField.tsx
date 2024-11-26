/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { TextField, TextFieldProps } from '@mui/material'
import { observer } from 'mobx-react'
import React, { useEffect, useState } from 'react'

interface NumberTextFieldProps
  extends Omit<
    TextFieldProps,
    | 'type'
    | 'onChange'
    | 'onKeyDown'
    | 'onBlur'
    | 'ref'
    | 'error'
    | 'helperText'
  > {
  onChangeCommitted(newValue: number): void
  value: unknown
}

export const NumberTextField = observer(function NumberTextField({
  onChangeCommitted,
  value: initialValue,
  ...props
}: NumberTextFieldProps) {
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

  const error = Number.isNaN(Number(value))

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
        const valueAsNumber = Number(value)
        if (value !== String(initialValue)) {
          if (Number.isNaN(valueAsNumber)) {
            setValue(String(initialValue))
          } else {
            onChangeCommitted(valueAsNumber)
          }
        }
      }}
      inputRef={(node) => {
        setInputNode(node)
      }}
      error={error}
      helperText={error ? 'Not a valid number' : undefined}
    />
  )
})
