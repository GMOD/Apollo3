import {
  types,
  Instance,
} from 'mobx-state-tree'
import { observable } from 'mobx'
import PluginManager from '@jbrowse/core/PluginManager'
import { getSession, isSessionModelWithWidgets } from '@jbrowse/core/util'

interface JobsEntry {
  name: string
  cancelCallback?: () => void
  progressPct?: number
  statusMessage?: string
}

export default function jobsModelFactory(_pluginManager: PluginManager) {
  return types
    .model('JobsManager', {})
    .volatile(() => ({
      running: false,
      statusMessage: '',
      progressPct: 0,
      jobName: '',
      controller: new AbortController(),
      jobsQueue: observable.array([] as JobsEntry[]),
    }))
    .actions(self => ({
      getJobStatusWidget() {
        const { widgets } = getSession(self)
        let jobStatusWidget = widgets.get('JobsList')
        if (!jobStatusWidget) {
          // @ts-ignore
          jobStatusWidget = getSession(self).addWidget('JobsListWidget', 'JobsList')
        }
        return jobStatusWidget
      },
    }))
    .actions(self => ({
      setRunning(running: boolean) {
        self.running = running
      },
      setJobName(name: string) {
        self.jobName = name
      },
      setStatusMessage(arg: string) {
        self.statusMessage = arg
      },
      /**
       * sets the progress percent of the running job, sets the status message to a default success if process is 100
       * @param arg the percent to set the progress to
       */
      setProgressPct(arg: number) {
        const progress = +arg
        if (progress === 100) {
          this.setStatusMessage('All operations successful')
        }
        self.progressPct = progress
        this.setWidgetStatus()
      },
      /**
       * updates the widget with both the status message and process percent of the manager
       */
      setWidgetStatus() {
        const jobStatusWidget = self.getJobStatusWidget()
        jobStatusWidget.updateJobStatusMessage(self.jobName, self.statusMessage)
        jobStatusWidget.updateJobProgressPct(self.jobName, self.progressPct)
      },
      /**
       * aborts the running job with a message to the user
       * @param msg a message to communicate to the user about the abort operation
       */
      abortJob(msg?: string) {
        const session = getSession(self)
        if (isSessionModelWithWidgets(session)) {
          const jobStatusWidget = self.getJobStatusWidget()
          session.showWidget(jobStatusWidget)
          this.setStatusMessage(msg || 'Aborted unexpectedly.')
          jobStatusWidget.removeJob(self.jobName)
          jobStatusWidget.addAbortedJob({
            name: self.jobName,
            statusMessage: self.statusMessage,
            progressPct: self.progressPct,
            cancelCallback: () => this.abortJob(),
          })
          session.notify('Job aborted', 'info')
          self.controller.abort()
          this.clear()
        }
      },
      /**
       * sets the progress and status message of the job
       * adds the finished jobs to the list of finished jobs
       * clears the jobs manager of the now done job
       */
      done() {
        const session = getSession(self)
        if (isSessionModelWithWidgets(session)) {
          const jobStatusWidget = self.getJobStatusWidget()
          session.showWidget(jobStatusWidget)
          this.setProgressPct(100)
          jobStatusWidget.removeJob(self.jobName)
          jobStatusWidget.addFinishedJob({
            name: self.jobName,
            statusMessage: self.statusMessage || 'done',
            progressPct: self.progressPct || 100,
            cancelCallback: this.abortJob,
          })
          this.clear()
        }
      },
      /**
       * updates the status message and the progress percent of the job
       * @param statusMessage the message to be communicated to the user
       * @param progressPct the percent through the run the job is
       */
      update(statusMessage: string, progressPct?: number) {
        this.setStatusMessage(statusMessage)
        this.setProgressPct(progressPct || 0)
      },
      /**
       * opens the job status widget and adds the job to the running jobs
       * @param job the job to be run within the JobsManager
       */
      runJob(job: JobsEntry) {
        const session = getSession(self)
        if (isSessionModelWithWidgets(session)) {
          const jobStatusWidget = self.getJobStatusWidget()
          session.showWidget(jobStatusWidget)
          const { name, statusMessage = '', progressPct = 0, cancelCallback } =
            job
          jobStatusWidget.addJob({
            name,
            statusMessage: statusMessage || '',
            progressPct: progressPct || 0,
            cancelCallback,
          })
          this.setRunning(true)
          this.setJobName(name)
          this.setProgressPct(progressPct)
          this.setStatusMessage(statusMessage)
        }
      },
      /**
       * resets the manager
       */
      clear() {
        this.setRunning(false)
        this.setStatusMessage('')
        this.setJobName('')
        self.progressPct = 0
        self.controller = new AbortController()
      },
    }))
}

export type JobsStateModel = Instance<ReturnType<typeof jobsModelFactory>>
