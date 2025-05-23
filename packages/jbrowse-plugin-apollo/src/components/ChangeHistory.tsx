/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { type AnnotationFeature } from '@apollo-annotation/mst'
import styled from '@emotion/styled'
import {
  Box,
  DialogContent,
  Grid2,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material'
import {
  DataGrid,
  type GridColDef,
  type GridValidRowModel,
} from '@mui/x-data-grid'
import { observer } from 'mobx-react'
import { getRoot } from 'mobx-state-tree'
import React, { useEffect } from 'react'

import { type ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { type ApolloSessionModel } from '../session'
import { type ApolloRootModel } from '../types'
import { getFeatureId, getFeatureName } from '../util'

import { Dialog } from './Dialog'

const StyledGridOverlay = styled('div')(() => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  '& .no-rows-primary': {
    fill: 'lightgray',
  },
  '& .no-rows-secondary': {
    fill: 'lightgray',
  },
}))

const CustomNoRowsOverlay = () => {
  return (
    <StyledGridOverlay>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        width={96}
        viewBox="0 0 452 257"
        aria-hidden
        focusable="false"
      >
        <path
          className="no-rows-primary"
          d="M348 69c-46.392 0-84 37.608-84 84s37.608 84 84 84 84-37.608 84-84-37.608-84-84-84Zm-104 84c0-57.438 46.562-104 104-104s104 46.562 104 104-46.562 104-104 104-104-46.562-104-104Z"
        />
        <path
          className="no-rows-primary"
          d="M308.929 113.929c3.905-3.905 10.237-3.905 14.142 0l63.64 63.64c3.905 3.905 3.905 10.236 0 14.142-3.906 3.905-10.237 3.905-14.142 0l-63.64-63.64c-3.905-3.905-3.905-10.237 0-14.142Z"
        />
        <path
          className="no-rows-primary"
          d="M308.929 191.711c-3.905-3.906-3.905-10.237 0-14.142l63.64-63.64c3.905-3.905 10.236-3.905 14.142 0 3.905 3.905 3.905 10.237 0 14.142l-63.64 63.64c-3.905 3.905-10.237 3.905-14.142 0Z"
        />
        <path
          className="no-rows-secondary"
          d="M0 10C0 4.477 4.477 0 10 0h380c5.523 0 10 4.477 10 10s-4.477 10-10 10H10C4.477 20 0 15.523 0 10ZM0 59c0-5.523 4.477-10 10-10h231c5.523 0 10 4.477 10 10s-4.477 10-10 10H10C4.477 69 0 64.523 0 59ZM0 106c0-5.523 4.477-10 10-10h203c5.523 0 10 4.477 10 10s-4.477 10-10 10H10c-5.523 0-10-4.477-10-10ZM0 153c0-5.523 4.477-10 10-10h195.5c5.523 0 10 4.477 10 10s-4.477 10-10 10H10c-5.523 0-10-4.477-10-10ZM0 200c0-5.523 4.477-10 10-10h203c5.523 0 10 4.477 10 10s-4.477 10-10 10H10c-5.523 0-10-4.477-10-10ZM0 247c0-5.523 4.477-10 10-10h231c5.523 0 10 4.477 10 10s-4.477 10-10 10H10c-5.523 0-10-4.477-10-10Z"
        />
      </svg>
      <Box sx={{ mt: 2 }}>No rows</Box>
    </StyledGridOverlay>
  )
}

interface ChangeHistoryMenu {
  id: string
  label: string
  feature: AnnotationFeature
  childrens: ChangeHistoryMenu[]
  isSelected: boolean
}

const columns: GridColDef[] = [
  { field: 'type', headerName: 'Type', width: 100 },
  { field: 'nameOrId', headerName: 'Name/ID', width: 200 },
  { field: 'status', headerName: 'Status', width: 150 },
  { field: 'changeType', headerName: 'Change Type', width: 200 },
  {
    field: 'change',
    headerName: 'Change',
    width: 300,
    renderCell: (params) => (
      <div style={{ whiteSpace: 'pre-wrap' }}>{params.value}</div>
    ),
  },
  { field: 'user', headerName: 'User', width: 150 },
  { field: 'createdAt', headerName: 'Created At', width: 150 },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getChangeInfo = (c: any) => {
  if (c.typeName === 'FeatureAttributeChange') {
    if (c.attributeAdded) {
      const addedAttribute = c.attributeAdded as Record<string, string[]>
      const [response] = Object.keys(addedAttribute).map(
        (key) => `${key}: ${addedAttribute[key].join(',')}`,
      )
      return `ADDED: \n${response}`
    }
    if (c.attributeEdited) {
      const oldAttribute = (c.attributeEdited.old ?? {}) as Record<
        string,
        string[]
      >
      const newAttribute = (c.attributeEdited.new ?? {}) as Record<
        string,
        string[]
      >
      const [old] = Object.keys(oldAttribute).map(
        (key) => `${key}: ${oldAttribute[key].join(',')}`,
      )
      const [newAttr] = Object.keys(newAttribute).map(
        (key) => `${key}: ${newAttribute[key].join(',')}`,
      )

      return `BEFORE UPDATE: \n${old} \nAFTER UPDATE: \n${newAttr}`
    }
    if (c.attributeDeleted) {
      const deletedAttribute = c.attributeDeleted as Record<string, string[]>
      const [response] = Object.keys(deletedAttribute).map(
        (key) => `${key}: ${deletedAttribute[key].join(',')}`,
      )
      return `DELETED: \n${response}`
    }
  }
  if (c.typeName === 'TypeChange') {
    return `OLD TYPE: \n${c.oldType} \nNEW TYPE: \n${c.newType}`
  }
  if (c.typeName === 'LocationEndChange') {
    return `OLD END: \n${c.oldEnd} \nNEW END: \n${c.newEnd}`
  }
  if (c.typeName === 'LocationStartChange') {
    return `OLD START: \n${c.oldStart} \nNEW START: \n${c.newStart}`
  }
  return ''
}

export const ChangeHistory = observer(function ChangeHistory(props: {
  feature: AnnotationFeature
  session: ApolloSessionModel
  handleClose: () => void
  assembly: string
}) {
  const { feature, session, handleClose, assembly } = props
  const { ontologyManager } = session.apolloDataStore
  const { featureTypeOntology } = ontologyManager

  const [menuItems, setMenuItems] = React.useState<ChangeHistoryMenu>()
  const [changesData, setChangesData] = React.useState<unknown>([])
  const [changeHistoryData, setChangeHistoryData] = React.useState<
    GridValidRowModel[]
  >([])

  const initializeMenuItems = () => {
    if (!featureTypeOntology) {
      return
    }
    let gene: AnnotationFeature | undefined
    let transcript: AnnotationFeature | undefined
    if (featureTypeOntology.isTypeOf(feature.type, 'gene')) {
      gene = feature
    }
    if (
      featureTypeOntology.isTypeOf(feature.type, 'CDS') ||
      featureTypeOntology.isTypeOf(feature.type, 'exon')
    ) {
      transcript = feature.parent
      gene = transcript?.parent
    }
    if (featureTypeOntology.isTypeOf(feature.type, 'transcript')) {
      transcript = feature
      gene = feature.parent
    }

    if (!gene) {
      return
    }

    const changeHistoryMenus: ChangeHistoryMenu = {
      id: gene._id,
      label: getFeatureName(gene) || getFeatureId(gene) || gene.type,
      feature: gene,
      childrens: [],
      isSelected: feature._id === gene._id,
    }

    for (const [, child] of gene.children ?? []) {
      let isSelected = false
      if (transcript && transcript._id === child._id) {
        isSelected = true
      }

      changeHistoryMenus.childrens.push({
        id: child._id,
        label: getFeatureName(child) || getFeatureId(child) || child.type,
        feature: child,
        childrens: [],
        isSelected,
      })
    }
    setMenuItems(changeHistoryMenus)
  }

  const fetchChangeHistoryData = async (features: AnnotationFeature[]) => {
    if (Array.isArray(changesData) && changesData.length > 0) {
      handleChangeHistoryData(changesData, features)
      return
    }

    const { internetAccounts } = getRoot<ApolloRootModel>(session)
    const apolloInternetAccount = internetAccounts.find(
      (ia) => ia.type === 'ApolloInternetAccount',
    ) as ApolloInternetAccountModel | undefined
    if (!apolloInternetAccount) {
      throw new Error('No Apollo internet account found')
    }
    const { baseURL } = apolloInternetAccount

    const url = new URL('changes', baseURL)
    const searchParams = new URLSearchParams({ assembly })
    url.search = searchParams.toString()
    const uri = url.toString()
    const apolloFetch = apolloInternetAccount.getFetcher({
      locationType: 'UriLocation',
      uri,
    })

    const response = await apolloFetch(uri, {
      headers: new Headers({ 'Content-Type': 'application/json' }),
    })
    if (!response.ok) {
      return
    }

    const changes = await response.json()
    setChangesData(changes)
    handleChangeHistoryData(changes, features)
  }

  const handleChangeHistoryData = (
    changes: unknown,
    features: AnnotationFeature[],
  ) => {
    if (!Array.isArray(changes)) {
      return
    }
    const changeHistory: GridValidRowModel[] = []
    for (const ch of changes) {
      if (ch.changes && ch.changes.length > 0) {
        for (const c of ch.changes) {
          for (const f of features) {
            try {
              const id =
                c.changedIds && c.changedIds.length > 0
                  ? c.changedIds[0]
                  : c.featureId
              if (id === f._id) {
                const changeData = {
                  id: String(ch._id) + String(id),
                  type: f.type,
                  nameOrId: getFeatureName(f) || getFeatureId(f) || '',
                  status: ch.processed ? 'Processed' : 'Not processed',
                  changeType: ch.typeName,
                  change: getChangeInfo(c),
                  user: ch.user,
                  createdAt: ch.createdAt,
                }
                changeHistory.push(changeData)
              }
            } catch {
              // pass
              console.error('Error in change history data', c)
            }
          }
        }
      }
    }
    setChangeHistoryData(changeHistory)
  }

  useEffect(() => {
    // Initialize the menu items when the component mounts or when the feature changes
    initializeMenuItems()

    // TODO: Note: If multiple changes are committed at once in a single API call, Will this work?
    // Now the changedIds in DB should be subset of the changedIds (below) passed as filter to the API
    const changedFeatures: AnnotationFeature[] = []

    let changedFeature: AnnotationFeature | undefined = feature
    if (
      featureTypeOntology &&
      (featureTypeOntology.isTypeOf(changedFeature.type, 'CDS') ||
        featureTypeOntology.isTypeOf(changedFeature.type, 'exon'))
    ) {
      // transcript
      changedFeature = feature.parent
    }

    if (!changedFeature) {
      return
    }

    changedFeatures.push(changedFeature)
    for (const [, child] of changedFeature.children ?? []) {
      changedFeatures.push(child)
      if (
        featureTypeOntology &&
        featureTypeOntology.isTypeOf(changedFeature.type, 'gene')
      ) {
        for (const [, grandChild] of child.children ?? []) {
          changedFeatures.push(grandChild)
        }
      }
    }

    fetchChangeHistoryData(changedFeatures).catch(() => {
      setChangeHistoryData([])
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feature])

  if (!menuItems) {
    return null
  }

  const handleMenuItemClick = (item: ChangeHistoryMenu) => {
    if (item.id === menuItems.id) {
      setMenuItems({
        ...menuItems,
        isSelected: true,
        childrens: menuItems.childrens.map((child) => ({
          ...child,
          isSelected: false,
        })),
      })
      // fetch change history data for the gene
      const { feature } = item
      const features: AnnotationFeature[] = []
      features.push(feature)
      for (const [, child] of feature.children ?? []) {
        features.push(child)
        for (const [, grandChild] of child.children ?? []) {
          features.push(grandChild)
        }
      }

      handleChangeHistoryData(changesData, features)
    } else {
      setMenuItems({
        ...menuItems,
        isSelected: false,
        childrens: menuItems.childrens.map((child) => ({
          ...child,
          isSelected: child.id === item.id,
        })),
      })
      // fetch change history data for the transcript
      const { feature } = item
      const features: AnnotationFeature[] = []
      features.push(feature)
      for (const [, child] of feature.children ?? []) {
        features.push(child)
      }
      handleChangeHistoryData(changesData, features)
    }
  }

  return (
    <Dialog
      open
      handleClose={handleClose}
      data-testid="change-history-dialog"
      title="Change History"
      maxWidth="xl"
      fullWidth
    >
      <DialogContent>
        <Grid2 container spacing={1} sx={{ p: 1 }}>
          <Grid2
            size={2}
            sx={{
              height: 'calc(80vh - 64px)',
              overflowY: 'scroll',
              border: '1px solid #ccc',
              borderRadius: 1,
            }}
          >
            <List sx={{ ml: 2 }}>
              {/* Gene */}
              <ListItem
                style={{
                  backgroundColor: menuItems.isSelected
                    ? '#f0f0f0'
                    : 'transparent',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  handleMenuItemClick(menuItems)
                }}
                disablePadding
              >
                <ListItemText
                  primary={
                    <Typography fontWeight="bold">
                      <small>{menuItems.label}</small>
                    </Typography>
                  }
                />
              </ListItem>

              {/* Transcripts */}
              <Box sx={{ borderLeft: '1px dashed #ccc' }}>
                {menuItems.childrens.map((m) => (
                  <Box key={m.id} sx={{ mt: 1, ml: 2 }}>
                    <ListItem
                      style={{
                        backgroundColor: m.isSelected
                          ? '#f0f0f0'
                          : 'transparent',
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        handleMenuItemClick(m)
                      }}
                      disablePadding
                    >
                      <ListItemText
                        primary={
                          <Typography>
                            <small>{m.label}</small>
                          </Typography>
                        }
                      />
                    </ListItem>
                  </Box>
                ))}
              </Box>
            </List>
          </Grid2>
          <Grid2
            size={10}
            sx={{ height: 'calc(80vh - 64px)', overflowY: 'scroll' }}
          >
            <DataGrid
              rows={changeHistoryData}
              columns={columns}
              slots={{ noRowsOverlay: CustomNoRowsOverlay }}
              getRowHeight={() => 'auto'}
            />
          </Grid2>
        </Grid2>
      </DialogContent>
    </Dialog>
  )
})
