import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const docsDir = '../website/docs/03-multi-user/03-guides/04-cli'

// oclif repeats the topic title as the section heading for single-command
// topics. Docusaurus gives the second heading a suffix, so its one-item list
// points to a missing anchor. Match both oclif's raw and Prettier's output.
const duplicateCommand =
  /^(?:# (.+)|([^\n]+)\n=+)\n\n[^\n]+\n\n[-*] \[([^\n]+)\]\(#[^\s)]+\)\n\n## ([^\n]+)\n/

for (const name of readdirSync(docsDir)) {
  if (!name.endsWith('.md')) {
    continue
  }
  const file = path.join(docsDir, name)
  const contents = readFileSync(file, 'utf8')
  const [prefix, atxTitle, setextTitle, linkLabel, heading] =
    duplicateCommand.exec(contents) ?? []
  if (
    prefix &&
    (atxTitle ?? setextTitle) === heading &&
    linkLabel === heading
  ) {
    writeFileSync(
      file,
      contents.replace(prefix, prefix.replace(/\n[-*] \[[^\n]+\n/, '')),
    )
  }
}
