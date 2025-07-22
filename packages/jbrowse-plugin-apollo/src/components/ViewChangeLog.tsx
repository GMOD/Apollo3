/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/use-unknown-in-catch-callback-variable */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { type AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import FirstPageIcon from '@mui/icons-material/FirstPage'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowLeft from '@mui/icons-material/KeyboardArrowLeft'
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import LastPageIcon from '@mui/icons-material/LastPage'
import {
  DialogContent,
  DialogContentText,
  Grid2,
  MenuItem,
  Select,
  type SelectChangeEvent,
  TextField,
  Tooltip,
} from '@mui/material'
import Box from '@mui/material/Box'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableFooter from '@mui/material/TableFooter'
import TableHead from '@mui/material/TableHead'
import TablePagination from '@mui/material/TablePagination'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { getRoot } from 'mobx-state-tree'
import React, { useEffect, useRef, useState } from 'react'

import { type ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { type ApolloSessionModel } from '../session'
import { type ApolloRootModel } from '../types'
import { createFetchErrorMessage } from '../util'
import { copyToClipboard } from '../util/copyToClipboard'

import { Dialog } from './Dialog'

interface ViewChangeLogProps {
  session: ApolloSessionModel
  handleClose(): void
}

interface AssemblyDocument {
  _id: string
  name: string
}

interface TablePaginationActionsProps {
  count: number
  page: number
  rowsPerPage: number
  onPageChange: (
    event: React.MouseEvent<HTMLButtonElement>,
    newPage: number,
  ) => void
}

interface Change {
  _id: string
  assembly?: string
  typeName: string
  changedIds: string[]
  changes?: any[]
  user: string
  sequence?: number
  createdAt?: string
  updatedAt?: string
}

interface DiffAttributes {
  attribute: string
  old: string[]
  new: string[]
}

const changeTypeMapping: Record<string, string> = {
  FeatureAttributeChange: 'Attribute Change',
  UserChange: 'User Change',
  UndoSplitExonChange: 'Undo Split Exon',
  UndoMergeTranscriptsChange: 'Undo Merge Transcripts',
  UndoMergeExonsChange: 'Undo Merge Exons',
  TypeChange: 'Type Change',
  StrandChange: 'Strand Change',
  SplitExonChange: 'Split Exon',
  MergeTranscriptsChange: 'Merge Transcripts',
  MergeExonsChange: 'Merge Exons',
  LocationStartChange: 'Location Start Change',
  LocationEndChange: 'Location End Change',
  DeleteUserChange: 'Delete User',
  DeleteFeatureChange: 'Delete Feature',
  DeleteAssemblyChange: 'Delete Assembly',
  AddFeatureChange: 'Add Feature',
}

function getFeatureId(feature: AnnotationFeatureSnapshot | undefined): string {
  if (!feature) {
    return ''
  }
  const keys = ['gene_id', 'transcript_id', 'exon_id', 'protein_id']
  for (const key of keys) {
    const value = feature.attributes?.[key]
    if (value && Array.isArray(value) && value.length > 0) {
      return value[0] as string
    }
  }
  return feature._id || ''
}

export function ViewChangeLog({ handleClose, session }: ViewChangeLogProps) {
  const { internetAccounts } = getRoot<ApolloRootModel>(session)
  const apolloInternetAccount = internetAccounts.find(
    (ia) => ia.type === 'ApolloInternetAccount',
  ) as ApolloInternetAccountModel | undefined
  if (!apolloInternetAccount) {
    throw new Error('No Apollo internet account found')
  }
  const { baseURL } = apolloInternetAccount
  const [errorMessage, setErrorMessage] = useState<string>()
  const [assemblyCollection, setAssemblyCollection] = useState<
    AssemblyDocument[]
  >([])
  const [assemblyId, setAssemblyId] = useState<string>('')
  const [tableData, setTableData] = useState<Change[]>([])
  const [page, setPage] = React.useState(0)
  const [rowsPerPage, setRowsPerPage] = React.useState(5)
  const [searchText, setSearchText] = useState<string>('')

  useEffect(() => {
    async function getAssemblies() {
      const uri = new URL('assemblies', baseURL).href
      const apolloFetch = apolloInternetAccount?.getFetcher({
        locationType: 'UriLocation',
        uri,
      })
      if (apolloFetch) {
        const response = await apolloFetch(uri, { method: 'GET' })
        if (!response.ok) {
          const newErrorMessage = await createFetchErrorMessage(
            response,
            'Error when retrieving assemblies from server',
          )
          setErrorMessage(newErrorMessage)
          return
        }
        const data = (await response.json()) as AssemblyDocument[]
        setAssemblyCollection(data)
      }
    }
    getAssemblies().catch((error) => {
      setErrorMessage(String(error))
    })
  }, [apolloInternetAccount, baseURL])

  useEffect(() => {
    if (!assemblyId && assemblyCollection.length > 0) {
      setAssemblyId(assemblyCollection[0]._id)
    }
  }, [assemblyId, assemblyCollection])

  useEffect(() => {
    async function getGridData() {
      if (!assemblyId) {
        return
      }

      // Get changes
      const url = new URL('changes', baseURL)
      const searchParams = new URLSearchParams({ assembly: assemblyId })
      url.search = searchParams.toString()
      const uri = url.toString()
      const apolloFetch = apolloInternetAccount?.getFetcher({
        locationType: 'UriLocation',
        uri,
      })
      if (apolloFetch) {
        const response = await apolloFetch(uri, {
          headers: new Headers({ 'Content-Type': 'application/json' }),
        })
        if (!response.ok) {
          const newErrorMessage = await createFetchErrorMessage(
            response,
            'Error when retrieving changes',
          )
          setErrorMessage(newErrorMessage)
          return
        }
        const data = await response.json()
        const changes = data as Change[]
        const changesData: Change[] = []
        for (const change of changes) {
          const { changedIds } = change
          const changesArray = Array.isArray(change.changes)
            ? change.changes
            : []
          let i = 0
          for (const c of changesArray) {
            const newChange: Change = {
              ...change,
              changes: [c],
              _id: `${change._id}-${i}`,
            }
            if (
              'featureId' in c &&
              changedIds.includes(c.featureId as string)
            ) {
              newChange.changedIds = [c.featureId as string]
              newChange._id = `${change._id}-${c.featureId}`
            }
            changesData.push(newChange)
            i++
          }
        }

        setTableData(changesData)
      }
    }
    getGridData().catch((error) => {
      setErrorMessage(String(error))
    })
  }, [assemblyId, apolloInternetAccount, baseURL])

  function handleChangeAssembly(e: SelectChangeEvent) {
    setAssemblyId(e.target.value)
  }

  const handleChangePage = (
    event: React.MouseEvent<HTMLButtonElement> | null,
    newPage: number,
  ) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setRowsPerPage(Number.parseInt(event.target.value, 10))
    setPage(0)
  }

  const getRowsForPage = () => {
    const rows =
      rowsPerPage > 0
        ? getFilteredRows().slice(
            page * rowsPerPage,
            page * rowsPerPage + rowsPerPage,
          )
        : getFilteredRows()
    return rows
  }

  const getFilteredRows = () => {
    if (!searchText || searchText.trim() === '') {
      return tableData
    }

    const lower = searchText.toLowerCase()
    return tableData.filter((row) => {
      const {
        _id = '',
        typeName = '',
        user = '',
        createdAt = '',
        updatedAt = '',
        changedIds = [],
        changes = [],
      } = row

      const content = [
        _id,
        typeName,
        user,
        createdAt,
        updatedAt,
        ...changedIds,
        JSON.stringify(changes),
      ]
        .join(' ')
        .toLowerCase()

      return content.includes(lower)
    })
  }

  return (
    <Dialog
      open
      title="Change history"
      handleClose={handleClose}
      data-testid="view-changelog"
      maxWidth="xl"
      fullWidth
    >
      <DialogContent>
        <Grid2 container spacing={2}>
          <Grid2 size={6}>
            <Select
              value={assemblyId}
              onChange={handleChangeAssembly}
              size="small"
              style={{
                width: 300,
                margin: 0,
              }}
            >
              {assemblyCollection.map((option) => (
                <MenuItem key={option._id} value={option._id}>
                  {option.name}
                </MenuItem>
              ))}
            </Select>
          </Grid2>
          <Grid2 size={6}>
            <TextField
              id="outlined-basic"
              label="Filter"
              size="small"
              variant="outlined"
              style={{
                float: 'right',
                width: 300,
                margin: 0,
              }}
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value)
              }}
            />
          </Grid2>
          <Grid2 size={12} sx={{ height: '70vh', overflowY: 'scroll' }}>
            <TableContainer component={Paper}>
              <Table aria-label="collapsible table">
                <TableHead>
                  <TableRow>
                    <TableCell />
                    <TableCell>Change type</TableCell>
                    <TableCell>Feature ID</TableCell>
                    <TableCell align="right">User</TableCell>
                    <TableCell align="right">Created At</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {getRowsForPage().map((row) => (
                    <Row
                      key={row._id}
                      row={row}
                      session={session}
                      assemblyId={assemblyId}
                    />
                  ))}
                  {getRowsForPage().length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        No changes found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={6} align="left">
                      <TablePagination
                        rowsPerPageOptions={[
                          5,
                          10,
                          25,
                          { label: 'All', value: -1 },
                        ]}
                        colSpan={3}
                        count={getFilteredRows().length}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        slotProps={{
                          select: {
                            inputProps: {
                              'aria-label': 'rows per page',
                            },
                            native: true,
                          },
                        }}
                        onPageChange={handleChangePage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                        ActionsComponent={TablePaginationActions}
                      />
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </TableContainer>
          </Grid2>
        </Grid2>
      </DialogContent>
      {errorMessage ? (
        <DialogContent>
          <DialogContentText color="error">{errorMessage}</DialogContentText>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

function Row(props: {
  row: Change
  key: string
  session: ApolloSessionModel
  assemblyId: string
}) {
  const { row, key, session, assemblyId } = props
  const [open, setOpen] = React.useState(false)
  const [collapsedContent, setCollapsedContent] =
    useState<React.ReactNode>(null)

  // TODO: Refactor
  useEffect(() => {
    switch (row.typeName) {
      case 'LocationStartChange':
      case 'LocationEndChange': {
        setCollapsedContent(
          <CollapsedLocationChangeContent
            row={row}
            session={session}
            assemblyId={assemblyId}
          />,
        )
        break
      }
      case 'FeatureAttributeChange': {
        setCollapsedContent(
          <CollapsedFeatureAttributeContent
            row={row}
            session={session}
            assemblyId={assemblyId}
          />,
        )
        break
      }
      case 'TypeChange': {
        setCollapsedContent(
          <CollapsedTypeChangeContent
            row={row}
            session={session}
            assemblyId={assemblyId}
          />,
        )
        break
      }
      default: {
        setCollapsedContent(<CollapsedJsonContent row={row} />)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row])

  return (
    <React.Fragment>
      <TableRow key={key} sx={{ borderBottom: '1px solid #e0e0e0' }}>
        <TableCell
          sx={{ borderBottom: 'none', width: '40px', maxWidth: '40px' }}
        >
          <IconButton
            aria-label="expand row"
            size="small"
            onClick={() => {
              setOpen(!open)
            }}
          >
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell component="th" scope="row" sx={{ borderBottom: 'none' }}>
          {changeTypeMapping[row.typeName] || row.typeName}
        </TableCell>
        <TableCell sx={{ borderBottom: 'none' }}>
          {row.changedIds.length > 0 ? row.changedIds.join(', ') : '-'}
        </TableCell>
        <TableCell align="right" sx={{ borderBottom: 'none' }}>
          {row.user}
        </TableCell>
        <TableCell align="right" sx={{ borderBottom: 'none' }}>
          {row.createdAt}
        </TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <Box sx={{ margin: 1 }}>{collapsedContent}</Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </React.Fragment>
  )
}

function CollapsedTypeChangeContent(props: {
  row: Change
  session: ApolloSessionModel
  assemblyId: string
}) {
  const { row, session, assemblyId } = props
  const [featureId] = row.changedIds
  const [gene, setGene] = useState<AnnotationFeatureSnapshot | undefined>()
  const [feature, setFeature] = useState<
    AnnotationFeatureSnapshot | undefined
  >()
  const [diffAttributes, setDiffAttributes] = useState<DiffAttributes[]>([])

  useEffect(() => {
    const fetchFeature = async () => {
      if (!featureId) {
        return
      }
      const driver = session.apolloDataStore.collaborationServerDriver
      const fetchedFeature = await driver.getFeatureById(
        featureId,
        assemblyId,
        true,
      )
      setGene(fetchedFeature)
      if (!fetchedFeature) {
        return
      }
      if (featureId === fetchedFeature._id) {
        setFeature(fetchedFeature)
        return
      }
      for (const [k, t] of new Map(
        Object.entries(fetchedFeature.children ?? {}),
      )) {
        if (k === featureId) {
          setFeature(t)
          return
        }
        for (const [tk, c] of new Map(Object.entries(t.children ?? {}))) {
          if (tk === featureId) {
            setFeature(c)
            return
          }
        }
      }
    }
    fetchFeature().catch((error) => {
      console.error('Error fetching feature by ID:', error)
      setFeature(undefined)
    })

    const diffAttrs: DiffAttributes[] = []

    diffAttrs.push({
      attribute: '',
      old: [String(row.changes?.[0].oldType)],
      new: [String(row.changes?.[0].newType)],
    })
    setDiffAttributes(diffAttrs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featureId, assemblyId])

  if (!feature) {
    return <CollapsedJsonContent {...props} />
  }

  return (
    <div>
      <CollapsedInfoContent feature={feature} gene={gene} row={row} />
      <CollapsedDiffAttributesContent diffAttributes={diffAttributes} />
    </div>
  )
}

function CollapsedLocationChangeContent(props: {
  row: Change
  session: ApolloSessionModel
  assemblyId: string
}) {
  const { row, session, assemblyId } = props
  const [featureId] = row.changedIds
  const [gene, setGene] = useState<AnnotationFeatureSnapshot | undefined>()
  const [feature, setFeature] = useState<
    AnnotationFeatureSnapshot | undefined
  >()
  const [diffAttributes, setDiffAttributes] = useState<DiffAttributes[]>([])

  useEffect(() => {
    const fetchFeature = async () => {
      if (!featureId) {
        return
      }
      const driver = session.apolloDataStore.collaborationServerDriver
      const fetchedFeature = await driver.getFeatureById(
        featureId,
        assemblyId,
        true,
      )
      setGene(fetchedFeature)
      if (!fetchedFeature) {
        return
      }
      if (featureId === fetchedFeature._id) {
        setFeature(fetchedFeature)
        return
      }
      for (const [k, t] of new Map(
        Object.entries(fetchedFeature.children ?? {}),
      )) {
        if (k === featureId) {
          setFeature(t)
          return
        }
        for (const [tk, c] of new Map(Object.entries(t.children ?? {}))) {
          if (tk === featureId) {
            setFeature(c)
            return
          }
        }
      }
    }
    fetchFeature().catch((error) => {
      console.error('Error fetching feature by ID:', error)
      setFeature(undefined)
    })

    const diffAttrs: DiffAttributes[] = []

    if (row.typeName === 'LocationStartChange') {
      diffAttrs.push({
        attribute: '',
        old: [String(row.changes?.[0].oldStart)],
        new: [String(row.changes?.[0].newStart)],
      })
    }
    if (row.typeName === 'LocationEndChange') {
      diffAttrs.push({
        attribute: '',
        old: [String(row.changes?.[0].oldEnd)],
        new: [String(row.changes?.[0].newEnd)],
      })
    }
    setDiffAttributes(diffAttrs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featureId, assemblyId])

  if (!feature) {
    return <CollapsedJsonContent {...props} />
  }

  return (
    <div>
      <CollapsedInfoContent feature={feature} gene={gene} row={row} />
      <CollapsedDiffAttributesContent diffAttributes={diffAttributes} />
    </div>
  )
}

function CollapsedFeatureAttributeContent(props: {
  row: Change
  session: ApolloSessionModel
  assemblyId: string
}) {
  const { row, session, assemblyId } = props
  const [featureId] = row.changedIds
  const [gene, setGene] = useState<AnnotationFeatureSnapshot | undefined>()
  const [feature, setFeature] = useState<
    AnnotationFeatureSnapshot | undefined
  >()
  const [diffAttributes, setDiffAttributes] = useState<DiffAttributes[]>([])

  const getDiffAttributes = (
    oldAttrs: Record<string, string[]>,
    newAttrs: Record<string, string[]>,
  ): DiffAttributes[] => {
    const allKeys = new Set([
      ...Object.keys(oldAttrs),
      ...Object.keys(newAttrs),
    ])
    const diff: DiffAttributes[] = []

    for (const key of allKeys) {
      const oldValues = oldAttrs[key] ?? []
      const newValues = newAttrs[key] ?? []

      const oldSet = new Set(oldValues)
      const newSet = new Set(newValues)
      const isEqual =
        oldValues.length === newValues.length &&
        oldSet.size === newSet.size &&
        [...oldSet].every((value) => newSet.has(value))

      if (!isEqual) {
        diff.push({
          attribute: key,
          old: oldValues,
          new: newValues,
        })
      }
    }
    return diff
  }

  useEffect(() => {
    const fetchFeature = async () => {
      if (!featureId) {
        return
      }
      const driver = session.apolloDataStore.collaborationServerDriver
      const fetchedFeature = await driver.getFeatureById(
        featureId,
        assemblyId,
        true,
      )
      setGene(fetchedFeature)
      if (!fetchedFeature) {
        return
      }
      if (featureId === fetchedFeature._id) {
        setFeature(fetchedFeature)
        return
      }
      for (const [k, t] of new Map(
        Object.entries(fetchedFeature.children ?? {}),
      )) {
        if (k === featureId) {
          setFeature(t)
          return
        }
        for (const [tk, c] of new Map(Object.entries(t.children ?? {}))) {
          if (tk === featureId) {
            setFeature(c)
            return
          }
        }
      }
    }
    fetchFeature().catch((error) => {
      console.error('Error fetching feature by ID:', error)
      setFeature(undefined)
    })

    const diffAttrs = getDiffAttributes(
      row.changes?.[0].oldAttributes as Record<string, string[]>,
      row.changes?.[0].newAttributes as Record<string, string[]>,
    )
    setDiffAttributes(diffAttrs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featureId, assemblyId])

  if (!feature) {
    return <CollapsedJsonContent {...props} />
  }

  return (
    <div>
      <CollapsedInfoContent feature={feature} gene={gene} row={row} />
      <CollapsedDiffAttributesContent diffAttributes={diffAttributes} />
    </div>
  )
}

function CollapsedDiffAttributesContent(props: {
  diffAttributes: DiffAttributes[]
}) {
  const { diffAttributes } = props

  return (
    <div>
      {diffAttributes.length > 0 && (
        <TableContainer component={Paper} style={{ margin: 10 }}>
          <Table size="small">
            <TableBody>
              <TableRow style={{ borderTop: '1px solid #e0e0e0' }}>
                <TableCell align="left">
                  <small>Attribute</small>
                </TableCell>
                <TableCell align="left">
                  <small>Old</small>
                </TableCell>
                <TableCell align="left">
                  <small>New</small>
                </TableCell>
              </TableRow>
              {diffAttributes.map((attr, index) => (
                <TableRow key={index}>
                  <TableCell align="left">
                    <small>{attr.attribute}</small>
                  </TableCell>
                  <TableCell>
                    {attr.old.length > 0 ? (
                      <ul>
                        {attr.old.map((value, i) => (
                          <li key={i}>{value}</li>
                        ))}
                      </ul>
                    ) : (
                      <small>N/A</small>
                    )}
                  </TableCell>
                  <TableCell align="left">
                    {attr.new.length > 0 ? (
                      <ul>
                        {attr.new.map((value, i) => (
                          <li key={i}>{value}</li>
                        ))}
                      </ul>
                    ) : (
                      <small>N/A</small>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </div>
  )
}

function CollapsedInfoContent(props: {
  feature: AnnotationFeatureSnapshot
  gene: AnnotationFeatureSnapshot | undefined
  row: Change
}) {
  const { feature, gene, row } = props

  const getFeatureStatus = (): string => {
    if (!gene) {
      return 'Unknown'
    }
    const savedAt: string | undefined = gene.attributes?.savedAt?.[0]

    if (savedAt && row.updatedAt) {
      const havanaSavedAtDate = new Date(savedAt)
      const geneUpdatedAtDate = new Date(row.updatedAt)

      if (havanaSavedAtDate >= geneUpdatedAtDate) {
        return 'Done'
      }
    }
    return 'Pending'
  }

  return (
    <TableContainer component={Paper} style={{ margin: 10 }}>
      <Table size="small">
        <TableBody>
          <TableRow style={{ borderTop: '1px solid #e0e0e0' }}>
            <TableCell>
              <small>Type</small>
            </TableCell>
            <TableCell>
              <small>Feature ID</small>
            </TableCell>
            {gene?.type !== feature.type && (
              <TableCell>
                <small>Gene ID</small>
              </TableCell>
            )}
            <TableCell>
              <small>Status</small>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>
              <small>{feature.type}</small>
            </TableCell>
            <TableCell>
              <small>{getFeatureId(feature)}</small>
            </TableCell>
            {gene?.type !== feature.type && (
              <TableCell>
                <small>{getFeatureId(gene)}</small>
              </TableCell>
            )}
            <TableCell>
              <small>{getFeatureStatus()}</small>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function CollapsedJsonContent(props: { row: Change }) {
  const { row } = props
  const objectRef = useRef<HTMLDivElement>(null)

  const onCopyClick = () => {
    const objectDiv = objectRef.current
    if (!objectDiv) {
      return
    }
    void copyToClipboard(objectDiv)
  }

  return (
    <div>
      <div
        style={{
          marginTop: 10,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Typography>Change Object</Typography>
        <Tooltip title="Copy">
          <ContentCopyIcon
            style={{ fontSize: 15, cursor: 'pointer' }}
            onClick={onCopyClick}
          />
        </Tooltip>
      </div>
      <div
        style={{
          height: '100px',
          overflowY: 'scroll',
          border: '1px solid #e0e0e0',
          borderRadius: 5,
        }}
        ref={objectRef}
      >
        <pre>{JSON.stringify(row.changes, null, 2)}</pre>
      </div>
    </div>
  )
}

function TablePaginationActions(props: TablePaginationActionsProps) {
  const theme = useTheme()
  const { count, page, rowsPerPage, onPageChange } = props

  const handleFirstPageButtonClick = (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    onPageChange(event, 0)
  }

  const handleBackButtonClick = (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    onPageChange(event, page - 1)
  }

  const handleNextButtonClick = (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    onPageChange(event, page + 1)
  }

  const handleLastPageButtonClick = (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    onPageChange(event, Math.max(0, Math.ceil(count / rowsPerPage) - 1))
  }

  return (
    <Box sx={{ flexShrink: 0, ml: 2.5 }}>
      <IconButton
        onClick={handleFirstPageButtonClick}
        disabled={page === 0}
        aria-label="first page"
      >
        {theme.direction === 'rtl' ? <LastPageIcon /> : <FirstPageIcon />}
      </IconButton>
      <IconButton
        onClick={handleBackButtonClick}
        disabled={page === 0}
        aria-label="previous page"
      >
        {theme.direction === 'rtl' ? (
          <KeyboardArrowRight />
        ) : (
          <KeyboardArrowLeft />
        )}
      </IconButton>
      <IconButton
        onClick={handleNextButtonClick}
        disabled={page >= Math.ceil(count / rowsPerPage) - 1}
        aria-label="next page"
      >
        {theme.direction === 'rtl' ? (
          <KeyboardArrowLeft />
        ) : (
          <KeyboardArrowRight />
        )}
      </IconButton>
      <IconButton
        onClick={handleLastPageButtonClick}
        disabled={page >= Math.ceil(count / rowsPerPage) - 1}
        aria-label="last page"
      >
        {theme.direction === 'rtl' ? <FirstPageIcon /> : <LastPageIcon />}
      </IconButton>
    </Box>
  )
}
