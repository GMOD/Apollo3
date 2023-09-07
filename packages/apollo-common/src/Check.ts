import { Feature } from "apollo-schemas";

export interface RunRegion {
  assemblyId: string
  refId: string
  start: number
  end: number
}

export abstract class Check {
    db: DataProvider
    constructor(db: DataProvider) {
        this.db = db
    }
    abstract run(region: RunRegion, db: DataProvider): AsyncGenerator<Problem>;
    abstract reCheck(problem: Problem): Promise<Problem | undefined>;
}

export abstract class Problem {
    abstract get id(): string;
    assemblyId: string

    severity: number
    message: string
}

export interface DataProvider {
    getFeatures(assemblyId: string, refId: string, start?: number, end?: number): AsyncGenerator<Feature>;
    getSequence(assemblyId: string, refId: string, start: number, end: number): Promise<string>;
}






export class CheckMissingStartAndStopCodonsInTranscripts extends Check {
    async* run(region: RunRegion): AsyncGenerator<Problem> {
        // fetch the features in the region
        for await (const feature of this.db.getFeatures(region.assemblyId, region.refId, region.start, region.end)) {
            // check each of them
            yield* this.check(region, feature)
        }
    }

    private async* check(region: RunRegion, feature: Feature) {
        for await (const transcript of this.findTranscripts(feature)) {
            yield* this.checkTranscript(transcript)
        }
    }

    private async* checkTranscript(region: RunRegion, transcript: Feature) {
        const sequence = this.db.getSequence(region.assemblyId, transcript.refSeq, transcript.start, transcript.end)

    }

    /** traverse a feature hierarchy to find features that match the given predicate */
    private *findFeatures(topLevel: Feature, predicate: (f:Feature) => boolean): Generator<Feature> {
        if(predicate(topLevel)) {
            yield topLevel
        }
        for(const child of topLevel.children?.values() ?? []) {
            yield* this.findFeatures(child, predicate)
        }
    }

    private async* findTranscripts(feature: Feature): AsyncGenerator<Feature> {
        // go through the feature and its subfeatures to find the transcript features
        // check the subparts of the transcript features
        const transcriptTerms = await this.getTranscriptTermNames()
        yield* this.findFeatures(feature, f => transcriptTerms.has(f.type))
    }

    async getTranscriptTermNames() {
        // TODO: intelligently query the configured feature type ontology
        // for a list of transcript terms, their prefixed IDs, and synonyms, instead of hardcoding
        return new Set(`
mRNA SO:0000234
capped_mRNA SO:0000862
polyadenylated_mRNA SO:0000871
exemplar_mRNA SO:0000734
recoded_mRNA SO:1001261
NSD_transcript SO:0002130
circular_mRNA SO:0002292
monocistronic_mRNA SO:0000633
polycistronic_mRNA SO:0000634
trans_spliced_mRNA SO:0000872
mRNA_with_frameshift SO:0000108
consensus_mRNA SO:0000995
edited_mRNA SO:0000929
`.trim().split(/\s+/)
        )
    }
}
