import Link from '@docusaurus/Link'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import CiteApollo from '@site/src/components/CiteApollo'
import DemoLink from '@site/src/components/DemoLink'
import Funding from '@site/src/components/Funding'
import GetStarted from '@site/src/components/GetStarted'
import HomepageFeatures from '@site/src/components/HomepageFeatures'
import NewsletterForm from '@site/src/components/NewsletterForm'
import { mainDemoUrl } from '@site/src/demoUrls'
import Heading from '@theme/Heading'
import Layout from '@theme/Layout'
import { clsx } from 'clsx'
import React from 'react'

import styles from './index.module.css'

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext()
  const apolloVersion = siteConfig.customFields?.apolloVersion as string
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <p className={styles.heroDescription}>
          Apollo is a genome annotation editor built as a plugin for{' '}
          <Link to="https://jbrowse.org/jb2/">JBrowse 2</Link>. Create and
          refine gene models directly on any genome, next to any evidence
          JBrowse can display. Work on your own in a web browser or on the
          desktop, or with a team in real time on a shared server.
        </p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to={mainDemoUrl}
            target="_blank"
          >
            Try the demo
          </Link>
          <Link className="button button--secondary button--lg" to="/docs">
            Get started
          </Link>
          <Link
            className={clsx(
              'button button--secondary button--outline button--lg',
              styles.heroOutlineButton,
            )}
            to="https://github.com/GMOD/Apollo3"
          >
            GitHub
          </Link>
        </div>
        <p className={styles.release}>
          Latest release:{' '}
          <Link
            to={`https://github.com/GMOD/Apollo3/releases/tag/v${apolloVersion}`}
          >
            v{apolloVersion}
          </Link>
          {' · '}
          <Link to="/blog">Release notes</Link>
        </p>
      </div>
    </header>
  )
}

export default function Home(): React.JSX.Element {
  const { siteConfig } = useDocusaurusContext()
  return (
    <Layout
      title={siteConfig.title}
      description="Apollo is a genome annotation editor built as a plugin for JBrowse 2. Create and refine gene models on any genome, on your own or with a team in real time."
    >
      <HomepageHeader />
      <main>
        <DemoLink />
        <HomepageFeatures />
        <GetStarted />
        <CiteApollo />
        <Funding />
        <NewsletterForm />
      </main>
    </Layout>
  )
}
