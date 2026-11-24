// Links into the hosted Apollo demo. The views come from a JBrowse session spec
// (https://jbrowse.org/jb2/docs/urlparams/). The apolloFeatures parameter
// preloads annotations into the demo's local (unshared) annotation store.

/**
 * Trichuris muris and T. trichiura in a synteny view, with WormBase gene models
 * copied into Apollo, plus a six-frame view of the T. trichiura region
 */
const mainDemoSessionSpec = {
  views: [
    {
      type: 'LinearSyntenyView',
      tracks: [['t_muris_q_trichiura.tblastx.tsv']],
      views: [
        {
          loc: 'TMUE_LG2:14945696-14951483[rev]',
          assembly: 'Trichuris muris',
          tracks: [
            'Trichuris muris-ReferenceSequenceTrack',
            'apollo_track_Trichuris muris',
          ],
        },
        {
          loc: 'TTRE_chr2:4400026-4405813',
          assembly: 'Trichuris trichiura',
          tracks: [
            'Trichuris trichiura-ReferenceSequenceTrack',
            'apollo_track_Trichuris trichiura',
            'trichuris_trichiura.PRJEB535.WBPS19.annotations.genes.sorted.gff3',
          ],
        },
      ],
    },
    {
      type: 'LinearGenomeView',
      assembly: 'Trichuris trichiura',
      loc: 'TTRE_chr2:4401525-4404418',
      tracks: [
        {
          trackId: 'apollo_track_Trichuris trichiura',
          displaySnapshot: { type: 'LinearApolloSixFrameDisplay' },
        },
      ],
    },
  ],
}

/**
 * Gzipped, URL-safe base64 JSON of the gene models (see
 * handleApolloFeaturesUrlParam in jbrowse-plugin-apollo): WBGene00287252 in
 * T. muris, and TTRE1113 and TTRE6225 in T. trichiura
 */
const mainDemoApolloFeatures =
  'H4sIAAAAAAAAA-2YXU_jOBSG_0rk63Q3_oid5I6BWWakHYQ6jEZaFlUhccCaxuk46c4g1P--Sgo0wamNIV3NxXIBpTk9fh_b56v34EKJ7HatRO2V7W-QXN6DhchBAuh1QK4LRgikKYY0YGGWBWHOgQ8ULz7z7yABF5--vF_8eYqAD5q7FQcJuOGytSiFBAkkMaFxTH1Qpj-7f8MAk9gHdaNSmYME-iC7FctccQmS-30r0vaZURM1ayrnZ0cTa0JWTcisif-spIumtGmUuF43vG5XvimKRV2tVcZBcgm-Vqp8l9YcXG02_j492KoYmxUfn3zuC2YoxDvBJEIofIVgv3vSqrpsF0i6ZVHQ_tAoih8NZFp2Hxx5vFI8F1kjKrmom7RZ152rShZClTxvLX5Uqlzx1fbz58nFp_MgJiRud2vzGp0XKpV1psSqeS73N2gRvDUwCNp7fLn1-HK3IGCQwuGFY65BwKyamFsQDDWRKKRs2iCIrIojN8URRcy0i29WHFsVx_-H7VvDFtnCFh1C0CmXPPn6rv0TBChiKNR06E9r_n3NZcZNe3stqu3hX4KVqhou5CKrciFvOgfVouGqfPr80GLR1e8rH2RrJR4k7NGYLkVajyrYbK78XmPRtK_EWqVac5HR4V3mw-biYv5-kd2qPd0FIQGkGD1cZkKCCDFbHdcW1NLqiIVZUj-vTiEpL2yS8sIiqZ-kNEkwCrBzxC9EuapUsw3M3Q1uF0paARBCvGhgW952uUzbysC62YEjWczIjgzBlvNAZMhIBq1k0I2M4ijakVESHu7MsJFMa3RHLNzIQti7jZTC4GBkxEimNcQjFm5klNIeGWPurcBLyUIjGbGSEUeyCOMeWRQf7syokSy0koWOZDHpZRAWBIc7M2Yk04bcEQsnMhb0cyPD6HAZJDKSaVPCiIUbGaZxjyxkh8v6sZFMmyZGLNzIKOxlfcao-3cAL67UgRFNGztGLNzQIoQNfdGkaOYuJLWipRa03kjVtVdRj4zF7Qg7DVmW130wh0Fjj8OmNwL1_T4bfqZcsu3Ynxbbt5JlaNls_OGJ5eHwxApbk_5sbkAo7mUQCtte6_HIZqNduraiVolGLJwGh7dr4trkMGLhFLRDTQSFwVDTFFFLEQoXDRq2odpmaqPDiIUTGunas0e0cNCsTY2GjGja7DBi4YQWRoiZbtKUaNCIpg0PIxYuqRZh0p-KIJ2O7DHXPoBNnmuf_OoZsPdIyKJq3y55c1vlyUfZcHWuKi_NMl7XopLJx_N5EMCIRV7Ot-7bd_8SMvMKIW-48r3j4w_Hs3b_vL-l2RHEMMADR3P-D1c193bq05r73vzsaJbzFZc5l413cnbkrarlXclVWttXQSGGZLDKSVWmQnpV4a3lN1n9kF6xlt2Xgd7Jlz8IgvELnDI0dHp6dDpbKT4TsuE3nbB8u4zNFaYRC1-ynfV6xVWRlmJ5Z3VKcBigIfTZ0e_z4c71HBrjKLPGUeZWbAgk-I0FUBtYRizcMvJAE6H9PmratAUtxUabWEYsHIsNJP9NsYGWYqONLCMWv2ixgZZio40sIxYuxYag_gB9wGIzfWP_5HdfsYEuxSaMhon242OC9b0sbdLlXSMyL6uUvRJMV7gQxmxYuMR1JdfZkrd59cNsKb655etfv0jh2ETsBPuaijfhKNjewX130zoKXm3-BRgNagm1IgAA'

// encodeURIComponent rather than URLSearchParams, which encodes spaces as "+"
function buildUrl(path: string, params: Record<string, string>) {
  const query = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&')
  return `${path}?${query}`
}

// The pathname:// prefix stops Docusaurus from treating /demo/ as one of its
// own pages and removing the trailing slash (the site uses trailingSlash:
// false). The server redirects /demo to /demo/ but drops the query string.
export const mainDemoUrl = buildUrl('pathname:///demo/', {
  session: `spec-${JSON.stringify(mainDemoSessionSpec)}`,
  sessionName: 'Apollo demo',
  apolloFeatures: mainDemoApolloFeatures,
})

// Demos for the use cases in the 2026 Apollo 3 paper, served from
// /paper_2026/. The demos page links to these with plain <a> tags, so they
// don't need the pathname:// prefix.

/** Three-way synteny between Trichuris muris, T. suis, and T. trichiura */
const multiGenomeCurationSessionSpec = {
  views: [
    {
      type: 'LinearSyntenyView',
      tracks: [
        ['t_muris_q_suis.tblastx.tsv'],
        ['t_suis_q_trichiura.tblastx.tsv'],
      ],
      views: [
        {
          loc: 'TMUE_LG2:26024044-26029767',
          assembly: 'Trichuris muris',
          tracks: ['apollo_track_Trichuris muris'],
        },
        {
          loc: 'T_suis-1.0_Cont18:290293-296016',
          assembly: 'Trichuris suis',
          tracks: ['apollo_track_Trichuris suis'],
        },
        {
          loc: 'TTRE_chr2:22209825-22215548[rev]',
          assembly: 'Trichuris trichiura',
          tracks: ['apollo_track_Trichuris trichiura', 'TTRE_all_isoseq.chr2'],
        },
      ],
    },
  ],
}

/** Gene models for the multi-genome curation demo */
const multiGenomeCurationApolloFeatures =
  'H4sIAAAAAAAAA7WWXW-bMBSG_8p0rlkF_gCbu7WderNO1ZppF1GEHGNaS8FQY7RWFf99crKu0CSQtBkXQdE59nle6_g9PMPMannfWt18Kv0vpPNnyHQOKcSCUJ6TuODFklBcRCSMCMkZBGBVcaseIIXZ9c-v2bcrBAG4p1pBCnfKKAig1AZSFIeIMEwDKMXj5i_HLAmgcVaYHNIoAHmvV7lVBtLnfRUTHxtlSsaZyh_fv5yYCU0yoXEm9ViZESbCGB4wCeesXrZONb7yXVFkTdVaqSCdw6_KlueiUbDoumAfD54kxscRM5qQHjGL4xMTk0liciRxgqI-McPotMR0kpgeR8wRD8c69cPE8SRxPE58cXl7zNU6DDhYRzzV3BdI12VR6J8kDqOXBCPK9cId4dqqXEunK5M1TrjWGxvcCOu0WK2eMlmZQttS5T73d2XLWtWbnW7S2fVNyBDF_ty69xDPrDCNtLp2b8HPptA3CacGulJGpb_O_SsMESc0wW85tqONemiVkWrslJe62rTBHGpbOaVNJqtcm7v1BlXmlC3_rR9mZOtBsQhAtlb_RdjDKFZaNDsJum4R9CZY0-4YYBzFBCEsl7EUcYSVXA4aOvOLPkdnYXZRGRexPZOMk4Sjl8bmlDI2MTG2yoq3N21HxmFgg3H2cbAtC9iRcRjYwL2GYIRxfrQRZLqsK-s2t_S1nX2Z9JJHLAspD-lZ1He4Lfitr4cdGe-Sxyl-PfcwJv9LHhqVxyblsXfJo8R30r62OqE8PCqPT8rjB8rrD6qJS_MBdTJveuKOcOw9-7nXWdLfdmjepyzoXe_AUqP-33WL7g_MAqoBXgwAAA'

/** Human gene LRRC42 with long-read RNA-seq and other evidence tracks */
const deepEvidenceTracks = [
  'apollo_track_Homo sapiens',
  'ont-Crg-CapTrap_HpreCap_0+_Brain03Rep1',
  'pacBioSII-Cshl-CapTrap_HpreCap_0+_Brain03Rep1',
  'recount3_havana_annot.bed',
  'ctssTotalCounts.fwd',
  'atlas.clusters.2.0.GRCh38.96_sorted.bed',
  'multitrack-1747301946690',
  'gwipsvizRiboseq',
  'appris_method.proteo',
]

/** Gene models for the deep evidence demo */
const deepEvidenceApolloFeatures =
  'H4sIAAAAAAAAA-WaW2-jOBiG_0rk68zI50P2atRWMxeratXsXVVFgJ0UbQIZoFWrqv99BWkSQjHGCclIM5cc2u_zY4zf9yVv4Ee6Skd5sI5NkoPJ_RuYxRpMAA8oC-CcE8nFHHKCiEJzZhQYg8zMp-YnmAAExqB4XRswAQuTGDAGqzgBE0YU5ZDSMVgFL9Uhl4jLMciLLEg0mKAxiB7jpc5MAiZvllIhKa91NRMSSzOru9tvh80IftAMhJ7NBMzVTMAszZiXNLE3Qzmj6qCZoCiyOHwqTF6WXMznszx9yiIDJvfgMXgOkgA8jKvzSbCqzt7cTm8ghBBRKDCT5eUoTfIiLp6K-Lm6BZYnTZKbVbicmUTP1o9BXl35guqXmqdf0qQadGuRLEj-Ky9Vtz6bLI_TpDwm4OH9fWzjxJ0keU-SQkhRIykkRkORJEoxgs9Mcl9kSxI3SKJOksJJUvQjyZCSbE-SYSrwQCShEFgQ5EcS-4Gs1diCJF4gpROk7AlSIiprICWWcFCQcAiQuJMjrHOkXhyVk6Nt-2hw5JCw2gPJIRV0SI5Y-XFsX9mdHDclthyZF8fAyTHoyRFDQmocMcKDLmzsudnAVo6d6xofbDXci2Po5Bj25YhV_XnEFA61aW8GyYfgCDs58jpH4cUxcnKMenLkhxw5Gez9SJhETHlu2e3r2saxVmLLUXpx1E6OuidHwTntUrQnSB9MlIKez6NF-liVz77GFqRqgOSdII0TpLGAvLqeHgofpWochSLHruvNCK-up5Ob2-k_1bJjSEpWrbR1lhYmrmFo3tB8hN79S5dN51EWr4uyg383Cx8Rxmlzqv--u7ui-AvezEAYpxs297s2o1THyaJ6BCKdf4zs6nrKJPtazWkRLMpzC5NEqTazMMjjqDq_62E_1GYnfVdL6Jzk0DbJn_2fpAeqjGFfM0qdzdDe_q_eDOUIDbZ0KWOQ0XP7v10Rm__rnlankw57O2laF9vDOulykOf2f_siR_m_0Omkw95OWnJUd9JKDuakq0F6-r_jSB5vAEOnkw7_WCft9852OunwaCfNhgJZPS3U07n4OcBaiaMcYOh00qHNSXcKnFMwtggcwiFFqkPg7G84k8AhAhEurQIHOwWOXbHs_3XtnvxpvU6zYrY0z2bZ9p5hXdOqncZe24z9J0lDyok8JV-PnPoqsumrTxvxQTN-G_F2TbkCWUY5FecOZHdFjoq2o7mT6PwC20g_or9oO_FSOBo61wu8QDDrA_TSAa2XztHIyRNdIKD14HnxoNZL7mjs5IkvENT68Lx0YOsle7Tzk6-2ffIdMrD14Xnp4NYrANfO1EL3TC1OCm778fw1Aa5XEK6d2YXumV18DnAb-u10nhSW7xTP_cgzyK3VOCoR184IQ9sijAGD3HaebX4HSSRZl9_Z3VAjQHv4na4WWn0PUhgTq-9Bgwa7493xOotXQfbqME673rqMU1NZy67nxDhfZMb2ImsxTuJAuHgbJ-38rKh7flZsNDNogikEQmfP3fZFjsqCtfPDou75YfE3TDD9nJLz06Lu-Wnx90sw_SySMxXRPVORP_u3QNqZheieWchnq-khlVwvScgEHkRyWpPgfYmjLJFxRiDGFoF0K6QTMLYpI6k-wlKbMtrdcKYkmFKqpLAqInpCErz_112CpnVaT5B95S-qy-F9r3pAqMwE2ofnHJo2m6Y_OluapyhOzCiLo8dRZtYmKEZRmhRBnMTJYkTx6H5atTj58f32ajR9XYXp8q9vUVQdT7AUCj9UrZjE7GE1G12mizjatXo41Fn1p4_pKp1tf3reoCdKfA_v_wNgzDUjoC4AAA'

/** Gene models for the single local genome demo */
const singleLocalGenomeApolloFeatures =
  'H4sIAAAAAAAAA83XQW-bMBQH8K8yvTOabOzYwG3tpJ22VOu0HqII2cZJLQVDDXSdIr77RLJ1YRV4JBxyQvBsvZ8w_lvsYWnVY6G0U-Ldc7F7bnZNBclqD6nJIAEm6EJgHquIS4IIUTGOEJIEAnB6c6-fIIHl9-VtuvwcQgD1z1JDAlttNQSQGwtJSCLCGA4DyMXL8TZmBAVQ1U7YDBIcgHo0u8xpC8l-oKOQXW3MJOS4Kf_65cPMJuI1ed6TfinsiIkxFvdMoq6dkU2tq67zdrNJq6JxSkOygofC5Tei0rBu22DIQ71iOlHMGT0VRzScV7zwihfTxBFl6EQcMbSYV8y8YjZRzCk_FUcUzSvmXjGfKI5Ddrq30NxfReQVR9PEcdgXE4LnFcdecTxRTDkey6-LxcIrFuPi24_3UwL3_8DBodKpVl2DpGvLSYjFn5IV-WFKr1A6nRlVm8KmVS3qwxEHd8eHOutG_ChcXuryOPMOUx7z7u2057i-OWEr5UxZ_-W9x4PAY2kAMLQ8MvQtjwynHYgR5ZceiMr7yaipYd0zzR_WmVecXVlYa69YX1lYb7zizXWFtUTevYWuK6wl9orxpLD2hcFlYS2HslCeG9bxnGEth8NaDoX1-YBP2urk4aa7IBRSign6t_vbaqWfGm2VfgPsitIUx1VdQemKWhubqiIzdnuYWaS1dvnrxP6I9PDrtg5ANc787j2AEzsjqn7rtl23vwAIm4j2Ug4AAA'

export const paperDemoUrls = {
  multiGenomeCuration: buildUrl('/paper_2026/', {
    session: `spec-${JSON.stringify(multiGenomeCurationSessionSpec)}`,
    apolloFeatures: multiGenomeCurationApolloFeatures,
  }),
  deepEvidence: buildUrl('/paper_2026/', {
    assembly: 'Homo sapiens',
    loc: '1:53943568-53968567',
    tracks: deepEvidenceTracks.join(','),
    apolloFeatures: deepEvidenceApolloFeatures,
  }),
  // Single local genome: Onchocerca volvulus in standard and six-frame
  // displays, loaded from a shared session
  singleLocalGenome: buildUrl('/paper_2026/', {
    session: 'share-JosvRDO2S7',
    password: 'ViCZj',
    apolloFeatures: singleLocalGenomeApolloFeatures,
  }),
}
