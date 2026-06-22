// import Link from '@docusaurus/Link'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import DemoLink from '@site/src/components/DemoLink'
import HomepageFeatures from '@site/src/components/HomepageFeatures'
import NewsletterForm from '@site/src/components/NewsletterForm'
import Heading from '@theme/Heading'
import Layout from '@theme/Layout'
import { clsx } from 'clsx'
import React from 'react'

import styles from './index.module.css'

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext()
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
      </div>
    </header>
  )
}

export default function Home(): React.JSX.Element {
  const { siteConfig } = useDocusaurusContext()
  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline}>
      <HomepageHeader />
      <main>
        <DemoLink />
        <HomepageFeatures />
        <NewsletterForm />
      </main>
    </Layout>
  )
}
