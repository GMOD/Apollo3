import gff3 from '@gmod/gff'
import { Button, makeStyles } from '@material-ui/core'
import { observer } from 'mobx-react'
import { getEnv } from 'mobx-state-tree'
import React from 'react'

import { ApolloViewModel } from '../stateModel'
import gff3File from './volvoxGff3'

const useStyles = makeStyles((theme) => ({
  setup: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    margin: theme.spacing(4),
  },
}))

export const ApolloView = observer(({ model }: { model: ApolloViewModel }) => {
  const classes = useStyles()
  const { pluginManager } = getEnv(model)
  const { linearGenomeView, gff3Data, setGFF3Data } = model
  const { ReactComponent } = pluginManager.getViewType(linearGenomeView.type)

  if (!gff3Data) {
    return (
      <div className={classes.setup}>
        <Button
          className={classes.button}
          color="primary"
          variant="contained"
          onClick={() => {
            const gff3Contents = gff3.parseStringSync(gff3File, {
              parseAll: true,
            })
            setGFF3Data(gff3Contents)
          }}
        >
          Load Volvox GFF3
        </Button>
      </div>
    )
  }

  return <ReactComponent key={linearGenomeView.id} model={linearGenomeView} />
})
