import os from 'node:os'
import path from 'node:path'

import type { SetupAnswers } from './answers.js'
import { pluginFileName } from './env.js'
import type { AddedFile } from './jbrowse.js'

const DOCS = 'https://apollo.jbrowse.org/docs/multi-user/installation'

function mask(value: string | undefined): string {
  return value ? '********' : '(none)'
}

/** A table of the answers, with secrets masked, to confirm before running */
export function describeAnswers(answers: SetupAnswers): string {
  const logins = [
    answers.rootUser && 'root user',
    answers.guestUser && `guest user (${answers.guestUser.role})`,
    answers.google && 'Google',
    answers.microsoft && 'Microsoft',
  ].filter(Boolean)
  const rows: [string, string][] = [
    ['Install directory', answers.installDir],
    ['Apollo version', answers.apolloVersion],
    ['JBrowse directory', answers.jbrowseDir],
    ['JBrowse config files', answers.jbrowseConfigFiles.join(', ')],
    ['URL', answers.url],
    ['Port', String(answers.port)],
    ['Name', answers.name],
    ['Description', answers.description || '(none)'],
    [
      'MongoDB',
      answers.mongodb.type === 'existing'
        ? answers.mongodb.uri.replace(/\/\/[^@/]*@/, '//********@')
        : `embedded, data in ${answers.mongodb.dataDir}`,
    ],
    ['Logins', logins.join(', ') || '(none)'],
    ['Root password', mask(answers.rootUser?.password)],
    ['Initial admin email', answers.initialAdminEmail ?? '(none)'],
    ['Default new user role', answers.defaultNewUserRole],
    ['Upload directory', answers.uploadDir],
  ]
  const width = Math.max(...rows.map(([label]) => label.length))
  return rows
    .map(([label, value]) => `  ${label.padEnd(width)}  ${value}`)
    .join('\n')
}

/** The files setup will add to the JBrowse directory, if they're missing */
export function describeJBrowseFiles(answers: SetupAnswers): string {
  return [
    `  ${pluginFileName(answers.apolloVersion)} (the Apollo plugin)`,
    '  sequence_ontology.json (only if there is no ontology file yet)',
  ].join('\n')
}

function serviceSnippets(
  platform: NodeJS.Platform,
  startScript: string,
): string[] {
  const pm2 = [
    'To run it with PM2:',
    `  pm2 start "${startScript}" --name apollo`,
    `  See ${DOCS}/examples/pm2`,
  ]
  if (platform === 'win32') {
    return [
      ...pm2,
      `Or use NSSM or Task Scheduler to run "${startScript}" at boot.`,
    ]
  }
  if (platform !== 'linux') {
    return pm2
  }
  return [
    'To run it as a systemd service, save this as',
    '/etc/systemd/system/apollo.service and run',
    '`sudo systemctl enable --now apollo`:',
    '',
    '  [Unit]',
    '  Description=Apollo collaboration server',
    '  After=network-online.target',
    '',
    '  [Service]',
    `  User=${os.userInfo().username}`,
    `  ExecStart=${startScript}`,
    '  Restart=on-failure',
    '',
    '  [Install]',
    '  WantedBy=multi-user.target',
    '',
    ...pm2,
  ]
}

export interface SummaryOptions {
  answers: SetupAnswers
  startScriptName: string
  addedFiles: AddedFile[]
  rootPasswordGenerated: boolean
  platform: NodeJS.Platform
}

/** What to do next, printed when setup finishes */
export function renderSummary(options: SummaryOptions): string {
  const { answers, addedFiles, platform } = options
  const startScript = path.join(answers.installDir, options.startScriptName)
  const fileStatus = {
    added: 'added',
    unchanged: 'already there',
    kept: 'kept the existing file',
  }
  const lines = [
    `Apollo ${answers.apolloVersion} is installed in ${answers.installDir}`,
    '',
    'Files in the JBrowse directory:',
    ...addedFiles.map(
      ({ fileName, status }) => `  ${fileName}: ${fileStatus[status]}`,
    ),
    '',
    'Start the server with:',
    `  ${startScript}`,
    '',
    `Then open ${answers.url}`,
  ]
  if (answers.guestUser) {
    lines.push(
      `  Anyone can open it as a guest (role: ${answers.guestUser.role}).`,
    )
  }
  if (answers.rootUser) {
    lines.push(
      options.rootPasswordGenerated
        ? `  The generated root password is: ${answers.rootUser.password}`
        : '  The root password is the one you entered.',
      '  It is also in the .env file as ROOT_USER_PASSWORD.',
    )
  }
  if (answers.rootUser) {
    lines.push(
      '',
      'To use the Apollo CLI with this server as root:',
      `  apollo config --profile admin address ${answers.url}`,
      '  apollo config --profile admin accessType root',
      '  apollo config --profile admin rootPassword <password>',
      '  apollo login --profile admin',
    )
  }
  lines.push(
    '',
    `The settings are in ${path.join(answers.installDir, '.env')}. It holds`,
    'secrets, so keep it private. Restart the server after changing it.',
    '',
    ...serviceSnippets(platform, startScript),
    '',
    'Before using this in production:',
    `  - Put a reverse proxy with TLS in front of the server. See ${DOCS}/examples/ubuntu-server`,
  )
  if (answers.google || answers.microsoft) {
    lines.push(
      '  - Register the redirect URIs printed earlier with your login providers',
    )
  }
  if (answers.mongodb.type === 'embedded') {
    lines.push(
      '  - Replace the embedded MongoDB with a real MongoDB server (set',
      '    MONGODB_URI in .env and remove MONGODB_EMBEDDED_DIR)',
    )
  }
  lines.push(
    '  - Add assemblies to the JBrowse config file(s), e.g. with `jbrowse add-assembly`',
    '',
    'To upgrade, run `apollo setup` again with the same install directory and',
    'a newer --apollo-version. To roll back, run it with the older version.',
    `Old versions in ${path.join(answers.installDir, 'releases')} and old`,
    'apollo-v*.js files in the JBrowse directory can be deleted by hand.',
  )
  return lines.join('\n')
}
