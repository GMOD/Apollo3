import Link from '@docusaurus/Link'
import DocusaurusImageUrl from '@site/static/img/demo_screenshot.png'
import React from 'react'

import { demoUrl } from '../../../demoUrl'

import styles from './styles.module.css'

export default function HomepageFeatures(): React.JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          <div className="text--center">
            <div className={styles.buttons}>
              <Link
                className="button button--secondary button--lg"
                href={demoUrl}
                target="_blank"
              >
                Try a Demo — 🧬
              </Link>
            </div>
            <img
              className="item shadow--md margin-vert--md"
              src={DocusaurusImageUrl}
              alt="description here"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
