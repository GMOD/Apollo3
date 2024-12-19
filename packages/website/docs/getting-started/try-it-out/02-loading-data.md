# Loading data

## Setting up the Apollo and JBrowse CLI

Both Apollo and JBrowse have CLI tools that you can use to load data. The
recommended way to install both these tools is through a Node.js package manager
(such as `npm` or `yarn`). See
[the next section](#installing-cli-tools-with-npm-or-yarn) for those
installation instructions.

If you would rather use Docker to run the CLI tools, it is possible to do so
with a bit more setup. See
[this section](#setting-up-docker-to-run-the-cli-tools) for those instructions.

### Installing CLI tools with `npm` or `yarn`

Use the following to install the Apollo and JBrowse CLI tools.

```bash npm2yarn
npm install -g @apollo-annotation/cli @jbrowse/cli
```

You can test that those commands work by running `apollo --version` and
`jbrowse --version` in your terminal. The output should look something like
this:

```sh-session
$ apollo --version
@apollo-annotation/cli/0.3.0 linux-x64 node-v18.20.4
$ jbrowse --version
@jbrowse/cli/2.18.0 linux-x64 node-v18.20.4
```

If that worked, you can move on to
[configuring the Apollo CLI](#configuring-the-apollo-cli).

### Setting up Docker to run the CLI tools

Apollo provides a Docker image of its CLI. In order to configure the Apollo CLI
in the Docker container, though, you'll need to create a config file for it
first. For this guide, we'll create an empty file called `config.yml` in a new
directory.

```sh
mkdir cli
touch cli/config.yml
```

Now we'll create a function that wraps the Docker commands that we need to run
to avoid having to re-type them. Run the following in your terminal:

```sh
function apollo() {
  docker \
    run \
    --rm \
    --interactive \
    --add-host host.docker.internal=host-gateway \
    --volume ./cli:/root/.config/apollo-cli \
    --volume ./data:/data \
    ghcr.io/gmod/apollo-cli \
    "$@"
}
```

Now run `apollo --version` in your terminal. You should see something like this
output:

```sh-session
$ apollo --version
@apollo-annotation/cli/0.3.0 linux-x64 node-v18.20.4
```

JBrowse does not provide a Docker image for its CLI, so we'll have to create
one. Create a file called jbrowse.Dockerfile and paste the following contents
into it:

```Dockerfile title="jbrowse.Dockerfile"
FROM node:18-alpine
RUN mkdir data && yarn global add @jbrowse/cli
ENTRYPOINT ["jbrowse"]
```

Now run this command:

```
docker build --tag jbrowse-cli --file jbrowse.Dockerfile .
```

When that is done, we'll create a wrapper function like we did for the Apollo
CLI.

```sh
function jbrowse() {
  docker \
    run \
    --rm \
    --interactive \
    --volume ./data:/data \
    jbrowse-cli \
    "$@"
}
```

After pasting that into your terminal, run `jbrowse --version` and check that
the output looks something like this:

```sh-session
$ jbrowse --version
@jbrowse/cli/2.18.0 linux-x64 node-v18.20.4
```

## Configuring the Apollo CLI

Open a new terminal in the same directory where you ran the setup commands. To
use the Apollo CLI, we need to configure it with the information for the running
Apollo installation. You can have multiple profiles configured, but we will use
a single default profile. Run these commands:

```sh
apollo config address http://localhost/apollo
# If you are using Docker to run the Apollo CLI, then instead you need to do:
# apollo config address http://host.docker.internal/apollo
apollo config accessType root
apollo config rootPassword password
apollo login
```

If you need to log in again, run `apollo logout` first, or use
`apollo login --force`.

## Adding assemblies and annotations

The next step is to add an assembly. We're going to use trimmed-down assembly
that only includes a single chromosome. This is so that the data is small enough
to be self-contained inside this repository, without the need for any external
data.

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

Now that we have an assembly, let's add the annotations we want to curate. They
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

## Adding evidence tracks

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
apollo jbrowse get-config > data/config.json
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
  --assemblyNames "${MANSONI_ID}" \
  --out data/config.json
jbrowse add-track \
  data/shaematobium_CHR_3_subset.cram \
  --load inPlace \
  --name "S. haematobium RNA-seq" \
  --assemblyNames "${HAEMATOBIUM_ID}" \
  --out data/config.json
jbrowse add-track \
  data/shaematobium_vs_smansoni.paf \
  --load inPlace \
  --name "S. haematobium vs. S. mansoni TBLASTX" \
  --assemblyNames "${HAEMATOBIUM_ID}","${MANSONI_ID}" \
  --out data/config.json
```

Now the last step is to send the updated JBrowse config back to Apollo.

```sh
apollo jbrowse set-config data/config.json
rm data/config.json
```
