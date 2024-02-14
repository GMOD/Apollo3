import { AbstractSessionModel, revcom } from '@jbrowse/core/util'
import {
  Button,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
} from '@mui/material'
import { AnnotationFeatureI } from 'apollo-mst'
import {
  LocationEndChange,
  LocationStartChange,
  StrandChange,
  TypeChange,
} from 'apollo-shared'
import { observer } from 'mobx-react'
import React, { useState } from 'react'

import { OntologyTermAutocomplete } from '../components/OntologyTermAutocomplete'
import { isOntologyClass } from '../OntologyManager'
import OntologyStore from '../OntologyManager/OntologyStore'
import { fetchValidDescendantTerms } from '../OntologyManager/util'
import { ApolloSessionModel } from '../session'
import { CDSInfo } from './ApolloTranscriptDetailsWidget'
import { NumberTextField } from './NumberTextField'

export const TranscriptBasicInformation = observer(
  function TranscriptBasicInformation({
    assembly,
    feature,
    refName,
    session,
  }: {
    feature: AnnotationFeatureI
    session: ApolloSessionModel
    assembly: string
    refName: string
  }) {
    const currentAssembly = session.apolloDataStore.assemblies.get(assembly)
    const refData = currentAssembly?.getByRefName(refName)
    const [errorMessage, setErrorMessage] = useState('')
    const [typeWarningText, setTypeWarningText] = useState('')
    const { notify } = session as unknown as AbstractSessionModel
    const { _id, assemblyId, end, start, strand, type } = feature

    const notifyError = (e: Error) =>
      (session as unknown as AbstractSessionModel).notify(e.message, 'error')

    const { changeManager } = session.apolloDataStore
    function handleTypeChange(newType: string) {
      setErrorMessage('')
      const featureId = _id
      const change = new TypeChange({
        typeName: 'TypeChange',
        changedIds: [featureId],
        featureId,
        oldType: type,
        newType,
        assembly: assemblyId,
      })
      return changeManager.submit(change)
    }

    function handleStartChange(newStart: number) {
      newStart--
      const change = new LocationStartChange({
        typeName: 'LocationStartChange',
        changedIds: [_id],
        featureId: _id,
        oldStart: start,
        newStart,
        assembly,
      })
      return changeManager.submit(change)
    }

    function handleEndChange(newEnd: number) {
      const change = new LocationEndChange({
        typeName: 'LocationEndChange',
        changedIds: [_id],
        featureId: _id,
        oldEnd: end,
        newEnd,
        assembly,
      })
      return changeManager.submit(change)
    }

    const handleInputChange = (
      index: number,
      position: 'start' | 'end',
      value: string,
      id: string,
    ) => {
      // Create a new array with the updated values
      const newArray = transcriptItems.map((item, i) => {
        if (i === index) {
          return position === 'start'
            ? {
                id: item.id,
                type: item.type,
                strand: item.strand,
                start: value,
                oldStart: item.oldStart,
                end: item.end,
                oldEnd: item.oldEnd,
                startSeq: item.startSeq,
                endSeq: item.endSeq,
              }
            : {
                id: item.id,
                type: item.type,
                strand: item.strand,
                start: item.start,
                oldStart: item.oldStart,
                end: value,
                oldEnd: item.oldEnd,
                startSeq: item.startSeq,
                endSeq: item.endSeq,
              }
        }
        return item
      })
      setTranscriptItems(newArray)
    }

    // // eslint-disable-next-line unicorn/consistent-function-scoping
    // const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    //   const { id, value } = event.target
    //   console.log('Value changed:', value)
    //   console.log('ID:', id)
    // }

    // eslint-disable-next-line unicorn/consistent-function-scoping, @typescript-eslint/no-explicit-any
    const getCDSInfo = (feature: any): CDSInfo[] => {
      const CDSresult: CDSInfo[] = []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const traverse = (currentFeature: any, isParentMRNA: boolean) => {
        if (
          isParentMRNA &&
          (currentFeature.type === 'CDS' ||
            currentFeature.type === 'three_prime_UTR' ||
            currentFeature.type === 'five_prime_UTR')
        ) {
          let startSeq = refData?.getSequence(
            Number(currentFeature.start) - 2,
            Number(currentFeature.start),
          )
          let endSeq = refData?.getSequence(
            Number(currentFeature.end),
            Number(currentFeature.end) + 2,
          )

          if (currentFeature.strand === -1 && startSeq && endSeq) {
            startSeq = revcom(startSeq)
            endSeq = revcom(endSeq)
          }
          const oneCDS: CDSInfo = {
            id: currentFeature._id,
            type: currentFeature.type,
            strand: Number(currentFeature.strand),
            start: currentFeature.start + 1,
            end: currentFeature.end + 1,
            oldStart: currentFeature.start + 1,
            oldEnd: currentFeature.end + 1,
            startSeq: startSeq ?? '',
            endSeq: endSeq ?? '',
          }
          CDSresult.push(oneCDS)
        }
        if (currentFeature.children) {
          for (const child of currentFeature.children) {
            // eslint-disable-next-line unicorn/consistent-destructuring
            traverse(child[1], feature.type === 'mRNA')
          }
        }
      }
      // eslint-disable-next-line unicorn/consistent-destructuring
      traverse(feature, feature.type === 'mRNA')
      CDSresult.sort((a, b) => {
        return Number(a.start) - Number(b.start)
      })
      if (CDSresult.length > 0) {
        CDSresult[0].startSeq = ''

        // eslint-disable-next-line unicorn/prefer-at
        CDSresult[CDSresult.length - 1].endSeq = ''

        // Loop through the array and clear "startSeq" or "endSeq" based on the conditions
        for (let i = 0; i < CDSresult.length; i++) {
          if (i > 0 && CDSresult[i].start === CDSresult[i - 1].end) {
            // Clear "startSeq" if the current item's "start" is equal to the previous item's "end"
            CDSresult[i].startSeq = ''
          }
          if (
            i < CDSresult.length - 1 &&
            CDSresult[i].end === CDSresult[i + 1].start
          ) {
            // Clear "endSeq" if the next item's "start" is equal to the current item's "end"
            CDSresult[i].endSeq = ''
          }
        }
      }
      return CDSresult
    }
    const [transcriptItems, setTranscriptItems] = useState<CDSInfo[]>(
      getCDSInfo(feature),
    )

    async function onSubmitBasic(event: React.FormEvent<HTMLFormElement>) {
      event.preventDefault()
      setErrorMessage('')
      let changed = false
      let changedPosition = false

      for (const item of transcriptItems) {
        if (item.start !== item.oldStart) {
          const change = new LocationStartChange({
            typeName: 'LocationStartChange',
            changedIds: [item.id],
            featureId: item.id,
            oldStart: Number(item.oldStart) - 1,
            newStart: Number(item.start) - 1,
            assembly,
          })
          await changeManager.submit?.(change)
          changed = true
          changedPosition = true
        }

        if (item.end !== item.oldEnd) {
          const change = new LocationEndChange({
            typeName: 'LocationEndChange',
            changedIds: [item.id],
            featureId: item.id,
            oldEnd: Number(item.oldEnd) - 1,
            newEnd: Number(item.end) - 1,
            assembly,
          })
          await changeManager.submit?.(change)
          changed = true
          changedPosition = true
        }
      }

      if (changedPosition) {
        setTranscriptItems(getCDSInfo(feature))
        // const refSeq: string | undefined = refData?.getSequence(
        //   Number(feature.start + 1),
        //   Number(feature.end),
        // )
        // TODO: Update sequence data!!!
      }
      changed ? notify('Feature data saved successfully', 'success') : null
      event.preventDefault()
    }

    return (
      <>
        <form onSubmit={onSubmitBasic}>
          <Typography
            variant="h5"
            style={{ marginLeft: '15px', marginBottom: '0' }}
          >
            CDS and UTRs
          </Typography>
          <h2 style={{ marginLeft: '15px', marginBottom: '0' }}>
            CDS and UTRs
          </h2>
          <div>
            {transcriptItems.map((item, index) => (
              <div
                key={index}
                style={{ display: 'flex', alignItems: 'center' }}
              >
                <span style={{ marginLeft: '20px', width: '50px' }}>
                  {item.type === 'three_prime_UTR'
                    ? '3 UTR'
                    : item.type === 'five_prime_UTR'
                    ? '5 UTR'
                    : 'CDS'}
                </span>
                <span style={{ fontWeight: 'bold', width: '30px' }}>
                  {item.startSeq}
                </span>
                <TextField
                  margin="dense"
                  id={item.id}
                  type="number"
                  disabled={item.type !== 'CDS'}
                  style={{
                    width: '150px',
                    marginLeft: '8px',
                    backgroundColor:
                      item.startSeq.trim() === '' && index !== 0
                        ? 'lightblue'
                        : 'inherit',
                  }}
                  variant="outlined"
                  value={item.start}
                  onChange={(e) =>
                    handleInputChange(
                      index,
                      'start',
                      e.target.value,
                      e.target.id,
                    )
                  }
                />
                <span style={{ margin: '0 10px' }}>
                  {item.strand === -1 ? '-' : item.strand === 1 ? '+' : ''}
                </span>
                <TextField
                  margin="dense"
                  id={item.id}
                  type="number"
                  disabled={item.type !== 'CDS'}
                  style={{
                    width: '150px',
                    backgroundColor:
                      item.endSeq.trim() === '' &&
                      index + 1 !== transcriptItems.length
                        ? 'lightblue'
                        : 'inherit',
                  }}
                  variant="outlined"
                  value={item.end}
                  //   error={error}
                  //   helperText={
                  //     error ? '"End" must be greater than "Start"' : null
                  //   }
                  onChange={(e) =>
                    handleInputChange(index, 'end', e.target.value, e.target.id)
                  }
                />
                <span style={{ marginLeft: '8px', fontWeight: 'bold' }}>
                  {item.endSeq}
                </span>
              </div>
            ))}
          </div>
          <DialogContent
            style={{
              display: 'flex',
              flexDirection: 'column',
              paddingTop: '0',
            }}
          ></DialogContent>
          <DialogActions>
            <Button variant="contained" type="submit">
              Save
            </Button>
          </DialogActions>
        </form>

        {errorMessage ? (
          <Typography color="error">{errorMessage}</Typography>
        ) : null}
      </>
    )
  },
)
