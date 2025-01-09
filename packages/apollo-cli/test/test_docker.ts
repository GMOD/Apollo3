import assert from 'node:assert'
import { after, before, describe } from 'node:test'
import { shell } from './utils'
import fs from 'node:fs'
import path from 'node:path'

const hostTmpDir = path.resolve('tmpTestDocker')
const hostDataDir = path.resolve('test_data')
const apollo = `docker run --network host -v ${hostTmpDir}:/root/.config/apollo-cli -v ${hostDataDir}:/data apollo`
const configFile = '/root/.config/apollo-cli/config.yml'

describe('Test Docker', () => {
  before(() => {
    if (fs.existsSync(hostTmpDir) && fs.lstatSync(hostTmpDir).isDirectory()) {
      fs.rmSync(hostTmpDir, { recursive: true })
    }
    fs.mkdirSync(hostTmpDir)
    fs.writeFileSync(path.join(hostTmpDir, 'config.yml'), '')

    new shell('docker build --no-cache -t apollo .')

    // See apollo-collaboration-server/.development.env for credentials etc.
    new shell(
      `${apollo} config --config-file ${configFile} address http://localhost:3999`,
    )
    new shell(`${apollo} config --config-file ${configFile} accessType root`)
    new shell(`${apollo} config --config-file ${configFile} rootPassword pass`)
    new shell(`${apollo} login --config-file ${configFile}`, true, 60000)
  })

  after(() => {
    fs.rmSync(hostTmpDir, { recursive: true })
  })

  globalThis.itName('Print help', () => {
    const p = new shell(`${apollo} --help`)
    assert.ok(p.stdout.includes('COMMANDS'))
  })

  globalThis.itName('Add assembly', () => {
    const configFile = '/root/.config/apollo-cli/config.yml'
    new shell(
      `${apollo} assembly add-from-gff --config-file ${configFile} data/tiny.fasta.gff3 -a vv1 -f`,
    )
    let p = new shell(
      `${apollo} assembly get --config-file ${configFile} -a vv1`,
    )
    assert.ok(p.stdout.includes('vv1'))

    new shell(`${apollo} assembly delete --config-file ${configFile} -a vv1`)
    p = new shell(`${apollo} assembly get --config-file ${configFile} -a vv1`)
    assert.deepStrictEqual(p.stdout.trim(), '[]')
  })

  globalThis.itName('Missing config', () => {
    let p = new shell(
      `${apollo} config address --config-file {hostTmpDir}/new.yml http://localhost:3999`,
      false,
    )
    assert.ok(p.returncode != 0)
    assert.ok(p.stderr.includes('does not exist yet'))

    p = new shell(
      `${apollo} config address --config-file /root/.config/apollo-cli/new.yml http://localhost:3999`,
      false,
    )
    assert.ok(p.returncode != 0)
    assert.ok(p.stderr.includes('does not exist yet'))

    fs.writeFileSync(path.join(hostTmpDir, 'new.yml'), '')
    p = new shell(
      `${apollo} config address --config-file /root/.config/apollo-cli/new.yml http://localhost:3999`,
    )
    assert.strictEqual(p.returncode, 0)
  })
})
