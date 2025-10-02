# Configuration

In Apollo, users who are given the role of `Admin` are allowed to do more than
users with a `User` role. This includes adding new assemblies, importing
annotations from a file, and managing the roles of other users.

When Apollo is first set up, the first user who logs in is automatically given
the role of Admin. Any other users who log in after that will be given the role
set by `DEFAULT_NEW_USER_ROLE` in the
[configuration options](../installation/configuration-options).

There is also the option to have a single user, referred to as the "root user",
with an `Admin` role that is able to authenticate without logging in via OAuth.
This is meant to be used to simplify running CLI commands as an `Admin`. By
default this user is disable, but can be enabled with the `ALLOW_ROOT_USER` and
`ROOT_USER_PASSWORD` options in the
[configuration options](../installation/configuration-options).

## How to administer Apollo

There are two ways to administer Apollo. The first is through the menus in the
user interface. The top-level "Apollo" menu has a sub-menu called "Admin" that
appears for `Admin` users. These menu items include operations like adding
assemblies and importing annotations. More about using these menus to administer
Apollo 3 can be found in the [GUI section](../category/data-management-gui).

The second way of administering Apollo is by using the Apollo CLI. The CLI
provides the same options as using the GUI, but may be more useful for users who
want to automate some of the administration tasks or who want to keep a log of
what commands were run to set up Apollo.

## Basic administration

The most basic administration in Apollo is adding an assembly. This is done by
providing the sequence of the assembly in the form of a FASTA file (or in some
cases a FASTA section embedded in a GFF3). Once an assembly has been loaded, it
will be available to open in JBrowse, including both the Reference Sequence and
Annotation tracks. With only a sequence provided, though, the Annotation track
will be blank and users will have to manually add any annotations they want to
it.

Most users will also want to load an existing set of features (usually genes) to
curate in Apollo. These should be in GFF3 format. Apollo will import the GFF3
and load the features into its database. These features will then be available
in the Annotation track.

If more than one person is using Apollo, you'll likely have to also do some user
management. You won't manually add users to Apollo, instead you give them the
URL of your instance and when they log in they will get automatically added as a
user. If you want to delete a user or change a user from the default role,
though, you'll need to do so manually.

It is also likely that you'll want to add evidence tracks to reference when
annotating. This includes any type of track beyond the Reference Sequence and
Annotation tracks, and may include gene models, transcript models, coverage
plots, RNA-seq alignments, or any number of other track types.

Instructions for performing these basic administration tasks can be found in
both the GUI and CLI guides.

## Customization

There are also other ways to customize Apollo to suit your needs. Please see the
[customization](../category/customization) section for more details.
