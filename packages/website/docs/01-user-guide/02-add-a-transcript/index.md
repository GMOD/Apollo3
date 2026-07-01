# Add a transcript

Add a transcript from a JBrowse evidence gene track.

:::tip

Every page in this guide has a "Try it out" button. This will take you to a page
where you can try out the steps for yourself. Any annotations you create or edit
are local and not shared, so no need to worry about affecting the annotations
anyone else using this guide sees.

:::

<a href="/demo//?assembly=Onchocerca%20volvulus&loc=OVOC_OM2:23836500-23840000&tracks=onchocerca_volvulus.PRJEB513.WBPS19.genomic-ReferenceSequenceTrack,apollo_track_Onchocerca%20volvulus,onchocerca_volvulus.PRJEB513.WBPS19.annotations.genes.sorted.gff3&tracklist=true&apolloFeatures=H4sIAAAAAAAAA63WQW-bMBgG4L8yfWc0ge3YwG3tpJ22VOu0HqIIOeZLainY1JiuU8R_n4CtC6sCo-WE4LX1PjJgOMHaqHur0Cn57tEeH-tjXUG6OUGmc0iBS4qS0USEPMFVuIsFl5zTCAJwuL_FB0hh_X19na0_EwjA_ywRUjigQQig0AZSQmPKeUQCKORTf5pwGgZQeSdNDmkUgLrXx9yhgfR0oZEkbTZmIsm4qfj65cPCpmjSNLFO-GTNiIlzngxM0nund7XHqm0-7PdZZWunENIN3FlXXMkKYds0wSUPmRSTmWLB2bk4ZmRZMZ0U03nimPHwTBzzcLWsmE2K2UyxYOJcHLNwWfFqUryaKU4IP3-3wqWfCj4p5vPECRmKKY2WFYtJsZgpZiIa27_eLI4nxfG4-Prj7ZwN9__AQZe0qk1bkLa1gpJI_omMLLopg6B0mGvltTVZ5aXvPnFw01_EvB3xw7qixLKfeRMxkYh2dZrXuL45aSrldOn_8t5HF4F9tCTgExpM767aQxgSxiIa_tv-Mq3woUaj8AWwDXfa9nd1A6WzHrXJlM21OXQzbebRFc8ThyOy7m9gG4Cqnf7dfQEnj1pWw-qm2Ta_AFRAoM6lCAAA"
className="button button--primary button--lg" target="\_blank">Try
it out</a>

---

Here we see an Apollo annotation that has a single transcript, with a JBrowse
evidence track that shows a second transcript. To add the second transcript to
the Apollo annotation, start by right-clicking on the gene in the JBrowse track
and selecting "Create Apollo annotation."

![JBrowse gene context menu](jbrowse_gene_context_menu.png)

In the dialog that appears, uncheck the gene and the first mRNA, since we only
want to copy the second transcript. Make sure the gene in the destination
feature drop-down box is the one to which we want to copy the transcript. Also
make sure to not check the "Create new gene" box, since we're targeting an
existing gene. Then click "Create."

![Create annotation menu](create_annotation_menu.png)

The transcript has now been added and is ready for any additional editing with
Apollo.

![Transcript has been added](transcript_added.png)
