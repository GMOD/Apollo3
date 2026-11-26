import Link from '@docusaurus/Link'
import Heading from '@theme/Heading'
import React from 'react'

import styles from './styles.module.css'

export default function Funding(): React.JSX.Element {
  return (
    <section className={styles.section}>
      <div className="container">
        <Heading as="h2" className="text--center">
          Funding
        </Heading>
        <p className={styles.text}>
          Apollo is funded by the National Institute of General Medical Sciences
          of the U.S. National Institutes of Health (
          <Link to="https://reporter.nih.gov/project-details/11394475">
            R01GM080203
          </Link>
          ). Earlier development was also supported by a joint award from the
          U.S. National Science Foundation (
          <Link to="https://www.nsf.gov/awardsearch/show-award/?AWD_ID=2031120">
            2031120
          </Link>
          ) and the UK Biotechnology and Biological Sciences Research Council (
          <Link to="https://gtr.ukri.org/find-research-and-innovation/project/7ea4b6c9-fd2d-4660-889b-8f082b11dd2f">
            BB/T016299/1
          </Link>
          ).
        </p>
      </div>
    </section>
  )
}
