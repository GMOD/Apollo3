interface SequencesResponse {
  sequences: {
    id: number
    name: string
    length: number
    start: number
    end: number
  }[]
}

interface Organism {
  commonName: string
  id: number
}

interface ApolloError {
  error: string
}
