import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  BLOG_DIR,
  type ReleasePost,
  SITE_URL,
  findReleasePost,
  normalizeVersion,
  run,
} from './releasePosts.js'

import { marked } from 'marked'
import { compare, major, prerelease, valid } from 'semver'
import yargs from 'yargs/yargs'

const REPO = process.env.GITHUB_REPOSITORY ?? 'GMOD/Apollo3'
const AUTHOR = 'garrettjstevens'

const usage = `Manage release notes. The blog post for a release in
${BLOG_DIR}/YYYY/MM-DD-vX.Y.Z/index.md is the single source of the notes, and
the GitHub release and MailerLite email are generated from it.`

// ---------------------------------------------------------------------------
// GitHub helpers

/** Versions (without "v") of all non-prerelease version tags on GitHub */
function getRemoteVersions() {
  const refs = run('gh', [
    'api',
    `repos/${REPO}/git/matching-refs/tags/v`,
    '--paginate',
    '--jq',
    '.[].ref',
  ])
  return (refs ?? '')
    .split('\n')
    .map((ref) => ref.replace(/^refs\/tags\/v/, ''))
    .filter((v) => valid(v) && !prerelease(v))
}

function getPreviousTag(version: string) {
  const older = getRemoteVersions().filter((v) => compare(v, version) < 0)
  older.sort(compare)
  const previous = older.at(-1)
  if (!previous) {
    throw new Error(`Could not find a release before v${version}`)
  }
  return `v${previous}`
}

function localTagExists(tag: string) {
  return (
    run('git', ['rev-parse', '--quiet', '--verify', `refs/tags/${tag}`], {
      allowFailure: true,
    }) !== undefined
  )
}

function releaseExists(tag: string) {
  return (
    run('gh', ['release', 'view', tag, '--repo', REPO, '--json', 'tagName'], {
      allowFailure: true,
    }) !== undefined
  )
}

/** Whether this version would be the highest release on GitHub */
function isLatest(version: string) {
  if (prerelease(version)) {
    return false
  }
  return getRemoteVersions().every((v) => compare(v, version) <= 0)
}

/** The "What's Changed" list GitHub generates for a release */
function generateChangeList(tag: string, previousTag: string) {
  const args = [
    'api',
    `repos/${REPO}/releases/generate-notes`,
    '--field',
    `tag_name=${tag}`,
    '--field',
    `previous_tag_name=${previousTag}`,
    '--jq',
    '.body',
  ]
  if (!localTagExists(tag)) {
    args.push('--field', 'target_commitish=main')
  }
  const body = run('gh', args) ?? ''
  return body
    .replace(/^## What's Changed\s*\n/m, '')
    .replaceAll(/^## /gm, '### ')
    .trim()
}

// ---------------------------------------------------------------------------
// Markdown helpers

interface ParsedPost {
  title: string
  /** Everything above the truncate marker */
  summary: string
  /** The whole post body, without the truncate marker */
  body: string
}

const truncateMarker =
  /^[ \t]*(?:<!--\s*truncate\s*-->|\{\/\*\s*truncate\s*\*\/\})[ \t]*$/m

// Drop HTML comments, e.g. leftover TODO notes, and the blank lines they leave
function clean(markdown: string) {
  return markdown
    .replaceAll(/<!--[\s\S]*?-->/g, '')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim()
}

function parsePost(post: ReleasePost): ParsedPost {
  let text = fs.readFileSync(post.file, 'utf8')
  text = text.replace(/^---\n[\s\S]*?\n---\n/, '')
  const titleMatch = /^# (.+)$/m.exec(text)
  if (!titleMatch?.[1]) {
    throw new Error(`Could not find a "# Title" heading in ${post.file}`)
  }
  const title = titleMatch[1].trim()
  text = text.replace(titleMatch[0], '')
  const [summary = '', ...rest] = text.split(truncateMarker)
  return {
    title,
    summary: clean(summary),
    body: clean([summary, ...rest].join('\n')),
  }
}

/** Apply a transform to the parts of some Markdown outside of code fences */
function outsideCode(markdown: string, transform: (s: string) => string) {
  return markdown
    .split(/(^```[\s\S]*?^```[^\n]*$)/m)
    .map((part, idx) => (idx % 2 === 0 ? transform(part) : part))
    .join('')
}

/**
 * Make relative and site-absolute URLs absolute, so they work outside the
 * website. Images in the post's folder are served from GitHub at `ref`.
 */
function absoluteUrls(markdown: string, post: ReleasePost, ref: string) {
  const postDir = post.dir.split(path.sep).join('/')
  const resolve = (url: string, isImage: boolean) => {
    if (/^[a-z][\d+.a-z-]*:/i.test(url) || url.startsWith('#')) {
      return url
    }
    if (url.startsWith('/')) {
      return `${SITE_URL}${url}`
    }
    const repoPath = path.posix.normalize(path.posix.join(postDir, url))
    return isImage
      ? `https://raw.githubusercontent.com/${REPO}/${ref}/${repoPath}`
      : `https://github.com/${REPO}/blob/${ref}/${repoPath}`
  }
  return outsideCode(markdown, (s) =>
    s
      .replaceAll(
        /(!?)\[([^\]]*)\]\(([^\s)]+)((?:\s+"[^"]*")?)\)/g,
        (_m, bang: string, text: string, url: string, title: string) =>
          `${bang}[${text}](${resolve(url, bang === '!')}${title})`,
      )
      .replaceAll(
        /(<img\b[^>]*\bsrc=")([^"]+)(")/g,
        (_m, before: string, url: string, after: string) =>
          `${before}${resolve(url, true)}${after}`,
      ),
  )
}

const alertTypes: Record<string, string> = {
  note: 'NOTE',
  info: 'NOTE',
  tip: 'TIP',
  important: 'IMPORTANT',
  warning: 'WARNING',
  caution: 'CAUTION',
  danger: 'CAUTION',
}

/**
 * Turn Docusaurus admonitions (`:::note ... :::`) into blockquotes, as GitHub
 * alerts (`> [!NOTE]`) or as a quote starting with a bold label
 */
function convertAdmonitions(markdown: string, style: 'github' | 'plain') {
  return outsideCode(markdown, (s) =>
    s.replaceAll(
      /^:::(\w+)(?:\[(.*?)\]|[ \t]+(.*))?\n([\s\S]*?)^:::[ \t]*$/gm,
      (
        _m,
        kind: string,
        bracketTitle: string | undefined,
        spaceTitle: string | undefined,
        content: string,
      ) => {
        const type = alertTypes[kind.toLowerCase()] ?? 'NOTE'
        const title = (bracketTitle ?? spaceTitle)?.trim()
        const lines =
          style === 'github'
            ? [`[!${type}]`, ...(title ? [`**${title}**`, ''] : [])]
            : [
                `**${title ?? type.charAt(0) + type.slice(1).toLowerCase()}:**`,
                '',
              ]
        lines.push(...content.trimEnd().split('\n'))
        return lines.map((line) => (line ? `> ${line}` : '>')).join('\n')
      },
    ),
  )
}

function requirePost(version: string) {
  const post = findReleasePost(version)
  if (!post) {
    throw new Error(
      `No blog post found for v${normalizeVersion(version)}. Create one with "yarn release-notes new ${version}".`,
    )
  }
  return post
}

// ---------------------------------------------------------------------------
// Commands

function newPost(version: string, previous?: string, date?: string) {
  const v = normalizeVersion(version)
  const tag = `v${v}`
  const existing = findReleasePost(v)
  if (existing) {
    throw new Error(`A post for ${tag} already exists: ${existing.file}`)
  }
  const previousTag = previous
    ? `v${normalizeVersion(previous)}`
    : getPreviousTag(v)
  const postDate =
    date ??
    (localTagExists(tag)
      ? run('git', ['log', '-1', '--format=%cs', `refs/tags/${tag}`])
      : undefined) ??
    new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time
  const [year, month, day] = postDate.split('-')
  if (!year || !month || !day) {
    throw new Error(`Invalid date "${postDate}", expected YYYY-MM-DD`)
  }
  const changes = generateChangeList(tag, previousTag)
  const title = major(v) === 0 ? `Beta Version ${v}` : `Version ${v}`

  const content = `---
authors: ${AUTHOR}
---

# ${title}

We are excited to release version \`${tag}\` of Apollo 3. Below are some of the
changes since \`${previousTag}\` that we'd like to highlight.

<!-- TODO: Add any upgrade notes here, e.g. a minimum JBrowse version -->

<!-- truncate -->

## New features

<!-- TODO: Describe new features, or remove this section -->

## Improved functionality

<!-- TODO: Describe improvements and fixes, or remove this section -->

## For more information

For more details on any of the changes mentioned as well as many more changes
that have been made, please reference the associated GitHub issues.

${changes}
`
  const dir = path.join(BLOG_DIR, year, `${month}-${day}-${tag}`)
  const file = path.join(dir, 'index.md')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(file, content)
  run('yarn', ['prettier', '--write', file])
  console.error(`Created ${file} (changes since ${previousTag})`)
  console.error('Put any screenshots in the same folder and reference them as')
  console.error('![Description](screenshot.png)')
}

function githubNotes(post: ReleasePost, ref: string) {
  const { title, body } = parsePost(post)
  let notes = convertAdmonitions(body, 'github')
  notes = absoluteUrls(notes, post, ref)
  notes = `_This post is also on the [Apollo blog](${post.url})._\n\n${notes}\n`
  return { title, notes }
}

function github(
  version: string,
  ref: string | undefined,
  create: boolean,
  draft: boolean,
) {
  const v = normalizeVersion(version)
  const tag = `v${v}`
  const post = findReleasePost(v)

  if (!post) {
    if (!create) {
      requirePost(v)
      return
    }
    // A workflow command, which GitHub Actions reads from stdout
    process.stdout.write(
      `::warning::No blog post found for ${tag}, so its GitHub release uses GitHub's generated notes\n`,
    )
    if (releaseExists(tag)) {
      console.error(`Release ${tag} already exists, leaving it as it is`)
      return
    }
    run('gh', [
      'release',
      'create',
      tag,
      '--repo',
      REPO,
      '--generate-notes',
      '--verify-tag',
      `--draft=${draft}`,
      `--latest=${isLatest(v)}`,
      `--prerelease=${prerelease(v) !== null}`,
    ])
    return
  }

  const { title, notes } = githubNotes(post, ref ?? tag)
  if (!create) {
    process.stdout.write(`# ${title}\n\n${notes}`)
    return
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-notes-'))
  const notesFile = path.join(tmpDir, 'notes.md')
  fs.writeFileSync(notesFile, notes)
  try {
    if (releaseExists(tag)) {
      run('gh', [
        'release',
        'edit',
        tag,
        '--repo',
        REPO,
        '--title',
        title,
        '--notes-file',
        notesFile,
      ])
      console.error(`Updated GitHub release ${tag}`)
    } else {
      run('gh', [
        'release',
        'create',
        tag,
        '--repo',
        REPO,
        '--title',
        title,
        '--notes-file',
        notesFile,
        '--verify-tag',
        `--draft=${draft}`,
        `--latest=${isLatest(v)}`,
        `--prerelease=${prerelease(v) !== null}`,
      ])
      console.error(`Created ${draft ? 'draft ' : ''}GitHub release ${tag}`)
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

function email(
  version: string,
  ref: string | undefined,
  summary: boolean,
  out: string | undefined,
) {
  const post = requirePost(version)
  const parsed = parsePost(post)
  let markdown = summary ? parsed.summary : parsed.body
  markdown = convertAdmonitions(markdown, 'plain')
  markdown = absoluteUrls(markdown, post, ref ?? `v${post.version}`)
  const content = marked
    .parse(markdown, { async: false })
    .replaceAll('<img ', '<img style="max-width:100%;height:auto;" ')
  const linkText = summary ? 'Read the full post' : 'Read this post'
  const html = `<h1>${parsed.title}</h1>
${content}
<p><a href="${post.url}">${linkText} on the Apollo blog</a></p>
`
  if (out) {
    fs.writeFileSync(out, html)
    console.error(`Wrote ${out}`)
  } else {
    process.stdout.write(html)
  }
}

// ---------------------------------------------------------------------------

const versionArg = {
  describe: 'Release version, with or without a leading "v"',
  type: 'string',
  demandOption: true,
} as const

const refOption = {
  describe:
    'Git ref to load the post\'s images from on GitHub [default: the release tag]. Use "main" for posts added after the tag.',
  type: 'string',
} as const

await yargs(process.argv.slice(2))
  .usage(usage)
  .strict()
  .version(false)
  .demandCommand(1)
  .command(
    'new <release>',
    'Create a blog post for a release, listing the merged pull requests',
    (y) =>
      y.positional('release', versionArg).options({
        previous: {
          describe:
            'Release to list changes since [default: the closest earlier release]',
          type: 'string',
        },
        date: {
          describe:
            'Post date as YYYY-MM-DD [default: the tag date if the tag exists, otherwise today]',
          type: 'string',
        },
      }),
    (argv) => {
      newPost(argv.release, argv.previous, argv.date)
    },
  )
  .command(
    'github <release>',
    'Print the GitHub release notes for a release, or create the release',
    (y) =>
      y.positional('release', versionArg).options({
        ref: refOption,
        create: {
          describe:
            'Create the GitHub release (or update it if it exists) instead of printing the notes',
          type: 'boolean',
          default: false,
        },
        draft: {
          describe:
            'With --create, make a new release as a draft to review and publish by hand (an existing release keeps its status)',
          type: 'boolean',
          default: false,
        },
      }),
    (argv) => {
      github(argv.release, argv.ref, argv.create, argv.draft)
    },
  )
  .command(
    'email <release>',
    'Write the release notes as HTML for a MailerLite "Custom HTML" block',
    (y) =>
      y.positional('release', versionArg).options({
        ref: refOption,
        summary: {
          describe:
            'Only include the introduction (the part before the truncate marker)',
          type: 'boolean',
          default: false,
        },
        out: {
          alias: 'o',
          describe: 'File to write the HTML to [default: print it]',
          type: 'string',
        },
      }),
    (argv) => {
      email(argv.release, argv.ref, argv.summary, argv.out)
    },
  )
  .parseAsync()
