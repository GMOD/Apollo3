import { AnnotationFeature } from '@apollo-annotation/mst'
import { FeatureAttributeChange } from '@apollo-annotation/shared'
import { AbstractSessionModel } from '@jbrowse/core/util'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import {
  Button,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Typography,
} from '@mui/material'
import { entries } from 'mobx'
import { observer } from 'mobx-react'
import { getSnapshot } from 'mobx-state-tree'
import React, { useState } from 'react'
import { makeStyles } from 'tss-react/mui'

import { ApolloSessionModel } from '../session'
import { AddNewAttribute } from './AddNewAttributeForm'
import { AttributeKey } from './AttributeKey'
import { DefaultAttributeEditor } from './DefaultAttributeEditor'

const useStyles = makeStyles()((theme) => ({
  list: {
    'li:nth-of-type(odd)': {
      backgroundColor: theme.palette.action.focus,
    },
    'li:nth-of-type(even)': {
      backgroundColor: theme.palette.action.hover,
    },
  },
}))

export const Attributes = observer(function Attributes({
  assembly,
  editable,
  feature,
  session,
}: {
  feature: AnnotationFeature
  session: ApolloSessionModel
  assembly: string
  editable: boolean
}) {
  const { classes } = useStyles()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [selectedKey, setSelectedKey] = useState<null | string>(null)
  const [editingKey, setEditingKey] = useState<null | string>(null)
  const [showAddNewForm, setShowAddNewForm] = useState(false)
  const [newKey, setNewKey] = useState<string | undefined>()

  const open = Boolean(anchorEl)

  const { changeManager } = session.apolloDataStore
  const { notify } = session as unknown as AbstractSessionModel

  function handleListMenuClick(
    event: React.MouseEvent<HTMLButtonElement>,
    key: string,
  ) {
    setAnchorEl(event.currentTarget)
    setSelectedKey(key)
  }
  function handleClose() {
    setAnchorEl(null)
    setSelectedKey(null)
  }
  function handleDelete() {
    if (selectedKey) {
      deleteFeatureAttribute(selectedKey)
    }
    handleClose()
  }
  function handleEdit() {
    if (selectedKey) {
      setEditingKey(selectedKey)
    }
    handleClose()
  }

  const { _id, attributes } = feature

  function deleteFeatureAttribute(key: string) {
    const attributesSerialized = getSnapshot(attributes)
    const { [key]: deletedAttribute, ...remainingAttributes } =
      attributesSerialized
    const change = new FeatureAttributeChange({
      changedIds: [_id],
      typeName: 'FeatureAttributeChange',
      assembly,
      featureId: _id,
      attributes: remainingAttributes,
    })
    void changeManager.submit(change)
  }

  function modifyFeatureAttribute(key: string, attribute: string[]) {
    const serializedAttributes = { ...getSnapshot(attributes) }
    if (!(key in serializedAttributes)) {
      notify(`"${key}" not found in feature attributes`, 'error')
      return
    }
    const oldAttribute = serializedAttributes[key]
    if (oldAttribute.toString() === attribute.toString()) {
      return
    }
    serializedAttributes[key] = attribute

    const change = new FeatureAttributeChange({
      changedIds: [feature._id],
      typeName: 'FeatureAttributeChange',
      assembly,
      featureId: feature._id,
      attributes: serializedAttributes,
    })
    void changeManager.submit(change)
  }

  function addFeatureAttribute(key: string, attribute: string[]) {
    const serializedAttributes = { ...getSnapshot(attributes) }
    if (key in serializedAttributes) {
      notify(`Feature already has attribute "${key}"`, 'error')
      return
    }
    serializedAttributes[key] = attribute

    const change = new FeatureAttributeChange({
      changedIds: [feature._id],
      typeName: 'FeatureAttributeChange',
      assembly,
      featureId: feature._id,
      attributes: serializedAttributes,
    })
    void changeManager.submit(change)
  }

  return (
    <>
      <List className={classes.list}>
        {entries(attributes).map(([key, values]) => (
          <ListItem
            key={key}
            secondaryAction={
              editable && !editingKey ? (
                <IconButton
                  edge="end"
                  onClick={(event) => {
                    handleListMenuClick(event, key)
                  }}
                >
                  <MoreHorizIcon />
                </IconButton>
              ) : null
            }
          >
            <ListItemText
              disableTypography
              primary={<AttributeKey attributeKey={key} />}
              secondary={
                editingKey === key ? (
                  <DefaultAttributeEditor
                    attributeValues={values as string[] | undefined}
                    setAttribute={(newValues) => {
                      setEditingKey(null)
                      if (newValues) {
                        modifyFeatureAttribute(key, newValues)
                      }
                    }}
                  />
                ) : (
                  (values as string[]).map((value) => (
                    <Typography
                      key={`${key}.${value}`}
                      variant="body2"
                      color="textSecondary"
                    >
                      {value}
                    </Typography>
                  ))
                )
              }
            />
          </ListItem>
        ))}
        {newKey ? (
          <ListItem>
            <ListItemText
              disableTypography
              primary={<AttributeKey attributeKey={newKey} />}
              secondary={
                <DefaultAttributeEditor
                  attributeValues={[]}
                  setAttribute={(newValues) => {
                    if (newValues) {
                      addFeatureAttribute(newKey, newValues)
                    }
                    setNewKey(undefined)
                  }}
                  isNew
                />
              }
            />
          </ListItem>
        ) : null}
      </List>
      {editable ? (
        <Button
          color="primary"
          variant="contained"
          disabled={showAddNewForm}
          onClick={() => {
            setShowAddNewForm(true)
          }}
        >
          Add new
        </Button>
      ) : null}
      {showAddNewForm ? (
        <Paper style={{ marginTop: 8 }}>
          <AddNewAttribute
            setKey={(newKey) => {
              setNewKey(newKey)
              setShowAddNewForm(false)
            }}
          />
        </Paper>
      ) : null}
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        <MenuItem onClick={handleDelete}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <Typography variant="inherit">Delete</Typography>
        </MenuItem>
        <MenuItem onClick={handleEdit}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <Typography variant="inherit">Edit</Typography>
        </MenuItem>
      </Menu>
    </>
  )
})
