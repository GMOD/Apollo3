import { type CheckResultIdsType } from '@apollo-annotation/mst'

export interface CheckResultCluster<T> {
  _id: string
  message: string
  start: number
  count: number
  members: T[]
  range: { min: number; max: number }
  featureIds: CheckResultIdsType
}

export function clusterResultByMessage<
  T extends {
    _id: string
    start: number
    end: number
    message: string
    ids: CheckResultIdsType
  },
>(
  items: readonly T[],
  width: number,
  touchesAsOverlap: boolean,
): CheckResultCluster<T>[] {
  const byMsg = new Map<string, T[]>()
  for (const it of items) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    ;(byMsg.get(it.message) ?? byMsg.set(it.message, []).get(it.message)!).push(
      it,
    )
  }

  const clusters: CheckResultCluster<T>[] = []
  const overlaps = (aEnd: number, bStart: number) =>
    touchesAsOverlap ? bStart <= aEnd : bStart < aEnd

  for (const [message, arr] of byMsg.entries()) {
    if (arr.length === 0) {
      continue
    }

    arr.sort((a, b) => a.start - b.start)

    let group: T[] = [arr[0]]
    let curMin = arr[0].start
    let curMax = arr[0].start + width

    const pushResult = () => {
      const starts = group.map((d) => d.start).sort((a, b) => a - b)
      const mid = Math.floor(starts.length / 2)
      const median: number =
        starts.length % 2 ? starts[mid] : (starts[mid - 1] + starts[mid]) / 2
      const clusterId = group[0]._id
      const featureIds = group[0].ids

      clusters.push({
        _id: clusterId,
        message,
        start: median,
        count: group.length,
        members: [...group],
        range: { min: curMin, max: curMax },
        featureIds,
      })
    }

    for (let i = 1; i < arr.length; i++) {
      const it = arr[i]
      const itStart = it.start
      const itEnd = itStart + width

      if (overlaps(curMax, itStart)) {
        group.push(it)
        if (itStart < curMin) {
          curMin = itStart
        }
        if (itEnd > curMax) {
          curMax = itEnd
        }
      } else {
        pushResult()
        group = [it]
        curMin = itStart
        curMax = itEnd
      }
    }
    pushResult()
  }

  clusters.sort(
    (a, b) => a.message.localeCompare(b.message) || a.start - b.start,
  )
  return clusters
}
