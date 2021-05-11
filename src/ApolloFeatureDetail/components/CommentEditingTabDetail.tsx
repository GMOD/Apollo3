import { Button, makeStyles } from '@material-ui/core'
import { observer } from 'mobx-react'
import React, { useState, useEffect } from 'react'
import { AplInputProps, ApolloFeature } from '../ApolloFeatureDetail'
import CommentModal from './CommentModal'
import { DataGrid, GridEditCellPropsParams } from '@material-ui/data-grid'

interface Comment {
  [key: string]: string
}
const useStyles = makeStyles(() => ({
  buttons: {
    marginRight: 10,
  },
}))

const CommentEditingTabDetail = ({
  clickedFeature,
  props,
}: {
  clickedFeature: ApolloFeature
  props: AplInputProps
}) => {
  const { model } = props
  const classes = useStyles()
  const [comments, setComments] = useState([])
  const [commentDialogInfo, setCommentDialogInfo] = useState({
    open: false,
    selectedComment: '',
  })

  const handleClose = () => {
    setCommentDialogInfo({ open: false, selectedComment: '' })
  }

  const handleEditCellChangeCommitted = ({
    id,
    field,
    props,
  }: GridEditCellPropsParams) => {
    console.log(comments)
    const preChangeComment: Comment = JSON.parse(
      JSON.stringify(comments[id as number]),
    )
    const changedComment = `${props.value}`
    console.log(changedComment)
    const data = {
      username: sessionStorage.getItem(`${model.apolloId}-apolloUsername`),
      password: sessionStorage.getItem(`${model.apolloId}-apolloPassword`),
      sequence: clickedFeature.sequence,
      organism: 'Fictitious',
      features: [
        {
          uniquename: clickedFeature.uniquename,
          old_comments: [preChangeComment],
          new_comments: [changedComment],
        },
      ],
    }

    const endpointUrl = `${model.apolloUrl}/annotationEditor/updateComments`
    fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
  }

  useEffect(() => {
    async function fetchComments() {
      const data = {
        username: sessionStorage.getItem(`${model.apolloId}-apolloUsername`), // get from renderProps later
        password: sessionStorage.getItem(`${model.apolloId}-apolloPassword`),
        sequence: clickedFeature.sequence,
        organism: 'Fictitious', // need to find where in code is organism name
        features: [{ uniquename: clickedFeature.uniquename }],
      }

      const response = await fetch(
        `${model.apolloUrl}/annotationEditor/getComments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        },
      )
      const json = await response.json()
      setComments(json.comments || [])
    }
    fetchComments()
  }, [
    clickedFeature.uniquename,
    model.apolloUrl,
    model.apolloId,
    clickedFeature.sequence,
  ])

  const columns = [
    { field: 'comment', headerName: 'Comment', flex: 1, editable: true },
  ]

  const rows = comments.map((comment: string, index: number) => ({
    id: index,
    comment,
  }))

  return (
    <>
      <div style={{ height: 400, width: '100%' }}>
        <div style={{ display: 'flex', height: '100%' }}>
          <DataGrid
            disableColumnMenu
            hideFooterSelectedRowCount
            pageSize={25}
            rows={rows}
            columns={columns}
            onRowClick={rowData => {
              setCommentDialogInfo({
                ...commentDialogInfo,
                selectedComment: comments[rowData.row.id as number],
              })
            }}
            onEditCellChangeCommitted={handleEditCellChangeCommitted}
          />
        </div>
      </div>
      <div style={{ margin: 5 }}>
        <Button
          color="secondary"
          variant="contained"
          className={classes.buttons}
          onClick={async () =>
            setCommentDialogInfo({ open: true, selectedComment: '' })
          }
        >
          New
        </Button>
        <Button
          color="secondary"
          variant="contained"
          className={classes.buttons}
          disabled={!commentDialogInfo.selectedComment}
          onClick={async () => {
            setCommentDialogInfo({
              ...commentDialogInfo,
              open: true,
            })
          }}
        >
          Edit
        </Button>
        <Button
          color="secondary"
          variant="contained"
          className={classes.buttons}
          disabled={!commentDialogInfo.selectedComment}
          onClick={async () => {
            const data = {
              username: sessionStorage.getItem(
                `${model.apolloId}-apolloUsername`,
              ),
              password: sessionStorage.getItem(
                `${model.apolloId}-apolloPassword`,
              ),
              features: [
                {
                  uniquename: clickedFeature.uniquename,
                  comments: [commentDialogInfo.selectedComment],
                },
              ],
            }
            await fetch(`${model.apolloUrl}/annotationEditor/deleteComments`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(data),
            })
          }}
        >
          Delete
        </Button>
        {commentDialogInfo.open && (
          <CommentModal
            handleClose={handleClose}
            model={model}
            clickedFeature={clickedFeature}
            loadData={commentDialogInfo.selectedComment}
          />
        )}
      </div>
    </>
  )
}

export default observer(CommentEditingTabDetail)
