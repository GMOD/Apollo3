import { observer } from 'mobx-react'
import React, { useEffect, useState } from 'react'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()((theme) => ({
  inputWrapper: {
    position: 'relative',
  },
  hiddenWidthSpan: {
    padding: theme.spacing(0.5),
    color: 'transparent',
  },
  numberTextInput: {
    border: 'none',
    background: 'inherit',
    font: 'inherit',
    position: 'absolute',
    width: '100%',
    left: 0,
  },
}))

interface NumberCellProps {
  initialValue: number
  notifyError(error: Error): void
  onChangeCommitted(newValue: number): Promise<void>
}

export const NumberCell = observer(function NumberCell({
  initialValue,
  notifyError,
  onChangeCommitted,
}: NumberCellProps) {
  const [value, setValue] = useState(initialValue)
  const [blur, setBlur] = useState(false)
  const [inputNode, setInputNode] = useState<HTMLInputElement | null>(null)
  const { classes } = useStyles()
  useEffect(() => {
    if (blur) {
      inputNode?.blur()
      setBlur(false)
    }
  }, [blur, inputNode])
  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const newValue = Number(event.target.value)
    if (!Number.isNaN(newValue)) {
      setValue(newValue)
    }
  }
  return (
    <span className={classes.inputWrapper}>
      <span className={classes.hiddenWidthSpan} aria-hidden>
        {value}
      </span>
      <input
        type="text"
        value={value}
        className={classes.numberTextInput}
        onChange={onChange}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            inputNode?.blur()
          } else if (event.key === 'Escape') {
            setValue(initialValue)
            setBlur(true)
          }
        }}
        onBlur={() => {
          if (value !== initialValue) {
            onChangeCommitted(value).catch(notifyError)
          }
        }}
        ref={(node) => setInputNode(node)}
      />
    </span>
  )
})
