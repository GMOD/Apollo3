import { revcom } from '@jbrowse/core/util'
import {
  Button,
  MenuItem,
  Select,
  SelectChangeEvent,
  Typography,
} from '@mui/material'
import { AnnotationFeatureI } from 'apollo-mst'
import { splitStringIntoChunks } from 'apollo-shared'
import { observer } from 'mobx-react'
import React, { useState } from 'react'
import { makeStyles } from 'tss-react/mui'

import { ApolloSessionModel } from '../session'
import { CDSInfo } from './ApolloTranscriptDetailsWidget'

interface Props {
  textSegments: { text: string; color: string }[]
}

function formatSequence(
  seq: string,
  refName: string,
  start: number,
  end: number,
  wrap?: number,
) {
  const header = `>${refName}:${start + 1}–${end}\n`
  const body =
    wrap === undefined ? seq : splitStringIntoChunks(seq, wrap).join('\n')
  return `${header}${body}`
}

const useStyles = makeStyles()({
  sequence: {
    width: '100%',
    resize: 'vertical',
  },
})

export const intronColor = 'rgb(120,120,120)' // Slightly brighter gray
export const utrColor = 'rgb(20,200,200)' // Slightly brighter cyan
export const proteinColor = 'rgb(220,70,220)' // Slightly brighter magenta
export const cdsColor = 'rgb(240,200,20)' // Slightly brighter yellow
export const updownstreamColor = 'rgb(255,130,130)' // Slightly brighter red
export const genomeColor = 'rgb(20,230,20)' // Slightly brighter green

const error = false
let textSegments = [{ text: '', color: '' }]

export const TranscriptSequence = observer(function TranscriptSequence({
  assembly,
  feature,
  refName,
  session,
}: {
  assembly: string
  feature: AnnotationFeatureI
  refName: string
  session: ApolloSessionModel
}) {
  const currentAssembly = session.apolloDataStore.assemblies.get(assembly)
  const refData = currentAssembly?.getByRefName(refName)
  const { classes } = useStyles()
  const [errorMessage, setErrorMessage] = useState('')
  const [showSequence, setShowSequence] = useState(false)
  const [selectedOption, setSelectedOption] = useState('Select')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
          traverse(child[1], feature.type === 'mRNA')
        }
      }
    }
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
  const onButtonClick = () => {
    setShowSequence(!showSequence)
  }

  if (!(feature && currentAssembly)) {
    return null
  }
  const refSeq = currentAssembly.getByRefName(refName)
  if (!refSeq) {
    return null
  }
  const { end, start } = feature
  let sequence = ''
  if (showSequence) {
    sequence = refSeq.getSequence(start, end)
    if (sequence) {
      sequence = formatSequence(sequence, refName, start, end)
    } else {
      void session.apolloDataStore.loadRefSeq([
        { assemblyName: assembly, refName, start, end },
      ])
    }
  }

  const handleSeqButtonClick = () => {
    setShowSequence(!showSequence)
  }

  async function handleChangeSeqOption(e: SelectChangeEvent<string>) {
    setErrorMessage('')
    setSelectedOption(e.target.value)
    let seqData = ''
    textSegments = []
    switch (e.target.value) {
      case 'CDS': {
        textSegments.push({ text: '>CDS\n', color: 'black' })
        for (const item of transcriptItems) {
          if (item.type === 'CDS') {
            const refSeq: string | undefined = refData?.getSequence(
              Number(item.start + 1),
              Number(item.end),
            )
            seqData += item.strand === -1 && refSeq ? revcom(refSeq) : refSeq
            textSegments.push({ text: seqData, color: cdsColor })
          }
        }
        break
      }
      case 'cDNA': {
        textSegments.push({ text: '>cDNA\n', color: 'black' })
        for (const item of transcriptItems) {
          if (
            item.type === 'CDS' ||
            item.type === 'three_prime_UTR' ||
            item.type === 'five_prime_UTR'
          ) {
            const refSeq: string | undefined = refData?.getSequence(
              Number(item.start + 1),
              Number(item.end),
            )
            seqData += item.strand === -1 && refSeq ? revcom(refSeq) : refSeq
            if (item.type === 'CDS') {
              textSegments.push({ text: seqData, color: cdsColor })
            } else {
              textSegments.push({ text: seqData, color: utrColor })
            }
          }
        }
        break
      }
      case 'Full': {
        textSegments.push({ text: '>Full genomic\n', color: 'black' })
        let lastEnd = 0
        let count = 0
        for (const item of transcriptItems) {
          count++
          if (
            lastEnd != 0 &&
            lastEnd != Number(item.start) &&
            count != transcriptItems.length
          ) {
            // Intron etc. between CDS/UTRs. No need to check this on very last item
            const refSeq: string | undefined = refData?.getSequence(
              lastEnd + 1,
              Number(item.start) - 1,
            )
            seqData += item.strand === -1 && refSeq ? revcom(refSeq) : refSeq
            textSegments.push({ text: seqData, color: 'black' })
          }
          if (
            item.type === 'CDS' ||
            item.type === 'three_prime_UTR' ||
            item.type === 'five_prime_UTR'
          ) {
            const refSeq: string | undefined = refData?.getSequence(
              Number(item.start + 1),
              Number(item.end),
            )
            seqData += item.strand === -1 && refSeq ? revcom(refSeq) : refSeq
            switch (item.type) {
              case 'CDS': {
                textSegments.push({ text: seqData, color: cdsColor })
                break
              }
              case 'three_prime_UTR': {
                textSegments.push({ text: seqData, color: utrColor })
                break
              }
              case 'five_prime_UTR': {
                textSegments.push({ text: seqData, color: utrColor })
                break
              }
              default: {
                textSegments.push({ text: seqData, color: 'black' })
                break
              }
            }
          }
          lastEnd = Number(item.end)
        }
        break
      }
      default: {
        console.log('DEFAULT selected')
      }
    }
  }

  // Function to copy text to clipboard
  const copyToClipboard = () => {
    const textToCopy = textSegments.map((segment) => segment.text).join('')

    if (textToCopy) {
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          // console.log('Text copied to clipboard!')
        })
        .catch((error_) => {
          console.error('Failed to copy text to clipboard', error_)
        })
    }
  }

  const ColoredText: React.FC<Props> = ({ textSegments }) => {
    return (
      <div>
        {textSegments.map((segment, index) => (
          <span key={index} style={{ color: segment.color }}>
            {/* Adding line breaks after every 120 characters */}
            {/* {segment.text.match(/.{1,120}/g)?.map((line, idx) => (
              <React.Fragment key={idx}>
                {line}
                <br />
              </React.Fragment>
            ))} */}
            {splitStringIntoChunks(segment.text, 150).join('\n')}
          </span>
        ))}
      </div>
    )
  }

  return (
    <>
      <Typography
        style={{ display: 'inline', marginLeft: '15px' }}
        variant="h5"
      >
        Sequence
      </Typography>
      <div>
        <Button
          variant="contained"
          style={{ marginLeft: '15px' }}
          onClick={handleSeqButtonClick}
        >
          {showSequence ? 'Hide sequence' : 'Show sequence'}
        </Button>
      </div>
      <div>
        {showSequence && (
          <Select
            value={selectedOption}
            onChange={handleChangeSeqOption}
            style={{ width: '150px', marginLeft: '15px', height: '25px' }}
          >
            <MenuItem value={'Select'}>Select</MenuItem>
            <MenuItem value={'CDS'}>CDS</MenuItem>
            <MenuItem value={'cDNA'}>cDNA</MenuItem>
            <MenuItem value={'Full'}>Full genomics</MenuItem>
          </Select>
        )}
      </div>
      <div
        style={{
          width: '500px',
          marginLeft: '15px',
          height: '300px',
          overflowY: 'auto',
          border: '1px solid #ccc',
        }}
      >
        {showSequence && <ColoredText textSegments={textSegments} />}
      </div>
      {showSequence && (
        <Button
          variant="contained"
          style={{ marginLeft: '15px' }}
          onClick={copyToClipboard}
        >
          Copy sequence
        </Button>
      )}
    </>
  )
})
export default TranscriptSequence
