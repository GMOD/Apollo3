import {
  SessionWithWidgets,
  getSession,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { types } from 'mobx-state-tree'

interface JobsEntry {
  name: string
  cancelCallback?: () => void
  progressPct?: number
  statusMessage?: string
}
interface JobsListModel {
  id: number
  type: 'JobsListWidget'
  jobs: JobsEntry[]
  finished: JobsEntry[]
  queued: JobsEntry[]
  aborted: JobsEntry[]
  addJob(job: JobsEntry): void
  removeJob(jobName: string): void
  addFinishedJob(job: JobsEntry): void
  addQueuedJob(job: JobsEntry): void
  addAbortedJob(job: JobsEntry): void
  removeQueuedJob(jobName: string): void
  updateJobStatusMessage(jobName: string, message?: string): void
  updateJobProgressPct(jobName: string, pct: number): void
}

export const ApolloJobModel = types
  .model('JobsManager', {})
  .views((self) => ({
    get jobStatusWidget() {
      const { widgets } = getSession(self) as SessionWithWidgets
      let jobStatusWidget = widgets.get('JobsList')
      if (!jobStatusWidget) {
        // @ts-expect-error: addWidget function not detected on the session
        jobStatusWidget = getSession(self).addWidget(
          'JobsListWidget',
          'JobsList',
        )
      }
      return jobStatusWidget as unknown as JobsListModel
    },
  }))
  .actions((self) => ({
    /**
     * updates the status message and the progress percent of the provided job
     * @param jobName - the name of the job to be updated
     * @param statusMessage - the message to be communicated to the user
     * @param progressPct - the percent through the run the job is
     */
    update(jobName: string, statusMessage: string, progressPct?: number) {
      self.jobStatusWidget.updateJobStatusMessage(jobName, statusMessage)
      if (progressPct) {
        self.jobStatusWidget.updateJobProgressPct(jobName, progressPct)
      }
    },
    /**
     * aborts the provided job with a message to the user
     * @param jobName - the name of the job to be aborted
     * @param msg - a message to communicate to the user about the abort operation
     */
    abortJob(jobName: string, msg?: string) {
      const session = getSession(self)
      if (isSessionModelWithWidgets(session)) {
        session.showWidget(self.jobStatusWidget)
        self.jobStatusWidget.updateJobStatusMessage(
          jobName,
          msg ?? 'Aborted unexpectedly',
        )
        // this is done to avoid issues with reusing nodes from other state trees
        const indx = self.jobStatusWidget.jobs.findIndex(
          (job) => job.name === jobName,
        )
        const job = self.jobStatusWidget.jobs[indx]
        // object needs to be shallow copied before it is removed from the state tree
        self.jobStatusWidget.addAbortedJob({ ...job })
        // removes the job from the state tree, this node is inaccessible thereafter
        self.jobStatusWidget.removeJob(jobName) as unknown as JobsEntry
        session.notify('Job aborted', 'info')
      }
    },
    /**
     * opens the job status widget and adds the job to the running jobs
     * @param job - the job to be run within the JobsManager
     */
    runJob(job: JobsEntry) {
      const session = getSession(self)
      if (isSessionModelWithWidgets(session)) {
        session.showWidget(self.jobStatusWidget)
        self.jobStatusWidget.addJob(job)
      }
    },
    /**
     * sets the progress and status message of the provided job
     * adds the finished jobs to the list of finished jobs
     * clears the jobs manager of the now done job
     * begins to run the next job if one is queued
     * @param job - the job to be completed
     */
    done(job: JobsEntry) {
      const session = getSession(self)
      if (isSessionModelWithWidgets(session)) {
        session.showWidget(self.jobStatusWidget)
        // this.setProgressPct(100)
        self.jobStatusWidget.removeJob(job.name)
        self.jobStatusWidget.addFinishedJob({
          name: job.name,
          statusMessage: 'All operations successful',
          progressPct: 100,
          cancelCallback: job.cancelCallback,
        })
      }
    },
  }))

export { types as JobsManager } from 'mobx-state-tree'
