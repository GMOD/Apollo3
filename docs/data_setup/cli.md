<!-- vim-markdown-toc GFM -->

* [Setup a user profile](#setup-a-user-profile)
* [Features shared across most commands](#features-shared-across-most-commands)
* [Add, delete, view assemblies](#add-delete-view-assemblies)
* [Import and delete features](#import-and-delete-features)

<!-- vim-markdown-toc -->

These instructions describe how to add data such assemblies and features to an
Apollo instance using the command line
interface ([cli](https://github.com/GMOD/Apollo3/tree/cli-misc/packages/apollo-cli)).

# Setup a user profile

This is a one-time setup to enable a user to connect to Apollo. The following
command will start a guided, interactive process to setup a new user profile:

```
apollo config
```

Alternatively, for non-interactive setup use key/value pairs. For example,
setup a profile called `my-profile`:

```
apollo config --profile my-profile address http://localhost:3999
apollo config --profile my-profile accessType google
```

Or to setup a root profile named admin, non-interactively:

```
apollo config --profile admin address http://localhost:3999
apollo config --profile admin accessType root
apollo config --profile admin rootCredentials.username myName
apollo config --profile admin rootCredentials.password myPassword
```

Once the profile is setup, login to store the access token:

```
apollo login --profile my-profile
```

*TO FIX/TO DOCUMENT:* If you login from within the host machine, you will get a
`Error: listen EADDRINUSE: address already in use :::3000`

# Features shared across most commands

* The default profile is `default`. If you setup a profile with a different
  name, remember to add the option `--profile my-profile` to your commands.

* For commands that take as input an assembly or a reference sequence, you can
  use the human readable name (e.g. `Homo_sapiens`, `chr1`, possibly
  non-unique) or the 24 letter unique identifier assigned by Apollo.

* Commands that query the database print results to standard output in json
  format (you can parse it with *e.g.*, [jq](https://jqlang.github.io/jq/))

# Add, delete, view assemblies

With one of the following commands we add an assembly and assign a name with
`-a/--assembly`. If an assembly with the same name already exists, the commands
will exit with an error unless you set `--force/-f` which will delete the
existing assembly before importing.

* **Add** from a local fasta file:

```
apollo assembly add-fasta -i genome.fa -a myGenome
```

* **Add** from an external source:

```
apollo assembly add-fasta -a myGenome \
    -i https://path/to/genome.fa \
    -x https://path/to/genome.fa.fai
```

* **Add** from a GFF file which includes sequences (remove flag `--omit-features`
  if you want to add sequences *and* features):

```
apollo assembly add-gff -i genome.gff -a myGenome --omit-features 
```

* **Delete** one or more assemblies:

```
apollo assembly delete -a assembly1 assembly2
```

* **View** list of assemblies:

```
apollo assembly get
```

# Import and delete features

Import features from a gff file into assembly `myGenome`:

```
apollo feature import -i annotation.gff -a myGenome
```

By default, `import` adds features to the current assembly. To delete the
existing features before importing, use flag `-d/--delete-existing`.

To delete features:

```
apollo feature delete -i featureA featureB ...
```

where `featureA`, `featureB` are feature identifiers (since these are unique
there is no need to specify assembly or reference sequence).
