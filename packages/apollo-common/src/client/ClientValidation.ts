import type { AnnotationFeatureSnapshot } from '../AnnotationFeatureData.js'
import type { Change } from '../Change.js'
import type { ValidationOutcome } from '../ChangeRule.js'

/** What a {@link ClientValidation} can see of the client */
export interface ClientValidationContext {
  /** Look up a feature loaded in the client, as a plain snapshot */
  getFeature(featureId: string): AnnotationFeatureSnapshot | undefined
}

/**
 * Validation of changes in the Apollo JBrowse plugin. Implement either or both
 * methods; return an error message to reject the change.
 *
 * Client validation can be bypassed by submitting changes to the server
 * directly, so anything that must always hold should (also) be a
 * `ChangeRule` or a `ServerValidation`.
 */
export abstract class ClientValidation {
  abstract name: string

  /** Called before the change is applied in the client */
  preValidate?(
    change: Change,
    context: ClientValidationContext,
  ): ValidationOutcome

  /**
   * Called after the change has been applied in the client, but before it is
   * sent to the server. Rejecting the change reverts it in the client.
   */
  postValidate?(
    change: Change,
    context: ClientValidationContext,
  ): ValidationOutcome
}
