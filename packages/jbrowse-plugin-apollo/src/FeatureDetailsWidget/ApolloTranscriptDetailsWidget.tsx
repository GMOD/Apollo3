import { AbstractSessionModel, getSession, revcom } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import { IAnyStateTreeNode, getRoot } from 'mobx-state-tree'
import React, { useMemo } from 'react'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { ApolloSessionModel } from '../session'
import { ApolloRootModel } from '../types'
import { Attributes } from './Attributes'
import { TranscriptBasicInformation } from './TranscriptBasic'
import TranscriptSequence from './TranscriptSequence'

export interface CDSInfo {
  id: string
  type: string
  strand: number
  start: string
  oldStart: string
  end: string
  oldEnd: string
  startSeq: string
  endSeq: string
}
export interface ExonInfo {
  start: string
  end: string
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getCDSInfo = (feature: any, refData: any): CDSInfo[] => {
  const CDSresult: CDSInfo[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const traverse = (currentFeature: any, isParentMRNA: boolean) => {
    if (
      isParentMRNA &&
      (currentFeature.type === 'CDS' ||
        currentFeature.type === 'three_prime_UTR' ||
        currentFeature.type === 'five_prime_UTR')
    ) {
      let startSeq = refData.getSequence(
        Number(currentFeature.start) - 2,
        Number(currentFeature.start),
      )
      let endSeq = refData.getSequence(
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

function findExonInRange(
  exons: ExonInfo[],
  pairStart: number,
  pairEnd: number,
): ExonInfo | null {
  for (const exon of exons) {
    if (Number(exon.start) <= pairStart && Number(exon.end) >= pairEnd) {
      return exon
    }
  }
  return null
}

function removeMatchingExon(
  exons: ExonInfo[],
  matchStart: string,
  matchEnd: string,
): ExonInfo[] {
  // Filter the array to remove elements matching the specified start and end
  return exons.filter(
    (exon) => !(exon.start === matchStart && exon.end === matchEnd),
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getCDSInfo2 = (feature: any, refData: any): CDSInfo[] => {
  const CDSresult: CDSInfo[] = []
  let exonsArray: ExonInfo[] = []
  let maxCDSend = 0
  console.log(`WHOLE FEATUTE= ${JSON.stringify(feature)}`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const traverse = (currentFeature: any, isParentMRNA: boolean) => {
    console.log(
      `Feature type=${currentFeature.type}, Feature range: ${currentFeature.start} - ${currentFeature.end}, isParentMRNA=${isParentMRNA}, Parent range: ${feature.start} - ${feature.end}`,
    )
    if (currentFeature.type === 'exon') {
      console.log(`EXON DATA = ${currentFeature.start} - ${currentFeature.end}`)
      exonsArray.push({ start: currentFeature.start, end: currentFeature.end })
    }
    if (currentFeature.type === 'CDS') {
      // // Calculate 5' UTR for the first
      // if (Number(feature.start) < Number(currentFeature.start)) {
      //   if (feature.strand === 1) {
      //     console.log(
      //       `TYPE = 5 UTR, start=${feature.start}, end=${
      //         Number(currentFeature.start) - 1
      //       }`,
      //     )
      //     const oneCDS: CDSInfo = {
      //       id: currentFeature._id,
      //       type: 'five_prime_UTR',
      //       strand: Number(currentFeature.strand),
      //       start: feature.start + 1,
      //       end: currentFeature.start + 1,
      //       oldStart: feature.start + 1,
      //       oldEnd: currentFeature.start + 1,
      //       startSeq: '',
      //       endSeq: '',
      //     }
      //     CDSresult.push(oneCDS)
      //   } else {
      //     console.log(
      //       `TYPE = 3 UTR, start=${feature.start}, end=${
      //         Number(currentFeature.start) - 1
      //       }`,
      //     )
      //     const oneCDS: CDSInfo = {
      //       id: currentFeature._id,
      //       type: 'three_prime_UTR',
      //       strand: Number(currentFeature.strand),
      //       start: feature.start + 1,
      //       end: currentFeature.start + 1,
      //       oldStart: feature.start + 1,
      //       oldEnd: currentFeature.start + 1,
      //       startSeq: '',
      //       endSeq: '',
      //     }
      //   }
      // }

      if (currentFeature.discontinuousLocations.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, unicorn/no-array-for-each
        currentFeature.discontinuousLocations.forEach((element: any) => {
          console.log(`CDS range ${element.start} - ${element.end}`)
          let startSeq = refData.getSequence(
            Number(element.start) - 2,
            Number(element.start),
          )
          let endSeq = refData.getSequence(
            Number(element.end),
            Number(element.end) + 2,
          )

          if (element.strand === -1 && startSeq && endSeq) {
            startSeq = revcom(startSeq)
            endSeq = revcom(endSeq)
          }
          const oneCDS: CDSInfo = {
            id: currentFeature._id,
            type: currentFeature.type,
            strand: Number(currentFeature.strand),
            start: element.start + 1,
            end: element.end,
            oldStart: element.start + 1,
            oldEnd: element.end,
            startSeq: startSeq ?? '',
            endSeq: endSeq ?? '',
          }
          if (Number(element.end) > maxCDSend) {
            maxCDSend = Number(element.end)
          }
          // Check if there is already an object with the same start and end
          const exists = CDSresult.some(
            (obj) =>
              obj.start === oneCDS.start &&
              obj.end === oneCDS.end &&
              obj.type === oneCDS.type,
          )

          // If no such object exists, add the new object to the array
          if (!exists) {
            CDSresult.push(oneCDS)
          }

          // Add possible UTRs
          // Check if exon exists for given CDS
          console.log(JSON.stringify(exonsArray))
          const foundExon = findExonInRange(
            exonsArray,
            element.start,
            element.end,
          )
          console.log(
            foundExon
              ? `Found exon range: ${foundExon.start}-${foundExon.end}`
              : 'No range found.',
          )
          if (foundExon && foundExon.start < element.start) {
            if (feature.strand === 1) {
              console.log(
                `* TYPE = 5 UTR, start=${foundExon.start + 1}, end=${Number(
                  element.start,
                )}`,
              )
              const oneCDS: CDSInfo = {
                id: feature._id,
                type: 'five_prime_UTR',
                strand: Number(feature.strand),
                start: foundExon.start + 1,
                end: element.start,
                oldStart: foundExon.start + 1,
                oldEnd: element.start,
                startSeq: '',
                endSeq: '',
              }
              CDSresult.push(oneCDS)
            } else {
              console.log(
                `TYPE = 3 UTR, start=${feature.start}, end=${
                  Number(element.end) - 1
                }`,
              )
              const oneCDS: CDSInfo = {
                id: feature._id,
                type: 'three_prime_UTR',
                strand: Number(feature.strand),
                start: feature.start + 1,
                end: element.start + 1,
                oldStart: feature.start + 1,
                oldEnd: element.start + 1,
                startSeq: '',
                endSeq: '',
              }
            }
            exonsArray = removeMatchingExon(
              exonsArray,
              foundExon.start,
              foundExon.end,
            )
          }
          if (foundExon && foundExon.end > element.end) {
            console.log(
              `*** Need to add ending UTR: ${element.end} - ${foundExon.end}`,
            )
            if (feature.strand === 1) {
              console.log(
                `TYPE = 3 UTR, start=${element.end}, end=${
                  Number(foundExon.end) - 1
                }`,
              )
              const oneCDS: CDSInfo = {
                id: feature._id,
                type: 'three_prime_UTR',
                strand: Number(feature.strand),
                start: element.end + 1,
                end: foundExon.end,
                oldStart: element.end + 1,
                oldEnd: foundExon.end,
                startSeq: '',
                endSeq: '',
              }
              CDSresult.push(oneCDS)
            } else {
              console.log(
                `** TYPE = 5 UTR, start=${feature.start}, end=${Number(
                  element.end,
                )}`,
              )
              const oneCDS: CDSInfo = {
                id: feature._id,
                type: 'five_prime_UTR',
                strand: Number(feature.strand),
                start: feature.start + 1,
                end: element.start,
                oldStart: feature.start + 1,
                oldEnd: element.start,
                startSeq: '',
                endSeq: '',
              }
            }
            exonsArray = removeMatchingExon(
              exonsArray,
              foundExon.start,
              foundExon.end,
            )
          }
          if (
            element.start === foundExon?.start &&
            element.end === foundExon?.end
          ) {
            exonsArray = removeMatchingExon(
              exonsArray,
              element.start,
              element.end,
            )
          }
        })
      } else {
        // Process only one CDS
        let startSeq = refData.getSequence(
          Number(currentFeature.start) - 2,
          Number(currentFeature.start),
        )
        let endSeq = refData.getSequence(
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
        if (Number(currentFeature.end) > maxCDSend) {
          maxCDSend = Number(currentFeature.end)
        }
        // Check if there is already an object with the same start and end
        const exists = CDSresult.some(
          (obj) =>
            obj.start === oneCDS.start &&
            obj.end === oneCDS.end &&
            obj.type === oneCDS.type,
        )

        // If no such object exists, add the new object to the array
        if (!exists) {
          CDSresult.push(oneCDS)
        }
      }
      console.log(`MAX CDS END=${maxCDSend}`)
    }
    if (currentFeature.children) {
      for (const child of currentFeature.children) {
        traverse(child[1], feature.type === 'mRNA')
      }
    }
  }
  traverse(feature, feature.type === 'mRNA')

  // Add remaining UTRs if any
  if (exonsArray.length > 0) {
    // eslint-disable-next-line unicorn/no-array-for-each
    exonsArray.forEach((element: ExonInfo) => {
      console.log(`Remaining EXON range ${element.start} - ${element.end}`)
      if (element.start === feature.start) {
        if (feature.strand === 1) {
          console.log(
            `TYPE = 5 UTR, start=${element.start}, end=${Number(element.end)}`,
          )
          const oneCDS: CDSInfo = {
            id: feature._id,
            type: 'five_prime_UTR',
            strand: Number(feature.strand),
            start: feature.start + 1,
            end: element.end,
            oldStart: feature.start + 1,
            oldEnd: element.end,
            startSeq: '',
            endSeq: '',
          }
          CDSresult.push(oneCDS)
        } else {
          console.log(
            `TYPE = 3 UTR, start=${feature.start}, end=${
              Number(element.end) - 1
            }`,
          )
          const oneCDS: CDSInfo = {
            id: feature._id,
            type: 'three_prime_UTR',
            strand: Number(feature.strand),
            start: feature.start + 1,
            end: element.end + 1,
            oldStart: feature.start + 1,
            oldEnd: element.end + 1,
            startSeq: '',
            endSeq: '',
          }
        }
      }
    })
  }

  // // Check if we need to add UTR in the end
  // if (Number(feature.end) > maxCDSend) {
  //   if (feature.strand === 1) {
  //     console.log(
  //       `TYPE = 3 UTR, start=${maxCDSend}, end=${Number(feature.end)}`,
  //     )
  //     const oneCDS: CDSInfo = {
  //       id: feature._id,
  //       type: 'three_prime_UTR',
  //       strand: Number(feature.strand),
  //       start: (maxCDSend + 1).toString(),
  //       end: feature.end,
  //       oldStart: (maxCDSend + 1).toString(),
  //       oldEnd: feature.end,
  //       startSeq: '',
  //       endSeq: '',
  //     }
  //     CDSresult.push(oneCDS)
  //   } else {
  //     console.log(
  //       `TYPE = 5 UTR, start=${maxCDSend}, end=${Number(feature.end)}`,
  //     )
  //     const oneCDS: CDSInfo = {
  //       id: feature._id,
  //       type: 'five_prime_UTR',
  //       strand: Number(feature.strand),
  //       start: (maxCDSend + 1).toString(),
  //       end: feature.end,
  //       oldStart: (maxCDSend + 1).toString(),
  //       oldEnd: feature.end,
  //       startSeq: '',
  //       endSeq: '',
  //     }
  //   }
  //   console.log('*************** LOPPUU TAHAN ***************')
  //   // console.log('*************** SHOULD WE NOW CHECK THAT IF THERE IS EXON BUT NO CDS INSIDE IT ***************')
  // }
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

// // eslint-disable-next-line @typescript-eslint/no-explicit-any
// export const getCDSInfo2 = (feature: any, refData: any): CDSInfo[] => {
//   const CDSresult: CDSInfo[] = []
//   let maxCDSend = 0
//   console.log(`WHOLE FEATUTE= ${JSON.stringify(feature)}`)
//   // eslint-disable-next-line @typescript-eslint/no-explicit-any
//   const traverse = (currentFeature: any, isParentMRNA: boolean) => {
//     console.log(
//       `Feature type=${currentFeature.type}, ${currentFeature.start} - ${currentFeature.end}, isParentMRNA=${isParentMRNA}, ${feature.start} - ${feature.end}`,
//     )
//     if (isParentMRNA && currentFeature.type === 'CDS') {
//       // Calculate 5' UTR for the first
//       if (Number(feature.start) < Number(currentFeature.start)) {
//         if (feature.strand === 1) {
//           console.log(
//             `TYPE = 5 UTR, start=${feature.start}, end=${
//               Number(currentFeature.start) - 1
//             }`,
//           )
//           const oneCDS: CDSInfo = {
//             id: currentFeature._id,
//             type: 'five_prime_UTR',
//             strand: Number(currentFeature.strand),
//             start: feature.start + 1,
//             end: currentFeature.start + 1,
//             oldStart: feature.start + 1,
//             oldEnd: currentFeature.start + 1,
//             startSeq: '',
//             endSeq: '',
//           }
//           CDSresult.push(oneCDS)
//         } else {
//           console.log(
//             `TYPE = 3 UTR, start=${feature.start}, end=${
//               Number(currentFeature.start) - 1
//             }`,
//           )
//           const oneCDS: CDSInfo = {
//             id: currentFeature._id,
//             type: 'three_prime_UTR',
//             strand: Number(currentFeature.strand),
//             start: feature.start + 1,
//             end: currentFeature.start + 1,
//             oldStart: feature.start + 1,
//             oldEnd: currentFeature.start + 1,
//             startSeq: '',
//             endSeq: '',
//           }
//         }
//       }

//       if (currentFeature.discontinuousLocations.length > 0) {
//         // eslint-disable-next-line @typescript-eslint/no-explicit-any, unicorn/no-array-for-each
//         currentFeature.discontinuousLocations.forEach((element: any) => {
//           console.log(`Range ${element.start} - ${element.end}`)
//           let startSeq = refData.getSequence(
//             Number(element.start) - 2,
//             Number(element.start),
//           )
//           let endSeq = refData.getSequence(
//             Number(element.end),
//             Number(element.end) + 2,
//           )

//           if (element.strand === -1 && startSeq && endSeq) {
//             startSeq = revcom(startSeq)
//             endSeq = revcom(endSeq)
//           }
//           const oneCDS: CDSInfo = {
//             id: currentFeature._id,
//             type: currentFeature.type,
//             strand: Number(currentFeature.strand),
//             start: element.start + 1,
//             end: element.end + 1,
//             oldStart: element.start + 1,
//             oldEnd: element.end + 1,
//             startSeq: startSeq ?? '',
//             endSeq: endSeq ?? '',
//           }
//           if (Number(element.end) > maxCDSend) {
//             maxCDSend = Number(element.end)
//           }
//           // Check if there is already an object with the same start and end
//           const exists = CDSresult.some(
//             (obj) =>
//               obj.start === oneCDS.start &&
//               obj.end === oneCDS.end &&
//               obj.type === oneCDS.type,
//           )

//           // If no such object exists, add the new object to the array
//           if (!exists) {
//             CDSresult.push(oneCDS)
//           }
//         })
//       } else {
//         // Process only one CDS
//         let startSeq = refData.getSequence(
//           Number(currentFeature.start) - 2,
//           Number(currentFeature.start),
//         )
//         let endSeq = refData.getSequence(
//           Number(currentFeature.end),
//           Number(currentFeature.end) + 2,
//         )

//         if (currentFeature.strand === -1 && startSeq && endSeq) {
//           startSeq = revcom(startSeq)
//           endSeq = revcom(endSeq)
//         }
//         const oneCDS: CDSInfo = {
//           id: currentFeature._id,
//           type: currentFeature.type,
//           strand: Number(currentFeature.strand),
//           start: currentFeature.start + 1,
//           end: currentFeature.end + 1,
//           oldStart: currentFeature.start + 1,
//           oldEnd: currentFeature.end + 1,
//           startSeq: startSeq ?? '',
//           endSeq: endSeq ?? '',
//         }
//         if (Number(currentFeature.end) > maxCDSend) {
//           maxCDSend = Number(currentFeature.end)
//         }
//         // Check if there is already an object with the same start and end
//         const exists = CDSresult.some(
//           (obj) =>
//             obj.start === oneCDS.start &&
//             obj.end === oneCDS.end &&
//             obj.type === oneCDS.type,
//         )

//         // If no such object exists, add the new object to the array
//         if (!exists) {
//           CDSresult.push(oneCDS)
//         }
//       }
//       console.log(`MAX CDS END=${maxCDSend}`)
//     } else if (currentFeature.type === 'exon') {
//       console.log(`EXON DATA = ${currentFeature.start} - ${currentFeature.end}`)
//       // **** JATKA TASTA: TALLENNA JOKAINEN EXONI RANGE *********** JA SITTEN KUN LISATAAN CDS NIIN TARKASTETAAN ONKO KOKO CDS EXONIN KOKOINEN, JOS EI NIIN
//       // **** LISATAAN JOKO 3'UTR TAI 5'UTR ************************
//       // *** ITSE ASIASSA KOKO HOMMAN VOI TEHDA TALLA TAVALLA: 1. LUETAAN EXONEIDEN ALKU-LOPPU, 2. LUETAAN CDS DISCONTINOUS LOCATIONS JA LISATAAN NIITA
//       // VERTAILEMALLA CDS + MAHDOLLISET UTR *********
//     }
//     if (currentFeature.children) {
//       for (const child of currentFeature.children) {
//         traverse(child[1], feature.type === 'mRNA')
//       }
//     }
//   }
//   traverse(feature, feature.type === 'mRNA')
//   // Check if we need to add UTR in the end
//   if (Number(feature.end) > maxCDSend) {
//     if (feature.strand === 1) {
//       console.log(
//         `TYPE = 3 UTR, start=${maxCDSend}, end=${Number(feature.end)}`,
//       )
//       const oneCDS: CDSInfo = {
//         id: feature._id,
//         type: 'three_prime_UTR',
//         strand: Number(feature.strand),
//         start: (maxCDSend + 1).toString(),
//         end: feature.end,
//         oldStart: (maxCDSend + 1).toString(),
//         oldEnd: feature.end,
//         startSeq: '',
//         endSeq: '',
//       }
//       CDSresult.push(oneCDS)
//     } else {
//       console.log(
//         `TYPE = 5 UTR, start=${maxCDSend}, end=${Number(feature.end)}`,
//       )
//       const oneCDS: CDSInfo = {
//         id: feature._id,
//         type: 'five_prime_UTR',
//         strand: Number(feature.strand),
//         start: (maxCDSend + 1).toString(),
//         end: feature.end,
//         oldStart: (maxCDSend + 1).toString(),
//         oldEnd: feature.end,
//         startSeq: '',
//         endSeq: '',
//       }
//     }
//     console.log('*************** LOPPUU TAHAN ***************')
//     // console.log('*************** SHOULD WE NOW CHECK THAT IF THERE IS EXON BUT NO CDS INSIDE IT ***************')
//   }
//   CDSresult.sort((a, b) => {
//     return Number(a.start) - Number(b.start)
//   })
//   if (CDSresult.length > 0) {
//     CDSresult[0].startSeq = ''

//     // eslint-disable-next-line unicorn/prefer-at
//     CDSresult[CDSresult.length - 1].endSeq = ''

//     // Loop through the array and clear "startSeq" or "endSeq" based on the conditions
//     for (let i = 0; i < CDSresult.length; i++) {
//       if (i > 0 && CDSresult[i].start === CDSresult[i - 1].end) {
//         // Clear "startSeq" if the current item's "start" is equal to the previous item's "end"
//         CDSresult[i].startSeq = ''
//       }
//       if (
//         i < CDSresult.length - 1 &&
//         CDSresult[i].end === CDSresult[i + 1].start
//       ) {
//         // Clear "endSeq" if the next item's "start" is equal to the current item's "end"
//         CDSresult[i].endSeq = ''
//       }
//     }
//   }
//   return CDSresult
// }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const containsUTR = (currentFeature: any): boolean => {
  if (
    currentFeature.type === 'three_prime_UTR' ||
    currentFeature.type === 'five_prime_UTR'
  ) {
    return true
  }
  if (currentFeature.children) {
    for (const child of currentFeature.children) {
      if (containsUTR(child[1])) {
        return true
      }
    }
  }
  return false
}

export const ApolloTranscriptDetailsWidget = observer(
  function ApolloTranscriptDetails(props: { model: IAnyStateTreeNode }) {
    const { model } = props
    const { assembly, feature, refName } = model
    const session = getSession(model) as unknown as AbstractSessionModel
    const apolloSession = getSession(model) as unknown as ApolloSessionModel
    const currentAssembly =
      apolloSession.apolloDataStore.assemblies.get(assembly)
    const { internetAccounts } = getRoot<ApolloRootModel>(session)
    const internetAccount = useMemo(() => {
      return internetAccounts.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ia: any) => ia.type === 'ApolloInternetAccount',
      ) as ApolloInternetAccountModel | undefined
    }, [internetAccounts])
    const role = internetAccount ? internetAccount.getRole() : 'admin'
    const editable = ['admin', 'user'].includes(role ?? '')

    if (!(feature && currentAssembly)) {
      return null
    }
    const refSeq = currentAssembly.getByRefName(refName)
    if (!refSeq) {
      return null
    }
    const { end, start } = feature
    // // console.log(`FEATURE= ${JSON.stringify(feature)}`)
    // // Check if feature contains any UTR. If not derive UTRs
    // if (!containsUTR(feature)) {
    //   console.log('************* GENEROIDAAN UTR ****************')
    // }

    const sequence = refSeq.getSequence(start, end)
    if (!sequence) {
      void apolloSession.apolloDataStore.loadRefSeq([
        { assemblyName: assembly, refName, start, end },
      ])
    }

    return (
      <>
        <TranscriptBasicInformation
          feature={feature}
          session={apolloSession}
          assembly={currentAssembly ? currentAssembly._id : ''}
          refName={refName}
        />
        <hr />
        <Attributes
          feature={feature}
          session={apolloSession}
          assembly={currentAssembly ? currentAssembly._id : ''}
          editable={editable}
        />
        <hr />
        <TranscriptSequence
          feature={feature}
          session={apolloSession}
          assembly={currentAssembly ? currentAssembly._id : ''}
          refName={refName}
        />
      </>
    )
  },
)
export default ApolloTranscriptDetailsWidget
