import Link from '@docusaurus/Link'
import { mainDemoUrl } from '@site/src/demoUrls'
import demoScreenshotUrl from '@site/static/img/demo_screenshot.png'
import React from 'react'

import styles from './styles.module.css'

export default function DemoLink(): React.JSX.Element {
  return (
    <section className={styles.demo}>
      <div className="container">
        <figure className={styles.figure}>
          <Link to={mainDemoUrl} target="_blank" className={styles.imageLink}>
            <img
              className="shadow--md"
              src={demoScreenshotUrl}
              alt="Apollo running in JBrowse 2. A synteny view compares gene models in Trichuris muris and Trichuris trichiura, with a table of the selected gene's features below. A side panel shows the selected transcript's exon coordinates, protein translation, attributes, and sequence."
            />
          </Link>
          <figcaption className={styles.caption}>
            Editing <i>Trichuris trichiura</i> gene models alongside a related
            species in a synteny view. The side panel shows the selected
            transcript's exons, translation, attributes, and sequence.{' '}
            <Link to={mainDemoUrl} target="_blank">
              Open the demo
            </Link>
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
