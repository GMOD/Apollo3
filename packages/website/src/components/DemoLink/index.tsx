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
                to="/demo//?assembly=Trichuris%20trichiura&loc=TTRE_chr2:17483000-17490000&tracks=Trichuris%20trichiura-ReferenceSequenceTrack,apollo_track_Trichuris%20trichiura&tracklist=true&apolloFeatures=H4sIAAAAAAAAA-2ZQWvbMBiG_0rQaQN3sz5Jlu1b1-7QSyltYYesBMeSE0EsZ7IDLSX_fTiF4nSLvojWgcFOSWzz-n1sKfKDn8m9M-Vy40w76fpvZuMKkk-fycwokpOk4CIT1TwGqHTMKsZ1POdMkog4Xd3pXyQn9_e332fl0gGJSPe01iQnC201iUhtLMmp5ClngkekLh5ffqacpRFpO1dYRXIakXJpVsppS_LnA6cE3u_zlQKOlKpvr8_9pWRgKSqxUhS7UvqxsZ5SXDC6V6roOmfmm063_akXVTVrm40rNcmn5Efj6m9Fq2emXjeu04o8RLtD-oLT3anyvgJQgFlHv1DysN1Gh5qnKFsayiakHLJJGI8NvGwZypaFssk0HrKlMhmNjXnZCpStCGXL-hv1yiZiIUdj4162Oco2D2QTNNljAz4em_CylShbGcrG4uF_ieBJOhpb4mVTKJsKZJNMDO-blPF480162TTKpkPZpGBDtozHo7GlXrYKZatC2bJsyJZSYKOxZT42iNEHijiQLaUy9T1QfOjaHXvhKApHEbiLy7v9tZsO17eUMfgotlK1Q7Sea_uuwL5VWzqz7vZzX46xRb0LebPL2KrpN9e6WzYqv7KddjeumRRlqdvWNDa_urmNKbCMT5R-ie-3nq-UXj4pPdl9uGahbdHqyfX55aebz2dKr7VV2naTnxZJFiKLj0lWTV0Yi-clNKF_zfu6NG1nlLHN6k30MZlwRMdocn3WaVcbW6yOCmVHhV68hvrGPkuwsc-SUFPgXLxTXwQ6IUXoU9l-qRFNAfymAOgFB-yC46Yw1ioBflMA1PAg2PBOZgrgNwVADQ-CDe9kpgB-UwDU8CDU8E5nCuA3BUAND0IN73SmAH5TANTwINTwTmcK4DcFQA0PQg3vdKYAflMA1PAg2PBOZgqAmAJqeBBqeH-awnjzDTEFVPEAU7w3piCohJOYAoxkCnDYFOC_KfyDpvC-MdK_y3gdHYeGRr99bpqXGTEla9d02thZ2ShjF32Hh-1v1kFi2GsZAAA"
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
