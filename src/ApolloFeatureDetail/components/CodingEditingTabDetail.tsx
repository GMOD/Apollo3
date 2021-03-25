import { makeStyles } from '@material-ui/core'
import { observer } from 'mobx-react'
import React, { useEffect, useState } from 'react'
import { AplInputProps, ApolloFeature } from '../ApolloFeatureDetail'
import ArrowDropUpIcon from '@material-ui/icons/ArrowDropUp'
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown'

const useStyles = makeStyles(() => ({
  dataRow: {
    '&:hover': {
      backgroundColor: 'lightblue',
    },
  },
}))

const CodingEditingTabDetail = ({
  clickedFeature,
  props,
}: {
  clickedFeature: ApolloFeature
  props: AplInputProps
}) => {
  const { model } = props
  const [sortedBy, setSortedBy] = useState({ key: '', ascending: false })
  const classes = useStyles()
  const tableKeys = ['type', 'start', 'length']

  // TODO: the ascending/descending of the sortedby is not unique to each column, ask if thats important
  return (
    <div>
      <table>
        <thead>
          <tr>
            {tableKeys.map(key => {
              return (
                <th
                  key={key}
                  onClick={() =>
                    setSortedBy({ key, ascending: !sortedBy.ascending })
                  }
                >
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                  {sortedBy.key === key ? (
                    sortedBy.ascending ? (
                      <ArrowDropUpIcon />
                    ) : (
                      <ArrowDropDownIcon />
                    )
                  ) : null}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {clickedFeature.children
            .slice()
            .sort((a: any, b: any) => {
              let value = 0
              if (sortedBy.key === 'type') {
                value = a.type.name < b.type.name ? -1 : 1
              }
              if (sortedBy.key === 'start') {
                value = a.location.fmin < b.location.fmin ? -1 : 1
              }
              if (sortedBy.key === 'length') {
                value =
                  a.location.fmax - a.location.fmin <
                  b.location.fmax - b.location.fmin
                    ? 1
                    : -1
              }
              if (sortedBy.key && !sortedBy.ascending) {
                value *= -1
              }
              return value
            })
            .map((child: ApolloFeature) => {
              const { name, type, location } = child
              // increases the fmin by 1 for display since coordinates are handled as zero-based on server-side
              const fmin = location.fmin + 1
              return (
                <tr
                  key={name}
                  className={classes.dataRow}
                  onClick={() => {
                    // TODO: figure out what the editor is that opens and make the onclick return that
                  }}
                >
                  <td>{type.name}</td>
                  <td>{fmin}</td>
                  <td>{location.fmax - location.fmin}</td>
                </tr>
              )
            })}
        </tbody>
      </table>
    </div>
  )
}

export default observer(CodingEditingTabDetail)
