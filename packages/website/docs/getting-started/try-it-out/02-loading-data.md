# Loading data

Open a new terminal in the same directory where you ran the setup commands. To
use the Apollo CLI, we need to configure it with the information for the running
Apollo installation. You can have multiple profiles configured, but we will use
a single default profile. Run these commands:

```sh
apollo config address http://localhost/apollo
apollo config accessType root
apollo config rootCredentials.username root
apollo config rootCredentials.password password
apollo login
```

If you need to log in again, run `apollo logout` first, or use
`apollo login --force`.

The next step is to add an assembly. We're going to use use trimmed-down
assembly that only includes a single chromosome. This is so that the data is
small enough to be self-contained inside this repository, without the need for
any external data.

We are going to use a FASTA file that has been prepared with `bgzip` and
`samtools` to be compressed and indexed. The organism this assembly belongs to
is Schistosoma mansoni. Run this command to add the assembly:

```sh
apollo assembly \
  add-from-fasta \
  ./data/Schistosoma/mansoni/SM_V10_3/smansoni_SM_v10_3.fa.gz \
  --fai ./data/Schistosoma/mansoni/SM_V10_3/smansoni_SM_v10_3.fa.gz.fai \
  --gzi ./data/Schistosoma/mansoni/SM_V10_3/smansoni_SM_v10_3.fa.gz.gzi \
  --assembly 'Schistosoma mansoni'
```

Now that we have an assembly, lets add the annotations we want to curate. They
are stored in a GFF3 file. Run this command to import the annotations:

```sh
apollo feature \
  import \
  ./data/Schistosoma/mansoni/SM_V10_3/smansoni_SM_v10_3_subset.gff3 \
  --assembly 'Schistosoma mansoni'
```

Next we're going to add a second assembly and set of annotations. This assembly
is from the related species Schistosoma haematobium. Run these two commands to
add the assembly and annotations:

```sh
apollo assembly \
  add-from-fasta \
  ./data/Schistosoma/haematobium/CHR_3/shaematobium_CHR_3.fa.gz \
  --fai ./data/Schistosoma/haematobium/CHR_3/shaematobium_CHR_3.fa.gz.fai \
  --gzi ./data/Schistosoma/haematobium/CHR_3/shaematobium_CHR_3.fa.gz.gzi \
  --assembly 'Schistosoma haematobium'

apollo feature \
  import \
  ./data/Schistosoma/haematobium/CHR_3/shaematobium_CHR_3_subset.gff3 \
  --assembly 'Schistosoma haematobium'
```

Apollo is now set up to be able to annotate these genomes. In order to help with
the annotation, though, it's often useful to include evidence tracks. Apollo is
built on top of JBrowse 2, so we'll add these evidence tracks to the underlying
JBrowse configuration. The first thing we need to do is get the IDs of the
assemblies, since we'll need to pass these to JBrowse instead of the Apollo
internal name. You can see the IDs in the output of the assembly adding commands
above, but we'll run the following commands to demonstrate another way to get
them:

```sh
MANSONI_ID=$(
  apollo assembly get |
    jq --raw-output '.[] | select(.name=="Schistosoma mansoni")._id'
)
HAEMATOBIUM_ID=$(
  apollo assembly get |
    jq --raw-output '.[] | select(.name=="Schistosoma haematobium")._id'
)
```

In order to make the evidence track data available to JBrowse, the
`jbrowse_data/` is visible inside our running application as a directory called
`data/` that is visible to JBrowse. Inside this directory, we have an RNA-seq
file in CRAM format for each of the assemblies, as well as a file that shows
synteny relationships between the two assemblies. This particular file was
generated with `tblastx`.

The first step is to get the JBrowse configuration stored in Apollo so we can
update it. Run these commands:

```sh
cd jbrowse_data/
apollo jbrowse get-config >config.json
```

Now that we have the configuration, we can use the `jbrowse` CLI tool to add the
evidence tracks. We are using the `inPlace` value for the `--load` flag because
we know how these files are going to be visible in to JBrowse, and we don't want
the CLI to try and copy or alter any files.

```sh
jbrowse add-track \
  data/smansoni_SM_v10_3_subset.cram \
  --load inPlace \
  --name "S. mansoni RNA-seq" \
  --assemblyNames "${MANSONI_ID}"
jbrowse add-track \
  data/shaematobium_CHR_3_subset.cram \
  --load inPlace \
  --name "S. haematobium RNA-seq" \
  --assemblyNames "${HAEMATOBIUM_ID}"
jbrowse add-track \
  data/shaematobium_vs_smansoni.paf \
  --load inPlace \
  --name "S. haematobium vs. S. mansoni TBLASTX" \
  --assemblyNames "${HAEMATOBIUM_ID}","${MANSONI_ID}"
```

Now the last step is to send the updated JBrowse config back to Apollo.

```sh
apollo jbrowse set-config config.json
rm config.json
```
