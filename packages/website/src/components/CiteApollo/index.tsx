import Link from '@docusaurus/Link'
import CodeBlock from '@theme/CodeBlock'
import Heading from '@theme/Heading'
import React from 'react'

import styles from './styles.module.css'

interface Citation {
  /** Why to cite this paper, shown above the reference */
  label: string
  authors: string
  year: number
  title: string
  journal: string
  /** Volume, issue, and article number, e.g. "15(2), e1006790" */
  location?: string
  doi: string
  bibtex: string
}

const citations: Citation[] = [
  {
    label: 'Apollo 3 (preprint)',
    authors:
      'Stevens, G. J., Sutinen, K., Beraldi, D., Budhanuru Ramaraju, S., Diesh, C., Haese-Hill, W., Xie, P., Bridge, C., Morison, A., Leung, A., Böhme, U., Cain, S., Dunn, N., Hunt, T., Loveland, J. E., Frankish, A., Papanicolau, A., Giorgetti, S., Keatley, J., Flint, B., Stein, L., Buels, R., Berriman, M., & Holmes, I.',
    year: 2026,
    title: 'Apollo 3: Multi-Species Genome Curation.',
    journal: 'bioRxiv',
    doi: '10.64898/2026.06.08.730970',
    bibtex: `@article{Stevens_2026,
  title = {Apollo 3: Multi-Species Genome Curation},
  author = {Stevens, Garrett J and Sutinen, Kyösti and Beraldi, Dario and Budhanuru Ramaraju, Shashank and Diesh, Colin and Haese-Hill, William and Xie, Peter and Bridge, Caroline and Morison, Adrien and Leung, Angel and Böhme, Ulrike and Cain, Scott and Dunn, Nathan and Hunt, Toby and Loveland, Jane E and Frankish, Adam and Papanicolau, Alexie and Giorgetti, Stefano and Keatley, Jon and Flint, Bethany and Stein, Lincoln and Buels, Robert and Berriman, Matt and Holmes, Ian},
  journal = {bioRxiv},
  year = {2026},
  doi = {10.64898/2026.06.08.730970}
}`,
  },
  {
    label: 'Apollo',
    authors:
      'Dunn, N. A., Unni, D. R., Diesh, C., Munoz-Torres, M., Harris, N. L., Yao, E., Rasche, H., Holmes, I. H., Elsik, C. G., & Lewis, S. E.',
    year: 2019,
    title: 'Apollo: Democratizing genome annotation.',
    journal: 'PLOS Computational Biology',
    location: '15(2), e1006790',
    doi: '10.1371/journal.pcbi.1006790',
    bibtex: `@article{Dunn_2019,
  title = {Apollo: Democratizing genome annotation},
  author = {Dunn, Nathan A. and Unni, Deepak R. and Diesh, Colin and Munoz-Torres, Monica and Harris, Nomi L. and Yao, Eric and Rasche, Helena and Holmes, Ian H. and Elsik, Christine G. and Lewis, Suzanna E.},
  journal = {PLOS Computational Biology},
  volume = {15},
  number = {2},
  pages = {e1006790},
  year = {2019},
  doi = {10.1371/journal.pcbi.1006790}
}`,
  },
  {
    label: 'JBrowse 2, which Apollo is built on',
    authors:
      'Diesh, C., Stevens, G. J., Xie, P., De Jesus Martinez, T., Hershberg, E. A., Leung, A., Guo, E., Dider, S., Zhang, J., Bridge, C., Hogue, G., Duncan, A., Morgan, M., Flores, T., Bimber, B. N., Haw, R., Cain, S., Buels, R. M., Stein, L. D., & Holmes, I. H.',
    year: 2023,
    title:
      'JBrowse 2: a modular genome browser with views of synteny and structural variation.',
    journal: 'Genome Biology',
    location: '24(1), 74',
    doi: '10.1186/s13059-023-02914-z',
    bibtex: `@article{Diesh_2023,
  title = {JBrowse 2: a modular genome browser with views of synteny and structural variation},
  author = {Diesh, Colin and Stevens, Garrett J and Xie, Peter and De Jesus Martinez, Teresa and Hershberg, Elliot A. and Leung, Angel and Guo, Emma and Dider, Shihab and Zhang, Junjun and Bridge, Caroline and Hogue, Gregory and Duncan, Andrew and Morgan, Matthew and Flores, Tia and Bimber, Benjamin N. and Haw, Robin and Cain, Scott and Buels, Robert M. and Stein, Lincoln D. and Holmes, Ian H.},
  journal = {Genome Biology},
  volume = {24},
  number = {1},
  pages = {74},
  year = {2023},
  doi = {10.1186/s13059-023-02914-z}
}`,
  },
]

export default function CiteApollo(): React.JSX.Element {
  return (
    <section className={styles.section}>
      <div className="container">
        <Heading as="h2" id="cite" className="text--center">
          Cite Apollo
        </Heading>
        <p className="text--center">
          If you use Apollo in your research, please cite:
        </p>
        <div className={styles.citations}>
          {citations.map((citation) => (
            <div key={citation.doi} className={styles.citation}>
              <div className={styles.label}>{citation.label}</div>
              <p className={styles.reference}>
                {citation.authors} ({citation.year}). {citation.title}{' '}
                <i>{citation.journal}</i>
                {citation.location ? `, ${citation.location}` : ''}.{' '}
                <Link to={`https://doi.org/${citation.doi}`}>
                  https://doi.org/{citation.doi}
                </Link>
              </p>
              <details className={styles.bibtex}>
                <summary>BibTeX</summary>
                <CodeBlock language="bibtex">{citation.bibtex}</CodeBlock>
              </details>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
