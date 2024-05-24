#!/usr/bin/env python3

import argparse
import json
import os
import re
import subprocess
import sys

parser = argparse.ArgumentParser(
    description="""Prepare and push source code for new tag release. See code for details. Steps are:

* `yarn version` to update non-private packages to <tag> 

* `git add` all (and only) the package.json files from previous step

* `git commit`

* `git tag` to tag and annotate the current commit

* `git push` commits and tag
""",
    formatter_class=argparse.RawTextHelpFormatter,
)

parser.add_argument(
    "--tag",
    "-t",
    required=True,
    help="Version for this tag, e.g. v1.2.3",
)
parser.add_argument(
    "--message",
    "-m",
    required=False,
    default=None,
    help="Commit message [Tag release <tag>]",
)
parser.add_argument(
    "--root-dir",
    "-r",
    default=".",
    help="Root directory of Apollo source code [%(default)s]",
)
parser.add_argument("--version", "-v", action="version", version="%(prog)s 0.1.0")


class shell:
    def __init__(self, cmd, verbose=True):
        cmd = f"set -e; set -u; set -o pipefail\n{cmd}"
        if verbose:
            print(cmd)
        p = subprocess.Popen(
            cmd,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            executable="/bin/bash",
        )
        stdout, stderr = p.communicate()
        self.returncode = p.returncode
        self.stdout = stdout.decode()
        self.stderr = stderr.decode()
        self.cmd = cmd
        if self.returncode != 0:
            raise subprocess.SubprocessError(
                f"\nSTDOUT:\n{self.stdout}\nSTDERR:\n{self.stderr}\nEXIT CODE: {self.returncode}"
            )


def get_packages():
    p = shell(f"yarn workspaces list --json --no-private")
    packages = []
    for line in p.stdout.strip().split("\n"):
        j = json.loads(line)
        pack = os.path.join(j["location"], "package.json")
        if not os.path.isfile(pack):
            sys.stderr.write(f"Error: Expected file '{pack}' does not exist\n")
            sys.exit(1)
        packages.append(pack)
    return packages


def check_tag(newtag):
    if re.match("v[0-9]+.[0-9]+.[0-9]+.*", newtag) is None:
        # This pattern should match the workflow triggering the publication but note
        # that workflows don't use regex
        sys.stderr.write(f"Invalid tag format for '{newtag}'\n")
        sys.exit(1)

    p = shell("git tag")
    git_tags = p.stdout.split("\n")
    for t in git_tags:
        if t == newtag or t == re.sub("^v", "", newtag):
            sys.stderr.write(
                f"Git already has tag '{t}'. Remove this tag or choose a different one.\n"
            )
            sys.exit(1)


if __name__ == "__main__":
    args = parser.parse_args()

    os.chdir(args.root_dir)

    m = args.message
    if m is None:
        m = f"Tag release {args.tag}"
    if "'" in m:
        sys.stderr.write("Error: Single quotes in commit message are not allowed yet\n")
        sys.exit(1)

    check_tag(args.tag)

    p = shell(f"yarn workspaces foreach --no-private --all version {args.tag}")
    sys.stderr.write(p.stderr + "\n")

    packages = " ".join(get_packages())
    p = shell(f"git add --force {packages}")

    p = shell(f"git commit --message '{m}' -- {packages}")
    sys.stderr.write(p.stderr + "\n")
    print(p.stdout)
    p = shell(f"git tag -a {args.tag} -m '{m}'")
    sys.stderr.write(p.stderr + "\n")
    print(p.stdout)
    p = shell(f"git push --follow-tags")
    sys.stderr.write(p.stderr + "\n")
    print(p.stdout)
