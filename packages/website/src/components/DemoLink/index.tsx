import React from 'react'
import styles from './styles.module.css'
// @ts-expect-error Need to figure out proper way to declare this
import DocusaurusImageUrl from '@site/static/img/demo_screenshot.png'
import Link from '@docusaurus/Link'

export default function HomepageFeatures(): React.JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          <div className="text--center">
            <div className={styles.buttons}>
              <Link
                className="button button--secondary button--lg"
                to="//demo.apollo.jbrowse.org/"
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