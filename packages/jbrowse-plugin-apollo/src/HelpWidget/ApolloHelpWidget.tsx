import { ExternalLink } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import { Divider, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import { version } from '../../package.json'

const websiteUrl = 'https://apollo.jbrowse.org'
const githubUrl = 'https://github.com/GMOD/Apollo3'
const contactEmail = 'team@apollo.jbrowse.org'

interface HelpLink {
  label: string
  href: string
  /** Short explanation shown after the link */
  description?: string
}

interface HelpSection {
  title: string
  links: HelpLink[]
}

const guideSections: HelpSection[] = [
  {
    title: 'Learn Apollo',
    links: [
      {
        label: 'User guide',
        href: `${websiteUrl}/docs/user-guide`,
        description:
          'step-by-step instructions for creating and editing gene models',
      },
      {
        label: 'Evidence tracks',
        href: `${websiteUrl}/docs/multi-user/guides/evidence-tracks`,
        description:
          'show RNA-seq, gene models, synteny, and other evidence, and copy features into your annotations',
      },
      {
        label: 'Documentation',
        href: `${websiteUrl}/docs`,
        description: 'everything else',
      },
    ],
  },
  {
    title: 'Set up Apollo',
    links: [
      {
        label: 'Annotate on your own',
        href: `${websiteUrl}/docs/single-user`,
        description: 'in JBrowse Web or JBrowse Desktop, with no server',
      },
      {
        label: 'Annotate as a team',
        href: `${websiteUrl}/docs/multi-user`,
        description:
          'on a shared collaboration server where edits appear for everyone in real time',
      },
    ],
  },
  {
    title: 'Automate and extend',
    links: [
      {
        label: 'Command-line tool',
        href: `${websiteUrl}/docs/multi-user/guides/cli`,
      },
      {
        label: 'REST API',
        href: `${websiteUrl}/docs/multi-user/guides/rest-api`,
      },
      {
        label: 'Developer guide',
        href: `${websiteUrl}/docs/developer-guide`,
        description: 'write client and server plugins',
      },
    ],
  },
]

interface Citation {
  label: string
  reference: string
  doi: string
}

// Short forms of the citations on the website homepage, which has the full
// author lists and BibTeX
const citations: Citation[] = [
  {
    label: 'Apollo 3 (preprint)',
    reference:
      'Stevens, G. J., et al. (2026). Apollo 3: Multi-Species Genome Curation. bioRxiv.',
    doi: '10.64898/2026.06.08.730970',
  },
  {
    label: 'Apollo',
    reference:
      'Dunn, N. A., et al. (2019). Apollo: Democratizing genome annotation. PLOS Computational Biology, 15(2), e1006790.',
    doi: '10.1371/journal.pcbi.1006790',
  },
  {
    label: 'JBrowse 2, which Apollo is built on',
    reference:
      'Diesh, C., et al. (2023). JBrowse 2: a modular genome browser with views of synteny and structural variation. Genome Biology, 24(1), 74.',
    doi: '10.1186/s13059-023-02914-z',
  },
]

const useStyles = makeStyles()((theme) => ({
  root: {
    margin: theme.spacing(2),
  },
  subtitle: {
    margin: theme.spacing(1),
  },
  divider: {
    margin: theme.spacing(2, 0),
  },
  sectionTitle: {
    marginTop: theme.spacing(1),
  },
  list: {
    marginTop: theme.spacing(0.5),
    paddingLeft: theme.spacing(3),
    '& li': {
      marginBottom: theme.spacing(0.5),
    },
  },
  paragraph: {
    marginBottom: theme.spacing(1.5),
  },
  citation: {
    marginBottom: theme.spacing(1),
  },
}))

function LinkList({ links }: { links: HelpLink[] }) {
  const { classes } = useStyles()
  return (
    <ul className={classes.list}>
      {links.map(({ description, href, label }) => (
        <li key={href}>
          <Typography variant="body2">
            <ExternalLink href={href}>{label}</ExternalLink>
            {description ? `: ${description}` : null}
          </Typography>
        </li>
      ))}
    </ul>
  )
}

export const ApolloHelpWidget = observer(function ApolloHelpWidget({
  model,
}: {
  model: IAnyStateTreeNode
}) {
  const { classes } = useStyles()
  const { version: jbrowseVersion } = getSession(model) as {
    version?: string
  }
  return (
    <div className={classes.root}>
      <Typography variant="h4" align="center">
        Apollo
      </Typography>
      <Typography variant="subtitle1" align="center" color="textSecondary">
        Collaborative, customizable, and scalable graphical genome annotation
      </Typography>
      <Typography variant="h6" align="center" className={classes.subtitle}>
        Version{' '}
        <ExternalLink href={`${githubUrl}/releases/tag/v${version}`}>
          {version}
        </ExternalLink>
      </Typography>
      {jbrowseVersion ? (
        <Typography variant="body2" align="center" color="textSecondary">
          Running in JBrowse {jbrowseVersion}
        </Typography>
      ) : null}

      <Divider className={classes.divider} />

      <Typography variant="body2" className={classes.paragraph}>
        Apollo is a genome annotation editor built as a plugin for{' '}
        <ExternalLink href="https://jbrowse.org/jb2/">JBrowse 2</ExternalLink>.
        Create and refine gene models directly on any genome, next to any
        evidence JBrowse can display. Work on your own in a web browser or on
        the desktop, or with a team in real time on a shared server.
      </Typography>
      <Typography variant="body2" className={classes.paragraph}>
        As you edit, Apollo shows each transcript&apos;s protein translation and
        flags problems such as missing or internal stop codons and unexpected
        splice sites. Import and export GFF3 and FASTA to move annotations in
        and out.
      </Typography>
      <Typography variant="body2">
        Learn more on the{' '}
        <ExternalLink href={websiteUrl}>Apollo website</ExternalLink> or see the
        source on <ExternalLink href={githubUrl}>GitHub</ExternalLink>.
      </Typography>

      <Divider className={classes.divider} />

      <Typography variant="h6">Get help</Typography>
      <Typography variant="body2">
        Please include the version numbers above when asking questions or
        reporting bugs. Thanks!
      </Typography>
      <LinkList
        links={[
          {
            label: 'Question & answer forum',
            href: `${githubUrl}/discussions`,
            description: 'ask the Apollo developers and community',
          },
          {
            label: 'Report a bug',
            href: `${githubUrl}/issues/new/choose`,
          },
          {
            label: contactEmail,
            href: `mailto:${contactEmail}`,
            description: 'email the Apollo team',
          },
        ]}
      />

      <Divider className={classes.divider} />

      <Typography variant="h6">Guides</Typography>
      {guideSections.map(({ links, title }) => (
        <div key={title}>
          <Typography variant="subtitle2" className={classes.sectionTitle}>
            {title}
          </Typography>
          <LinkList links={links} />
        </div>
      ))}

      <Divider className={classes.divider} />

      <Typography variant="h6">Cite Apollo</Typography>
      <Typography variant="body2" className={classes.paragraph}>
        If you use Apollo in your research, please cite:
      </Typography>
      {citations.map(({ doi, label, reference }) => (
        <div key={doi} className={classes.citation}>
          <Typography variant="subtitle2">{label}</Typography>
          <Typography variant="body2">
            {reference}{' '}
            <ExternalLink href={`https://doi.org/${doi}`}>
              https://doi.org/{doi}
            </ExternalLink>
          </Typography>
        </div>
      ))}
      <Typography variant="body2">
        <ExternalLink href={`${websiteUrl}/#cite`}>
          Full citations and BibTeX
        </ExternalLink>
      </Typography>

      <Divider className={classes.divider} />

      <Typography variant="h6">Stay up to date</Typography>
      <LinkList
        links={[
          {
            label: 'Release notes',
            href: `${websiteUrl}/blog`,
          },
          {
            label: 'Newsletter',
            href: `${websiteUrl}/#apollo-newsletter`,
            description: 'get updates about new Apollo releases',
          },
        ]}
      />
    </div>
  )
})
