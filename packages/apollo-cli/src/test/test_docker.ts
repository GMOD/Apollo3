import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { after, before, describe } from 'node:test'

import { Shell } from './utils.js'

const hostTmpDir = path.resolve('tmpTestDocker')
const hostDataDir = path.resolve('test_data')
const apollo = `docker run --network host -v ${hostTmpDir}:/root/.config/apollo-cli -v ${hostDataDir}:/data apollo`
const configFile = '/root/.config/apollo-cli/config.yml'

void describe('Test Docker', () => {
  before(() => {
    if (fs.existsSync(hostTmpDir) && fs.lstatSync(hostTmpDir).isDirectory()) {
      fs.rmSync(hostTmpDir, { recursive: true })
    }
    fs.mkdirSync(hostTmpDir)
    fs.writeFileSync(path.join(hostTmpDir, 'config.yml'), '')

    new Shell('docker build --no-cache -t apollo .')

    // See apollo-collaboration-server/.development.env for credentials etc.
    new Shell(
      `${apollo} config --config-file ${configFile} address http://localhost:3999`,
    )
    new Shell(`${apollo} config --config-file ${configFile} accessType root`)
    new Shell(`${apollo} config --config-file ${configFile} rootPassword pass`)
    new Shell(`${apollo} login --config-file ${configFile}`, true, 60_000)
  })

  after(() => {
    fs.rmSync(hostTmpDir, { recursive: true })
  })

  void globalThis.itName('Print help', () => {
    const p = new Shell(`${apollo} --help`)
    assert.ok(p.stdout.includes('COMMANDS'))
  })

  void globalThis.itName('Add assembly', () => {
    const configFile = '/root/.config/apollo-cli/config.yml'
    new Shell(
      `${apollo} assembly add-from-gff --config-file ${configFile} data/tiny.fasta.gff3 -a vv1 -f`,
    )
    let p = new Shell(
      `${apollo} assembly get --config-file ${configFile} -a vv1`,
    )
    assert.ok(p.stdout.includes('vv1'))

    new Shell(`${apollo} assembly delete --config-file ${configFile} -a vv1`)
    p = new Shell(`${apollo} assembly get --config-file ${configFile} -a vv1`)
    assert.deepStrictEqual(p.stdout.trim(), '[]')
  })

  void globalThis.itName('Missing config', () => {
    let p = new Shell(
      `${apollo} config address --config-file {hostTmpDir}/new.yml http://localhost:3999`,
      false,
    )
    assert.ok(p.returncode != 0)
    assert.ok(p.stderr.includes('does not exist yet'))

    p = new Shell(
      `${apollo} config address --config-file /root/.config/apollo-cli/new.yml http://localhost:3999`,
      false,
    )
    assert.ok(p.returncode != 0)
    assert.ok(p.stderr.includes('does not exist yet'))

    fs.writeFileSync(path.join(hostTmpDir, 'new.yml'), '')
    p = new Shell(
      `${apollo} config address --config-file /root/.config/apollo-cli/new.yml http://localhost:3999`,
    )
    assert.strictEqual(p.returncode, 0)
  })
})
