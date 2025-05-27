import Link from '@docusaurus/Link'
import DocusaurusImageUrl from '@site/static/img/demo_screenshot.png'
import React from 'react'

import styles from './styles.module.css'
// @ts-expect-error Need to figure out proper way to declare this

export default function HomepageFeatures(): React.JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          <div className="text--center">
            <div className={styles.buttons}>
              <Link
                className="button button--secondary button--lg"
                to="//demo.apollo.jbrowse.org/?session=share-eZDit63bNm&password=Px6yn"
              >
                Try a Demo — 🧬
              </Link>
            </div>
            <img
              className="item shadow--md margin-vert--md"
              src={DocusaurusImageUrl as string}
              alt="description here"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
