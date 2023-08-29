import { Dialog as JBDialog } from '@jbrowse/core/ui'
import CloseIcon from '@mui/icons-material/Close'
import { DialogProps, DialogTitle, IconButton } from '@mui/material'
import { observer } from 'mobx-react'
import React from 'react'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()((theme) => ({
  dialogTitle: {
    background: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    padding: theme.spacing(2),
  },
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1.5),
    color: theme.palette.primary.contrastText,
  },
}))

interface Props extends DialogProps {
  handleClose(): void
}

export const Dialog = observer(function JBrowseDialog(props: Props) {
  const { classes } = useStyles()
  const { handleClose, title, ...other } = props

  return (
    <JBDialog
      {...other}
      header={
        <>
          <DialogTitle className={classes.dialogTitle}>{title}</DialogTitle>
          <IconButton
            aria-label="close"
            onClick={handleClose}
            className={classes.closeButton}
          >
            <CloseIcon />
          </IconButton>
        </>
      }
    />
  )
})
