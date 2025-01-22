import Heading from '@theme/Heading'
import React from 'react'
import styles from './styles.module.css'
import Link from '@docusaurus/Link'
import JBrowseLogo from '@site/static/img/jbrowse_logo.svg'
import ApolloLogo from '@site/static/img/apollo_logo.svg'

interface FeatureItem {
  title: string
  Svg: React.ComponentType<React.ComponentProps<'svg'>>
  description: React.JSX.Element
}

const FeatureList: FeatureItem[] = [
  {
    title: 'Built on JBrowse 2',
    Svg: JBrowseLogo,
    description: (
      <>
        Apollo is built on <Link to="//jbrowse.org/jb2/">JBrowse 2</Link>,
        allowing you to use the latest updates in genome browsing.
      </>
    ),
  },
  {
    title: 'Built for today',
    Svg: ApolloLogo,
    description: (
      <>
        Inspired by previous genome annotation editors — such as Web Apollo,
        Artemis, and Otter — using updated technologies.
      </>
    ),
  },
]

function Feature({ Svg, description, title }: FeatureItem) {
  return (
    <div className="col col--6">
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  )
}

export default function HomepageFeatures(): React.JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  )
}
