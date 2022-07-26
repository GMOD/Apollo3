import PluginManager from '@jbrowse/core/PluginManager'
import { alpha } from '@mui/material/styles'
import React from 'react'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()((theme) => ({
  root: {
    background: alpha(theme.palette.primary.main, 0.2),
    height: '100%',
  },
}))

export function makeDisplayComponent(pluginManager: PluginManager) {
  const LGVPlugin = pluginManager.getPlugin('LinearGenomeViewPlugin') as
    | import('@jbrowse/plugin-linear-genome-view').default
    | undefined
  if (!LGVPlugin) {
    throw new Error('LinearGenomeView plugin not found')
  }
  const { BaseLinearDisplayComponent } = LGVPlugin.exports
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function ApolloDisplayComponent(props: any) {
    const { classes } = useStyles()
    return (
      <div className={classes.root}>
        <BaseLinearDisplayComponent {...props} />
      </div>
    )
  }
  return ApolloDisplayComponent
}
