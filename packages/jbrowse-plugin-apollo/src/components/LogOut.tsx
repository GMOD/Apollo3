import { readConfObject } from '@jbrowse/core/configuration'
import type { BaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'
import { isAlive } from '@jbrowse/mobx-state-tree'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  MenuItem,
  Select,
  type SelectChangeEvent,
} from '@mui/material'
import React, { useState } from 'react'

import type { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { type ApolloRootModel, isApolloInternetAccount } from '../types'

import { Dialog } from './Dialog'

interface DeleteAssemblyProps {
  rootModel: ApolloRootModel
  handleClose(): void
}

function isPrivilegedApolloTrack(track: BaseTrackConfig) {
  const trackType = (track as unknown as { type?: string }).type
  const trackId = readConfObject(track, 'trackId') as string | undefined
  const displays =
    (readConfObject(track, 'displays') as { type?: string }[] | undefined) ?? []
  const hasApolloDisplay = displays.some((display) =>
    ['LinearApolloDisplay', 'LinearApolloSixFrameDisplay'].includes(
      display.type ?? '',
    ),
  )
  return (
    trackType === 'ApolloTrack' ||
    trackId?.startsWith('apollo_track_') ||
    hasApolloDisplay
  )
}

function removePrivilegedTracksForGuest(rootModel: ApolloRootModel) {
  const session = rootModel.session as unknown as
    | {
        tracks: BaseTrackConfig[]
        views?: unknown[]
        deleteTrackConf?: (conf: BaseTrackConfig) => void
        apolloSetSelectedFeature?: (feature?: unknown) => void
      }
    | undefined
  if (!session || !isAlive(rootModel.session)) {
    return
  }

  const jbrowse = rootModel.jbrowse as {
    tracks?: BaseTrackConfig[]
    deleteTrackConf?: (conf: BaseTrackConfig) => void
  }

  const byTrackId = new Map<string, BaseTrackConfig>()
  const collect = (tracks?: BaseTrackConfig[]) => {
    for (const track of tracks ?? []) {
      if (!isPrivilegedApolloTrack(track)) {
        continue
      }
      const trackId = readConfObject(track, 'trackId') as string | undefined
      byTrackId.set(trackId ?? String(byTrackId.size), track)
    }
  }

  collect(session.tracks)
  collect(jbrowse.tracks)

  session.apolloSetSelectedFeature?.()
  for (const track of byTrackId.values()) {
    session.deleteTrackConf?.(track)
    jbrowse.deleteTrackConf?.(track)
  }
}

export function LogOut({ handleClose, rootModel }: DeleteAssemblyProps) {
  const { internetAccounts } = rootModel
  const apolloInternetAccounts = internetAccounts.filter((account) => {
    try {
      if (!isAlive(account)) {
        return false
      }
      return isApolloInternetAccount(account)
    } catch {
      return false
    }
  }) as ApolloInternetAccountModel[]

  const initialSelectedAccount = apolloInternetAccounts[0]
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedInternetAccount, setSelectedInternetAccount] = useState(
    initialSelectedAccount,
  )

  if (apolloInternetAccounts.length === 0) {
    return null
  }

  function handleChangeInternetAccount(e: SelectChangeEvent) {
    const newlySelectedInternetAccount = apolloInternetAccounts.find(
      (ia) => ia.internetAccountId === e.target.value,
    )
    if (!newlySelectedInternetAccount) {
      throw new Error(
        `Could not find internetAccount with ID "${e.target.value}"`,
      )
    }
    setSelectedInternetAccount(newlySelectedInternetAccount)
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedInternetAccount) {
      return
    }
    setErrorMessage('')
    setIsSubmitting(true)
    void (async () => {
      try {
        selectedInternetAccount.removeToken()
        const guestLoginUrl = new URL(
          'auth/login',
          selectedInternetAccount.baseURL,
        )
        guestLoginUrl.search = new URLSearchParams({ type: 'guest' }).toString()
        const response = await fetch(guestLoginUrl.toString(), {
          method: 'GET',
        })
        if (!response.ok) {
          throw new Error(`Guest login failed (${response.status})`)
        }
        const { token } = (await response.json()) as { token?: string }
        if (!token) {
          throw new Error('Guest login did not return a token')
        }
        selectedInternetAccount.applyLoggedInToken(token)
        removePrivilegedTracksForGuest(rootModel)
        handleClose()
      } catch {
        setErrorMessage('Could not log out from this account. Please retry.')
      } finally {
        setIsSubmitting(false)
      }
    })()
  }

  return (
    <Dialog
      open
      title="Log out"
      handleClose={handleClose}
      maxWidth={false}
      data-testid="log-out"
    >
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          {apolloInternetAccounts.length > 1 ? (
            <>
              <DialogContentText>Select account</DialogContentText>
              <Select
                value={selectedInternetAccount.internetAccountId}
                onChange={handleChangeInternetAccount}
              >
                {apolloInternetAccounts.map((option) => (
                  <MenuItem key={option.id} value={option.internetAccountId}>
                    {option.name}
                  </MenuItem>
                ))}
              </Select>
            </>
          ) : null}
          <DialogContentText>
            Are you sure you want to log out?
          </DialogContentText>
        </DialogContent>

        <DialogActions>
          <Button
            disabled={!selectedInternetAccount || isSubmitting}
            variant="contained"
            type="submit"
          >
            {isSubmitting ? 'Logging out...' : 'Log Out'}
          </Button>
          <Button variant="outlined" type="button" onClick={handleClose}>
            Cancel
          </Button>
        </DialogActions>
      </form>
      {errorMessage ? (
        <DialogContent>
          <DialogContentText color="error">{errorMessage}</DialogContentText>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
