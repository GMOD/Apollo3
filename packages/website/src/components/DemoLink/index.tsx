import Link from '@docusaurus/Link'
import DocusaurusImageUrl from '@site/static/img/demo_screenshot.png'
import React from 'react'

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
                to="/demo//?assembly=Onchocerca%20volvulus&loc=OVOC_OM2:23836500-23840000&tracks=onchocerca_volvulus.PRJEB513.WBPS19.genomic-ReferenceSequenceTrack,apollo_track_Onchocerca%20volvulus,onchocerca_volvulus.PRJEB513.WBPS19.annotations.genes.sorted.gff3&tracklist=true"
                target="_blank"
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
