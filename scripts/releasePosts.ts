// Helpers shared by the release scripts for finding and reading the blog post
// that holds a release's notes

import fs from 'node:fs'
import path from 'node:path'

import { sync } from 'cross-spawn'
import { valid } from 'semver'

export const BLOG_DIR = path.join('packages', 'website', 'blog')
export const SITE_URL = 'https://apollo.jbrowse.org'

export interface ReleasePost {
  /** Version without a leading "v", e.g. "1.2.0" */
  version: string
  /** Path of the Markdown file, relative to the repo root */
  file: string
  /** Directory holding the post and its images, relative to the repo root */
  dir: string
  /** Publish date from the file name, as YYYY-MM-DD */
  date: string
  /** URL of the post on the website */
  url: string
}

/** Strip a leading "v" and check that what's left is a semver version */
export function normalizeVersion(version: string) {
  const v = version.replace(/^v/, '')
  if (!valid(v)) {
    throw new Error(`"${version}" is not a valid version`)
  }
  return v
}

function escapeRegExp(s: string) {
  return s.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
}

/**
 * Find the blog post for a release. It is either
 * `blog/YYYY/MM-DD-vX.Y.Z/index.md` (when it has images) or
 * `blog/YYYY/MM-DD-vX.Y.Z.md`.
 */
export function findReleasePost(version: string): ReleasePost | undefined {
  const v = normalizeVersion(version)
  const name = new RegExp(
    String.raw`^(\d{4})[/\\](\d{2})-(\d{2})-v${escapeRegExp(v)}(?:[/\\]index)?\.mdx?$`,
  )
  const entries = fs.readdirSync(BLOG_DIR, {
    recursive: true,
    encoding: 'utf8',
  })
  for (const entry of entries.toSorted()) {
    const match = name.exec(entry)
    if (!match) {
      continue
    }
    const [, year, month, day] = match as unknown as [
      string,
      string,
      string,
      string,
    ]
    const file = path.join(BLOG_DIR, entry)
    return {
      version: v,
      file,
      dir: path.dirname(file),
      date: `${year}-${month}-${day}`,
      // The ".html" link works even where the host has no extensionless rewrites
      url: `${SITE_URL}/blog/${year}/${month}/${day}/v${v}.html`,
    }
  }
  return undefined
}

/** Run a command, failing if it fails, and return its trimmed stdout */
export function run(
  executable: string,
  args: string[],
  options: { allowFailure?: boolean } = {},
) {
  const child = sync(executable, args, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', options.allowFailure ? 'pipe' : 'inherit'],
  })
  if (child.error) {
    throw child.error
  }
  if (child.status !== 0) {
    if (options.allowFailure) {
      return
    }
    throw new Error(
      `"${executable} ${args.join(' ')}" failed with code ${child.status}`,
    )
  }
  return child.stdout.trim()
}
