import Link from '@docusaurus/Link'
import Heading from '@theme/Heading'
import React from 'react'

import styles from './styles.module.css'

interface SetupPath {
  title: string
  description: string
  links: { label: string; to: string }[]
}

const setupPaths: SetupPath[] = [
  {
    title: 'Learn Apollo',
    description:
      'New to Apollo? Our user guide walks you step by step through creating and editing your first gene models.',
    links: [{ label: 'User guide', to: '/docs/user-guide' }],
  },
  {
    title: 'Annotate on your own',
    description:
      'Use Apollo in JBrowse 2 on the web, where your genome is already hosted, or with your own data in JBrowse Desktop.',
    links: [
      { label: 'JBrowse Web', to: '/docs/single-user/jbrowse-web' },
      { label: 'JBrowse Desktop', to: '/docs/single-user/jbrowse-desktop' },
    ],
  },
  {
    title: 'Annotate as a team',
    description:
      'Set up an Apollo collaboration server so your group can annotate together. Try a local demo first, then install.',
    links: [
      { label: 'Local demo', to: '/docs/multi-user/local-demo/setting-up' },
      { label: 'Installation', to: '/docs/multi-user/installation/background' },
    ],
  },
]

export default function GetStarted(): React.JSX.Element {
  return (
    <section className={styles.section}>
      <div className="container">
        <Heading as="h2" className="text--center margin-bottom--lg">
          Get started
        </Heading>
        <div className="row">
          {setupPaths.map(({ description, links, title }) => (
            <div key={title} className="col col--4 margin-bottom--lg">
              <div className={styles.path}>
                <Heading as="h3">{title}</Heading>
                <p>{description}</p>
                <div className={styles.buttons}>
                  {links.map(({ label, to }) => (
                    <Link
                      key={to}
                      className="button button--primary button--md"
                      to={to}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
