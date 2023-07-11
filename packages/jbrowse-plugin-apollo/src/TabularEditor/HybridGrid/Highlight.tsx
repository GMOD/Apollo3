import React from 'react'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()((theme) => ({
  highlighted: {
    background: 'orange',
  },
}))

const Highlight = ({
  text,
  highlight,
}: {
  text: string
  highlight: string
}) => {
  const { classes } = useStyles()
  if (!highlight) {
    return <>{text}</>
  }
  const split = text.split(highlight)
  if (split.length === 1) {
    return <>{text}</>
  }
  const highlighted: React.ReactNode[] = []
  for (let i = 0; i < split.length - 1; i++) {
    highlighted.push(split[i])
    highlighted.push(<span className={classes.highlighted}>{highlight}</span>)
  }
  return (
    <>
      {highlighted}
      {split[split.length - 1]}
    </>
  )
}

export default Highlight
