import Link from '@docusaurus/Link'
import JBrowseLogo from '@site/static/img/jbrowse_logo.svg'
import Heading from '@theme/Heading'
import React from 'react'

import styles from './styles.module.css'

interface FeatureItem {
  title: string
  description: React.JSX.Element
  link: { label: string; to: string }
}

const FeatureList: FeatureItem[] = [
  {
    title: 'Real-time collaboration',
    description: (
      <>
        Teams share one copy of each genome on an Apollo collaboration server.
        Every edit appears for everyone at once and is recorded in a changelog.
      </>
    ),
    link: { label: 'Multi-user Apollo', to: '/docs/multi-user' },
  },
  {
    title: 'Works on your own, too',
    description: (
      <>
        Use Apollo by yourself in JBrowse 2 on the web or JBrowse Desktop, with
        no server to install.
      </>
    ),
    link: { label: 'Single-user setup', to: '/docs/single-user' },
  },
  {
    title: 'Annotate with any evidence',
    description: (
      <>
        Show RNA-seq, gene models, synteny with related genomes, or any other
        track JBrowse supports. Copy features from evidence straight into your
        annotations.
      </>
    ),
    link: {
      label: 'Evidence tracks',
      to: '/docs/multi-user/guides/evidence-tracks',
    },
  },
  {
    title: 'Edit gene models with checks',
    description: (
      <>
        Add genes and transcripts, merge and split exons, and see the protein
        translation as you go. Apollo flags missing or internal stop codons and
        unexpected splice sites. You can also configure your own custom checks.
      </>
    ),
    link: { label: 'User guide', to: '/docs/user-guide' },
  },
  {
    title: 'Standard formats and automation',
    description: (
      <>
        Import and export GFF3 and FASTA. Script any task with the command-line
        tool or the REST API.
      </>
    ),
    link: { label: 'CLI guide', to: '/docs/multi-user/guides/cli' },
  },
  {
    title: 'Extensible',
    description: (
      <>
        Apollo is a JBrowse 2 plugin, and can itself be customized with plugins
        on the client and the server, for example to add new login methods.
      </>
    ),
    link: { label: 'Developer guide', to: '/docs/developer-guide' },
  },
]

function Feature({ description, link, title }: FeatureItem) {
  return (
    <div className="col col--4 margin-bottom--lg">
      <div className={styles.card}>
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
        <Link className={styles.cardLink} to={link.to}>
          {link.label} →
        </Link>
      </div>
    </div>
  )
}

export default function HomepageFeatures(): React.JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props) => (
            <Feature key={props.title} {...props} />
          ))}
        </div>
        <div className={styles.credit}>
          <JBrowseLogo className={styles.creditLogo} role="img" />
          <p>
            Built on <Link to="https://jbrowse.org/jb2/">JBrowse 2</Link>, and
            inspired by earlier annotation editors such as Web Apollo, Artemis,
            and Otter.
          </p>
        </div>
      </div>
    </section>
  )
}
