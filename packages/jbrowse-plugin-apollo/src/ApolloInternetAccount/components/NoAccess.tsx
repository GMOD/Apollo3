import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
} from '@mui/material'
import React, { useState } from 'react'

import { Dialog } from '../../components/Dialog'

/** Shown when the user is logged in but an admin hasn't given them a role */
export function NoAccess({
  email,
  handleCheckAgain,
  handleClose,
  handleSwitchAccount,
  name,
  username,
}: {
  name: string
  username: string
  email: string
  /** Resolves to whether the user has access now */
  handleCheckAgain: () => Promise<boolean>
  handleSwitchAccount: () => void
  handleClose: () => void
}) {
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  async function checkAgain() {
    setChecking(true)
    setCheckResult('')
    setErrorMessage('')
    try {
      const hasAccess = await handleCheckAgain()
      if (!hasAccess) {
        setCheckResult(
          `Still no access as of ${new Date().toLocaleTimeString()}.`,
        )
      }
    } catch (error) {
      setErrorMessage(
        `Could not check access: ${error instanceof Error ? error.message : String(error)}`,
      )
    } finally {
      setChecking(false)
    }
  }

  return (
    <Dialog
      open
      title={`No access to ${name} yet`}
      handleClose={handleClose}
      maxWidth="sm"
      data-testid="no-access"
    >
      <DialogContent>
        <DialogContentText>
          You&apos;re logged in as <strong>{username}</strong>
          {email && email !== username ? ` (${email})` : null}, but an
          administrator hasn&apos;t given this account access yet. Ask your
          administrator to give you access, then check again.
        </DialogContentText>
        {checkResult ? (
          <DialogContentText style={{ marginTop: 16 }}>
            {checkResult}
          </DialogContentText>
        ) : null}
        {errorMessage ? (
          <DialogContentText color="error" style={{ marginTop: 16 }}>
            {errorMessage}
          </DialogContentText>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          disabled={checking}
          onClick={() => {
            void checkAgain()
          }}
        >
          {checking ? 'Checking…' : 'Check again'}
        </Button>
        <Button variant="outlined" onClick={handleSwitchAccount}>
          Log in with a different account
        </Button>
        <Button variant="outlined" onClick={handleClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}
