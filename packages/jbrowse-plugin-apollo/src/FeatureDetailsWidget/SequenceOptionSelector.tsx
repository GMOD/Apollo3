import { MenuItem, Select, type SelectChangeEvent } from '@mui/material'

import type { SegmentListType } from './sequenceSegments'

export function SequenceOptionSelector({
  onChange,
  options,
  value,
}: {
  options: SegmentListType[]
  value: SegmentListType
  onChange: (value: SegmentListType) => void
}) {
  return (
    <Select
      value={value}
      onChange={(e: SelectChangeEvent) => {
        onChange(e.target.value as SegmentListType)
      }}
      size="small"
      data-testid="sequenceOptionSelector"
    >
      {options.map((option) => (
        <MenuItem
          key={option}
          value={option}
          data-testid={`sequenceOption-${option}`}
        >
          {option}
        </MenuItem>
      ))}
    </Select>
  )
}
export default SequenceOptionSelector
