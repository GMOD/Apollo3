import { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import { AppRootModel, getSession } from '@jbrowse/core/util'
import {
  Avatar,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
} from '@mui/material'
import { observer } from 'mobx-react'
import React, { useEffect, useState } from 'react'
import { makeStyles } from 'tss-react/mui'

import { ApolloInternetAccountModel } from '../../ApolloInternetAccount/model'
import { ApolloViewModel } from '../stateModel'

interface CollaborationSetupProps {
  viewModel: ApolloViewModel
  internetAccounts: AppRootModel['internetAccounts']
  setAssembly(assembly: Assembly): void
  setInternetAccountConfigId(internetAccountConfigId: string): void
  setError(error: Error): void
}

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    background: theme.palette.background.default,
  },
  logo: {
    width: 100,
  },
  card: {
    margin: theme.spacing(2),
    flex: '300px',
    maxWidth: 300,
  },
  cardMedia: {
    background: theme.palette.primary.main,
    display: 'flex',
    alignItems: 'center',
    flexDirection: 'column',
  },
  cardMediaDisabled: {
    background: theme.palette.primary.light,
  },
  cardIcon: {
    fontSize: 100,
    color: theme.palette.primary.contrastText,
  },
}))

function CollaborationSetup({
  internetAccounts,
  setAssembly,
  setInternetAccountConfigId,
  viewModel,
}: CollaborationSetupProps) {
  const { classes } = useStyles()
  const [selectedAccount, setSelectedAccount] = useState<number>()
  const apolloInternetAccounts = internetAccounts.filter(
    (internetAccount) => internetAccount.type === 'ApolloInternetAccount',
  ) as ApolloInternetAccountModel[]
  return (
    <div className={classes.root}>
      {apolloInternetAccounts.map((internetAccount, idx) => (
        <AccountCard
          internetAccount={internetAccount}
          key={internetAccount.id}
          setSelected={() => {
            setInternetAccountConfigId(
              internetAccount.configuration.internetAccountId,
            )
            setSelectedAccount(idx)
          }}
          disabled={selectedAccount !== undefined && selectedAccount !== idx}
          setAssembly={setAssembly}
          viewModel={viewModel}
        />
      ))}
    </div>
  )
}

interface AccountCardProps {
  internetAccount: ApolloInternetAccountModel
  setSelected(): void
  disabled: boolean
  setAssembly(assembly: Assembly): void
  viewModel: ApolloViewModel
}

interface ApolloAssembly {
  _id: string
  name: string
  displayName?: string
  description?: string
  aliases?: string[]
}

interface ApolloRefSeq {
  _id: string
  name: string
  description?: string
  length: string
  assembly: string
}

function AccountCard({
  internetAccount,
  setSelected,
  disabled,
  setAssembly,
  viewModel,
}: AccountCardProps) {
  const [error, setError] = useState<Error>()
  const [assemblies, setAssemblies] = useState<ApolloAssembly[]>()
  const [selectedAssemblyIdx, setSelectedAssemblyIdx] = useState<number>()
  const { classes } = useStyles()
  useEffect(() => {
    const aborter = new AbortController()
    const { signal } = aborter
    async function getAssemblies() {
      const { baseURL } = internetAccount
      const uri = new URL('assemblies', baseURL).href
      const fetch = internetAccount.getFetcher({
        locationType: 'UriLocation',
        uri,
      })
      let response
      try {
        response = await fetch(uri, { signal })
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)))
        return
      }
      if (!response.ok) {
        let errorMessage
        try {
          errorMessage = await response.text()
        } catch (e) {
          errorMessage = ''
        }
        setError(
          new Error(
            `Failed to fetch assemblies — ${response.status} (${
              response.statusText
            })${errorMessage ? ` (${errorMessage})` : ''}`,
          ),
        )
        return
      }
      let fetchedAssemblies
      try {
        fetchedAssemblies = (await response.json()) as ApolloAssembly[]
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)))
        return
      }
      setAssemblies(fetchedAssemblies)
    }
    getAssemblies()

    return () => {
      aborter.abort()
    }
  }, [internetAccount])

  async function setUpAssembly(assembly: ApolloAssembly) {
    const aborter = new AbortController()
    const { signal } = aborter
    const session = getSession(viewModel)
    if (!session) {
      throw new Error('Could not find session')
    }
    const { assemblyManager } = session
    let selectedAssembly = assemblyManager.get(assembly.name)
    if (!selectedAssembly) {
      const { baseURL } = internetAccount
      const searchParams = new URLSearchParams({ assembly: assembly._id })
      const uri = new URL(`refSeqs?${searchParams.toString()}`, baseURL).href
      const fetch = internetAccount.getFetcher({
        locationType: 'UriLocation',
        uri,
      })
      const response = await fetch(uri, { signal })
      if (!response.ok) {
        let errorMessage
        try {
          errorMessage = await response.text()
        } catch (e) {
          errorMessage = ''
        }
        throw new Error(
          `Failed to fetch fasta info — ${response.status} (${
            response.statusText
          })${errorMessage ? ` (${errorMessage})` : ''}`,
        )
      }
      const f = (await response.json()) as ApolloRefSeq[]

      const features = f.map((contig) => ({
        refName: contig.name,
        uniqueId: contig._id,
        start: 0,
        end: contig.length,
      }))
      const assemblyConfig = {
        name: assembly._id,
        aliases: [assembly.name, ...(assembly.aliases || [])],
        displayName: assembly.displayName,
        sequence: {
          trackId: `sequenceConfigId-${assembly.name}`,
          type: 'ReferenceSequenceTrack',
          adapter: {
            type: 'FromConfigRegionsAdapter',
            features,
          },
        },
      }
      session.addAssembly?.(assemblyConfig)
      selectedAssembly = assemblyManager.get(assembly._id)
    }
    if (!selectedAssembly) {
      throw new Error(`Assembly "${assembly.name}" could not be added`)
    }
    setAssembly(selectedAssembly)
  }

  if (error) {
    return <div>{String(error)}</div>
  }
  return (
    <Card className={classes.card}>
      <CardHeader
        title={internetAccount.name}
        subheader={internetAccount.description}
      />
      <CardContent>
        {assemblies ? (
          <List>
            {assemblies.map((assembly, idx) => (
              <ListItem
                button
                key={assembly._id}
                onClick={() => {
                  setSelectedAssemblyIdx(idx)
                  setSelected()
                  setUpAssembly(assembly)
                }}
                disabled={disabled || selectedAssemblyIdx !== undefined}
              >
                <ListItemAvatar>
                  {selectedAssemblyIdx !== undefined &&
                  selectedAssemblyIdx === idx ? (
                    <CircularProgress variant="indeterminate" />
                  ) : (
                    <Avatar>
                      {(assembly.displayName || assembly.name).slice(0, 1)}
                    </Avatar>
                  )}
                </ListItemAvatar>
                <ListItemText
                  primary={assembly.displayName || assembly.name}
                  secondary={`${assembly.name}${
                    assembly.aliases?.length
                      ? ` (${assembly.aliases.join(', ')})`
                      : ''
                  }`}
                />
              </ListItem>
            ))}
          </List>
        ) : (
          <CircularProgress variant="indeterminate" />
        )}
      </CardContent>
    </Card>
  )
}

const CollaborationSetupObserved = observer(CollaborationSetup)

export { CollaborationSetupObserved as CollaborationSetup }
