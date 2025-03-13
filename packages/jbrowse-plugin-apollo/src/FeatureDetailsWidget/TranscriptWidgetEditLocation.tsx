import React from 'react'

import { observer } from 'mobx-react'

import styled from '@emotion/styled'
import {
  Accordion,
  AccordionDetails,
  Grid2,
  TextField,
  Typography,
} from '@mui/material'

import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ContentCutIcon from '@mui/icons-material/ContentCut'

import { AnnotationFeature } from '@apollo-annotation/mst'

import { StyledAccordionSummary } from './ApolloTranscriptDetailsWidget'

const StyledTextField = styled(TextField)(({ theme }) => ({
  '&.MuiFormControl-root': {
    marginTop: 0,
    marginBottom: 0,
  },
  '& .MuiInputBase-input': {
    fontSize: 12,
    height: 20,
    padding: 1,
    paddingLeft: 10,
  },
}))

const SequenceContainer = styled('div')({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  textAlign: 'left',
  width: '100%',
  overflowWrap: 'break-word',
  wordWrap: 'break-word',
  wordBreak: 'break-all',
  '& span': {
    fontSize: 12,
  },
})

const Strand = (props: { strand: 1 | -1 | undefined }) => {
  const { strand } = props
  return (
    <div>
      {strand === 1 ? (
        <AddIcon />
      ) : strand === -1 ? (
        <RemoveIcon />
      ) : (
        <Typography component={'span'}>N/A</Typography>
      )}
    </div>
  )
}

export const TranscriptWidgetEditLocation = observer(
  function TranscriptWidgetEditLocation(props: {
    feature: AnnotationFeature
    refName: string
  }) {
    const { feature, refName } = props
    const { cdsLocations, transcriptExonParts } = feature
    const [firstCDSLocation] = cdsLocations

    const exonParts = transcriptExonParts.filter((part) => part.type === 'exon')
    const cdsMin =
      firstCDSLocation
        ?.map((loc) => loc.min)
        .reduce((acc, cur) => Math.min(acc, cur), Number.MAX_SAFE_INTEGER) + 1
    const cdsMax = firstCDSLocation
      ?.map((loc) => loc.max)
      .reduce((acc, cur) => Math.max(acc, cur), Number.MIN_SAFE_INTEGER)

    return (
      <div>
        {firstCDSLocation && firstCDSLocation.length > 0 && (
          <div>
            <Accordion defaultExpanded>
              <StyledAccordionSummary
                expandIcon={<ExpandMoreIcon style={{ color: 'white' }} />}
                aria-controls="panel1-content"
                id="panel1-header"
              >
                <Typography component="span" fontWeight={'bold'}>
                  Translation{' '}
                </Typography>
              </StyledAccordionSummary>
              <AccordionDetails>
                <SequenceContainer>
                  <Typography component={'span'}>
                    {
                      '>21:25729794-25729631;25725350-25725226;25717759-25717689(-)MILQRLFRFSSVIRSAVSVHLRRNIGVTAVAFNKELDPIQKLFVDKIREYKSKRQTSGGPVDASSEYQQELERELFKLKQMFGNADMNTFPTFKFEEHFSQHLRSWQPSRDDDILILSS*'
                    }
                  </Typography>
                </SequenceContainer>
                <div style={{ marginTop: 10 }}>
                  <ContentCopyIcon
                    style={{ fontSize: 15 }}
                    onClick={() => {}}
                  />
                  <ContentCutIcon
                    style={{ fontSize: 15, marginLeft: 10 }}
                    onClick={() => {}}
                  />
                </div>
              </AccordionDetails>
            </Accordion>
            <Grid2
              container
              justifyContent="center"
              alignItems="center"
              style={{ textAlign: 'center', marginTop: 10 }}
            >
              <Grid2 size={1} />
              <Grid2 size={4}>
                <StyledTextField
                  type="number"
                  variant="outlined"
                  value={cdsMin}
                />
              </Grid2>
              <Grid2 size={2}>
                <Typography component={'span'}>CDS</Typography>
              </Grid2>
              <Grid2 size={4}>
                <StyledTextField
                  type="number"
                  variant="outlined"
                  value={cdsMax}
                />
              </Grid2>
              <Grid2 size={1} />
            </Grid2>
          </div>
        )}
        <div style={{ marginTop: 5 }}>
          {exonParts &&
            exonParts.length > 0 &&
            exonParts.map((loc, index) => {
              return (
                <Grid2
                  container
                  key={index}
                  justifyContent="center"
                  alignItems="center"
                  style={{ textAlign: 'center' }}
                >
                  <Grid2 size={1}>
                    {index !== 0 && (
                      <Typography component={'span'} color="green">
                        ag
                      </Typography>
                    )}
                  </Grid2>
                  <Grid2 size={4} style={{ padding: 0 }}>
                    <StyledTextField
                      type="number"
                      variant="outlined"
                      value={loc.min + 1}
                    />
                  </Grid2>
                  <Grid2 size={2}>
                    <Strand strand={feature.strand} />
                  </Grid2>
                  <Grid2 size={4} style={{ padding: 0 }}>
                    <StyledTextField
                      type="number"
                      variant="outlined"
                      value={loc.max}
                    />
                  </Grid2>
                  <Grid2 size={1}>
                    {index !== exonParts.length - 1 && (
                      <Typography component={'span'} color="green">
                        gt
                      </Typography>
                    )}
                  </Grid2>
                </Grid2>
              )
            })}
        </div>
      </div>
    )
  },
)
