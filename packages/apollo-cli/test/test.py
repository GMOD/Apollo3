#!/usr/bin/env python3

"""USAGE: Change to Apollo3/packages/apollo-cli, make this script executable:

    chmod a+x ./test/test.py

and run it:

    ./test/test.py
    ./test/test.py TestCLI.testAddAssemblyFromGff # Run only this test
"""

import json
import os
import shutil
import signal
import sys
import subprocess
import unittest


class shell:
    def __init__(self, cmd, strict=True, timeout=None):
        print(cmd)
        cmd = f"set -e; set -u; set -o pipefail\n{cmd}"
        p = subprocess.Popen(
            cmd,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            executable="/bin/bash",
        )
        try:
            stdout, stderr = p.communicate(timeout=timeout)
        except subprocess.TimeoutExpired:
            p.kill()
            sys.stderr.write(f"Error: Timeout after {timeout} seconds\n")
            stdout, stderr = p.communicate()
        self.returncode = p.returncode
        self.stdout = stdout.decode()
        self.stderr = stderr.decode()
        self.cmd = cmd
        if strict and self.returncode != 0:
            raise subprocess.SubprocessError(
                f"\nSTDOUT:\n{self.stdout}\nSTDERR:\n{self.stderr}\nEXIT CODE: {self.returncode}"
            )


apollo = "yarn dev"
P = "--profile testAdmin"


def setUpModule():
    # See apollo-collaboration-server/.development.env for credentials etc.
    shell(f"{apollo} config {P} address http://localhost:3999")
    shell(f"{apollo} config {P} accessType root")
    shell(f"{apollo} config {P} rootCredentials.username admin")
    shell(f"{apollo} config {P} rootCredentials.password pass")
    shell(f"{apollo} login {P}")


class TestCLI(unittest.TestCase):
    def setUp(self):
        sys.stderr.write("\n" + self.id().split(".")[-1] + "\n")  # Print test name

    def testPrintHelp(self):
        p = shell(f"{apollo} --help")
        self.assertTrue("COMMANDS" in p.stdout)

    def testGetConfigFile(self):
        p = shell(f"{apollo} config --get-config-file")
        self.assertTrue(p.stdout.strip().startswith("/"))

    def testApolloStatus(self):
        p = shell(f"{apollo} status {P}")
        self.assertEqual(p.stdout.strip(), "Logged in")

        shell(f"{apollo} logout {P}")
        p = shell(f"{apollo} status {P}")
        self.assertEqual(p.stdout.strip(), "Logged out")

        shell(f"{apollo} login {P}")

    def testFeatureGet(self):
        shell(f"{apollo} assembly add-gff {P} -i test_data/tiny.fasta.gff3 -a vv1 -f")
        shell(f"{apollo} assembly add-gff {P} -i test_data/tiny.fasta.gff3 -a vv2 -f")

        p = shell(f"{apollo} feature get {P} -a vv1")
        self.assertTrue("ctgA" in p.stdout)
        self.assertTrue("SomeContig" in p.stdout)

        p = shell(f"{apollo} feature get {P} -r ctgA", strict=False)
        self.assertTrue(p.returncode != 0)
        self.assertTrue("found in more than one assembly" in p.stderr)

        p = shell(f"{apollo} feature get {P} -a vv1 -r ctgA")
        out = json.loads(p.stdout)
        self.assertTrue(len(out[0]) > 2)

        p = shell(f"{apollo} feature get {P} -a vv1 -r ctgA -s 40 -e 41")
        out = json.loads(p.stdout)
        self.assertEqual(len(out[0]), 1)

        p = shell(f"{apollo} feature get {P} -a vv1 -r ctgA -s 1000 -e 1000")
        out = json.loads(p.stdout)
        self.assertEqual([[], []], out)

        p = shell(f"{apollo} feature get {P} -r FOOBAR")
        out = json.loads(p.stdout)
        self.assertEqual([[], []], out)

        p = shell(f"{apollo} feature get {P} -a FOOBAR -r ctgA", strict=False)
        self.assertTrue(p.returncode != 0)
        self.assertTrue("returned 0 assemblies" in p.stderr)

    def testAssemblyGet(self):
        shell(f"{apollo} assembly add-fasta {P} -i test_data/tiny.fasta -a vv1 -f")
        shell(f"{apollo} assembly add-fasta {P} -i test_data/tiny.fasta -a vv2 -f")
        shell(f"{apollo} assembly add-fasta {P} -i test_data/tiny.fasta -a vv3 -f")
        p = shell(f"{apollo} assembly get {P}")
        self.assertTrue("vv1" in p.stdout)
        self.assertTrue("vv2" in p.stdout)
        self.assertTrue("vv3" in p.stdout)

        p = shell(f"{apollo} assembly get {P} -a vv1 vv2")
        self.assertTrue("vv1" in p.stdout)
        self.assertTrue("vv2" in p.stdout)
        self.assertTrue("vv3" not in p.stdout)

        out = json.loads(p.stdout)
        aid = [x for x in out if x["name"] == "vv1"][0]["_id"]
        p = shell(f"{apollo} assembly get {P} -a {aid} vv2")
        self.assertTrue("vv1" in p.stdout)
        self.assertTrue("vv2" in p.stdout)
        self.assertTrue("vv3" not in p.stdout)

    def testDeleteAssembly(self):
        shell(
            f"{apollo} assembly add-gff {P} -i test_data/tiny.fasta.gff3 -a volvox1 -f"
        )
        shell(
            f"{apollo} assembly add-gff {P} -i test_data/tiny.fasta.gff3 -a volvox2 -f"
        )
        shell(
            f"{apollo} assembly add-gff {P} -i test_data/tiny.fasta.gff3 -a volvox3 -f"
        )
        p = shell(
            f"""{apollo} assembly get {P} | jq '.[] | select(.name == "volvox1") | ._id'"""
        )
        aid = p.stdout.strip()
        shell(f"{apollo} assembly delete {P} -a {aid} volvox2")
        shell(f"{apollo} assembly delete {P} -a {aid} volvox2")  # Ok
        p = shell(f"{apollo} assembly get {P}")
        self.assertTrue(f"{aid}" not in p.stdout)
        self.assertTrue("volvox1" not in p.stdout)
        self.assertTrue("volvox2" not in p.stdout)
        self.assertTrue("volvox3" in p.stdout)

    def testIdReader(self):
        shell(f"{apollo} assembly add-gff {P} -i test_data/tiny.fasta.gff3 -a v1 -f")
        shell(f"{apollo} assembly add-gff {P} -i test_data/tiny.fasta.gff3 -a v2 -f")
        shell(f"{apollo} assembly add-gff {P} -i test_data/tiny.fasta.gff3 -a v3 -f")
        p = shell(f"{apollo} assembly get {P}")
        xall = json.loads(p.stdout)

        p = shell(f"{apollo} assembly get {P} -a v1 v2")
        out = json.loads(p.stdout)
        self.assertEqual(len(out), 2)

        # This is interpreted as an assembly named 'v1 v2'
        p = shell(f"echo v1 v2 | {apollo} assembly get {P} -a -")
        out = json.loads(p.stdout)
        self.assertEqual(len(out), 0)

        # These are two assemblies
        p = shell(f"echo -e 'v1 \n v2' | {apollo} assembly get {P} -a -")
        out = json.loads(p.stdout)
        self.assertEqual(len(out), 2)

        p = shell(f"{apollo} assembly get {P} | {apollo} assembly get {P} -a -")
        out = json.loads(p.stdout)
        self.assertTrue(len(out) >= 3)

        # From json file
        shell(f"{apollo} assembly get {P} > test_data/tmp.json")
        p = shell(f"{apollo} assembly get {P} -a test_data/tmp.json")
        out = json.loads(p.stdout)
        self.assertTrue(len(out) >= 3)
        os.remove("test_data/tmp.json")

        # From text file, one name or id per line
        with open("test_data/tmp.txt", "w") as fout:
            fout.write("v1 \n v2 \r\n v3 \n")
        p = shell(f"{apollo} assembly get {P} -a test_data/tmp.txt")
        out = json.loads(p.stdout)
        self.assertEqual(len(out), 3)
        os.remove("test_data/tmp.txt")

        # From json string
        aid = xall[0]["_id"]
        j = '{"_id": "%s"}' % aid
        p = shell(f"{apollo} assembly get {P} -a '{j}'")
        out = json.loads(p.stdout)
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["_id"], aid)

        j = '[{"_id": "%s"}, {"_id": "%s"}]' % (xall[0]["_id"], xall[1]["_id"])
        p = shell(f"{apollo} assembly get {P} -a '{j}'")
        out = json.loads(p.stdout)
        self.assertEqual(len(out), 2)

        j = '{"XYZ": "%s"}' % aid
        p = shell(f"{apollo} assembly get {P} -a '{j}'")
        out = json.loads(p.stdout)
        self.assertEqual(len(out), 0)

        p = shell(f"{apollo} assembly get {P} -a '[...'")
        out = json.loads(p.stdout)
        self.assertEqual(len(out), 0)

    def testAddAssemblyFromGff(self):
        shell(
            f"{apollo} assembly add-gff {P} -i test_data/tiny.fasta.gff3 -a vv1 --omit-features -f"
        )

        ## Get id of assembly named vv1 and check there are no features
        p = shell(f"{apollo} assembly get {P} -a vv1")
        self.assertTrue("vv1" in p.stdout)
        self.assertTrue("vv2" not in p.stdout)
        asm_id = json.loads(p.stdout)[0]["_id"]

        p = shell(f"{apollo} refseq get {P}")
        refseq = json.loads(p.stdout.strip())
        vv1ref = [x for x in refseq if x["assembly"] == asm_id]
        refseq_id = [x["_id"] for x in vv1ref if x["name"] == "ctgA"][0]

        p = shell(f"{apollo} feature get {P} -r {refseq_id}")
        ff = json.loads(p.stdout)
        self.assertEqual(ff[0], [])
        self.assertEqual(ff[1], [])

        p = shell(
            f"{apollo} assembly add-gff {P} -i test_data/tiny.fasta.gff3 -a vv1",
            strict=False,
        )
        self.assertTrue(p.returncode != 0)
        self.assertTrue('Error: Assembly "vv1" already exists' in p.stderr)

        # Default assembly name
        shell(f"{apollo} assembly add-gff {P} -i test_data/tiny.fasta.gff3 -f")
        p = shell(f"{apollo} assembly get {P} -a tiny.fasta.gff3")
        self.assertTrue("tiny.fasta.gff3" in p.stdout)

    def testAddAssemblyLargeInput(self):
        with open("test_data/tmp.fa", "w") as fout:
            i = 0
            fout.write(">chr1\n")
            while i < 10000:
                fout.write("CATTGTTGCGGAGTTGAACAACGGCATTAGGAACACTTCCGTCTC\n")
                i += 1

        shell(
            f"{apollo} assembly add-fasta {P} -i test_data/tmp.fa -a test -f",
            timeout=60,
        )
        shell(
            f"{apollo} assembly add-gff {P} -i test_data/tmp.fa -a test -f",
            strict=False,
            timeout=60,
        )
        shell(
            f"{apollo} assembly add-fasta {P} -i test_data/tmp.fa -a test -f",
            timeout=60,
        )

        os.remove("test_data/tmp.fa")

    def testAddAssemblyFromLocalFasta(self):
        shell(f"{apollo} assembly add-fasta {P} -i test_data/tiny.fasta -a vv1 -f")
        p = shell(f"{apollo} assembly get {P} -a vv1")
        self.assertTrue("vv1" in p.stdout)
        p = shell(
            f"{apollo} assembly add-fasta {P} -i test_data/tiny.fasta -a vv1",
            strict=False,
        )
        self.assertTrue(p.returncode != 0)
        self.assertTrue('Error: Assembly "vv1" already exists' in p.stderr)

        p = shell(f"{apollo} assembly add-fasta {P} -i na.fa -a vv1 -f", strict=False)
        self.assertTrue(p.returncode != 0)
        self.assertTrue("does not exist" in p.stderr)

        # Test default name
        shell(f"{apollo} assembly add-fasta {P} -i test_data/tiny.fasta -f")
        p = shell(f"{apollo} assembly get {P} -a tiny.fasta")
        self.assertTrue("tiny.fasta" in p.stdout)

    def testAddAssemblyFromExternalFasta(self):
        shell(
            f"""{apollo} assembly add-fasta {P} -a vv1 -f \
                -i https://raw.githubusercontent.com/GMOD/Apollo3/main/packages/apollo-collaboration-server/test/data/volvox.fa \
                -x https://raw.githubusercontent.com/GMOD/Apollo3/main/packages/apollo-collaboration-server/test/data/volvox.fa.fai
                  """
        )
        p = shell(f"{apollo} assembly get {P} -a vv1")
        self.assertTrue("vv1" in p.stdout)

        p = shell(
            f"{apollo} assembly add-fasta {P} -a vv1 -f -i https://x.fa -x https://x.fai",
            strict=False,
        )
        self.assertTrue(p.returncode != 0)

    def testEditFeatureFromJson(self):
        shell(f"{apollo} assembly add-gff {P} -i test_data/tiny.fasta.gff3 -a vv1 -f")
        p = shell(f"{apollo} feature search {P} -a vv1 -t BAC")
        out = json.loads(p.stdout)[0]
        self.assertEqual(out["type"], "BAC")

        req = [
            {
                "typeName": "TypeChange",
                "changedIds": [out["_id"]],
                "assembly": out["refSeq"]["assembly"],
                "featureId": out["_id"],
                "oldType": "BAC",
                "newType": "G_quartet",
            }
        ]
        j = json.dumps(req)
        shell(f"echo '{j}' | {apollo} feature edit {P} -j -")
        p = shell(f"{apollo} feature search {P} -a vv1 -t G_quartet")
        out = json.loads(p.stdout)[0]
        self.assertEqual(out["type"], "G_quartet")

    def testEditFeatureType(self):
        shell(f"{apollo} assembly add-gff {P} -i test_data/tiny.fasta.gff3 -a vv1 -f")

        ## Get id of assembly named vv1
        p = shell(f"{apollo} assembly get {P} -a vv1")
        asm_id = json.loads(p.stdout)[0]["_id"]

        ## Get refseqs in assembly vv1
        p = shell(
            f"""{apollo} refseq get {P} | jq '.[] | select(.assembly == "{asm_id}" and .name == "ctgA") | ._id'"""
        )
        refseq = p.stdout.strip()

        ## Get feature in vv1
        p = shell(f"{apollo} feature get {P} -r {refseq}")
        features = json.loads(p.stdout)[0]
        self.assertTrue(len(features) > 2)

        # Get id of feature of type contig
        contig = [x for x in features if x["type"] == "contig"]
        self.assertEqual(len(contig), 1)
        contig_id = contig[0]["_id"]

        ## Edit type of "contig" feature
        p = shell(f"{apollo} feature edit-type {P} -i {contig_id} -t region")

        p = shell(
            f"""{apollo} feature get {P} -r {refseq} | jq '.[0][] | select(._id == "{contig_id}")'"""
        )
        contig = json.loads(p.stdout)
        self.assertEqual(contig["type"], "region")

        # Return current type
        p = shell(f"{apollo} feature edit-type {P} -i {contig_id}")
        self.assertEqual(p.stdout.strip(), "region")

    def testEditFeatureCoords(self):
        shell(f"{apollo} assembly add-gff {P} -i test_data/tiny.fasta.gff3 -a vv1 -f")

        ## Get id of assembly named vv1
        p = shell(f"{apollo} assembly get {P} -a vv1")
        asm_id = json.loads(p.stdout)[0]["_id"]

        ## Get refseqs in assembly vv1
        p = shell(
            f"""{apollo} refseq get {P} | jq '.[] | select(.assembly == "{asm_id}" and .name == "ctgA") | ._id'"""
        )
        refseq = p.stdout.strip()

        ## Get feature in vv1
        p = shell(f"{apollo} feature get {P} -r {refseq}")
        features = json.loads(p.stdout)[0]
        self.assertTrue(len(features) > 2)

        # Get id of feature of type contig
        contig = [x for x in features if x["type"] == "contig"]
        self.assertEqual(len(contig), 1)
        contig_id = contig[0]["_id"]

        ## Edit start and end coordinates
        shell(f"{apollo} feature edit-coords {P} -i {contig_id} -s 80 -e 160")
        shell(f"{apollo} feature edit-coords {P} -i {contig_id} -s 20 -e 100")

        p = shell(
            f"""{apollo} feature get {P} -r {refseq} | jq '.[0][] | select(._id == "{contig_id}")'"""
        )
        contig = json.loads(p.stdout)
        self.assertEqual(contig["start"], 20 - 1)
        self.assertEqual(contig["end"], 100)

        p = shell(f"{apollo} feature edit-coords {P} -i {contig_id} -s 1 -e 1")
        p = shell(
            f"""{apollo} feature get {P} -r {refseq} | jq '.[0][] | select(._id == "{contig_id}")'"""
        )
        contig = json.loads(p.stdout)
        self.assertEqual(contig["start"], 0)
        self.assertEqual(contig["end"], 1)

        p = shell(f"{apollo} feature edit-coords {P} -i {contig_id} -s 0", strict=False)
        self.assertEqual(p.returncode, 1)
        self.assertEqual("Coordinates must be greater than 0", p.stderr.strip())

        p = shell(
            f"{apollo} feature edit-coords {P} -i {contig_id} -s 10 -e 9", strict=False
        )
        self.assertEqual(p.returncode, 1)
        self.assertEqual(
            "Error: The new end coordinate is lower than the new start coordinate",
            p.stderr.strip(),
        )

        ## Edit a feature by extending beyond the boundary of its parent and
        ## check it throws a meaningful error message
        mrna = [x for x in features if x["gffId"] == "EDEN"][0]["children"]
        mrna_id = list(mrna.keys())[0]
        p = shell(f"{apollo} feature edit-coords {P} -i {mrna_id} -s 1", strict=False)
        self.assertTrue(p.returncode != 0)
        self.assertTrue("exceeds the bounds of its parent" in p.stderr)

    def testEditAttributes(self):
        shell(f"{apollo} assembly add-gff {P} -i test_data/tiny.fasta.gff3 -a vv1 -f")

        ## Get id of assembly named vv1
        p = shell(f"{apollo} assembly get {P} -a vv1")
        asm_id = json.loads(p.stdout)[0]["_id"]

        p = shell(
            f"""{apollo} refseq get {P} | jq '.[] | select(.assembly == "{asm_id}" and .name == "ctgA") | ._id'"""
        )
        refseq = p.stdout.strip()

        ## Get feature in vv1
        p = shell(
            f"""{apollo} feature get {P} -r {refseq} | jq '.[0][] | select(.type == "contig") | ._id'"""
        )
        fid = p.stdout.strip()

        ## Edit existing attribute value
        p = shell(
            f"{apollo} feature edit-attribute {P} -i {fid} -a source -v 'Eggs & Stuff'"
        )
        p = shell(f"{apollo} feature edit-attribute {P} -i {fid} -a source")
        out = json.loads(p.stdout)
        self.assertEqual(out[0], "Eggs & Stuff")

        ## Add attribute
        shell(f"{apollo} feature edit-attribute {P} -i {fid} -a newAttr -v stuff")
        p = shell(f"{apollo} feature edit-attribute {P} -i {fid} -a newAttr")
        self.assertTrue("stuff" in p.stdout)

        ## Non existing attr
        p = shell(f"{apollo} feature edit-attribute {P} -i {fid} -a NonExist")
        self.assertEqual(p.stdout.strip(), "")

        ## List of values
        p = shell(f"{apollo} feature edit-attribute {P} -i {fid} -a newAttr -v A B C")
        p = shell(f"{apollo} feature edit-attribute {P} -i {fid} -a newAttr")
        out = json.loads(p.stdout)
        self.assertEqual(out, ["A", "B", "C"])

        ## Delete attribute
        shell(f"{apollo} feature edit-attribute {P} -i {fid} -a newAttr -d")
        p = shell(f"{apollo} feature edit-attribute {P} -i {fid} -a newAttr")
        self.assertEqual(p.stdout.strip(), "")
        ## Delete again is ok
        shell(f"{apollo} feature edit-attribute {P} -i {fid} -a newAttr -d")

        ## Special fields
        p = shell(
            f"{apollo} feature edit-attribute {P} -i {fid} -a 'Gene Ontology' -v GO:0051728 GO:0019090"
        )
        p = shell(f"{apollo} feature edit-attribute {P} -i {fid} -a 'Gene Ontology'")
        out = json.loads(p.stdout)
        self.assertEqual(out, ["GO:0051728", "GO:0019090"])

        # This should fail
        p = shell(
            f"{apollo} feature edit-attribute {P} -i {fid} -a 'Gene Ontology' -v FOOBAR"
        )

    def testSearchFeatures(self):
        shell(f"{apollo} assembly add-gff {P} -i test_data/tiny.fasta.gff3 -a vv1 -f")
        shell(f"{apollo} assembly add-gff {P} -i test_data/tiny.fasta.gff3 -a vv2 -f")

        p = shell(f"{apollo} feature search {P} -a vv1 vv2 -t EDEN")
        out = json.loads(p.stdout)
        self.assertEqual(len(out), 2)
        self.assertTrue("EDEN" in p.stdout)

        p = shell(f"{apollo} feature search {P} -t EDEN")
        out = json.loads(p.stdout)
        self.assertTrue(len(out) >= 2)

        p = shell(f"{apollo} feature search {P} -a vv1 -t EDEN")
        out = json.loads(p.stdout)
        self.assertEqual(len(out), 1)
        self.assertTrue("EDEN" in p.stdout)

        p = shell(f"{apollo} feature search {P} -a foobar -t EDEN")
        self.assertEqual("[]", p.stdout.strip())
        self.assertTrue("Warning" in p.stderr)

        p = shell(f"{apollo} feature search {P} -a vv1 -t foobarspam")
        self.assertEqual("[]", p.stdout.strip())

        # It searches attributes values, not attribute names
        p = shell(f"{apollo} feature search {P} -a vv1 -t multivalue")
        self.assertEqual("[]", p.stdout.strip())

        # Search feature type
        p = shell(f"{apollo} feature search {P} -a vv1 -t contig")
        self.assertTrue('"type": "contig"' in p.stdout)

        # Search source (which in fact is an attribute)
        p = shell(f"{apollo} feature search {P} -a vv1 -t someExample")
        self.assertTrue("SomeContig" in p.stdout)

        # Case insensitive
        p = shell(f"{apollo} feature search {P} -a vv1 -t SOMEexample")
        self.assertTrue("SomeContig" in p.stdout)

        # No partial word match
        p = shell(f"{apollo} feature search {P} -a vv1 -t Fingerpri")
        self.assertEqual("[]", p.stdout.strip())

        # Match full word not necessarily full value
        p = shell(f"{apollo} feature search {P} -a vv1 -t Fingerprinted")
        self.assertTrue("Fingerprinted" in p.stdout.strip())

        # Does not search contig names (reference sequence name)
        p = shell(f"{apollo} feature search {P} -a vv1 -t ctgB")
        self.assertEqual("[]", p.stdout.strip())

        # Does not match common words (?) ...
        p = shell(f"{apollo} feature search {P} -a vv1 -t with")
        self.assertEqual("[]", p.stdout.strip())

        # ...But "fake" is ok
        p = shell(f"{apollo} feature search {P} -a vv1 -t fake")
        self.assertTrue("FakeSNP1" in p.stdout.strip())

        # ...or a single unusual letter
        p = shell(f"{apollo} feature search {P} -a vv1 -t Q")
        self.assertTrue('"Q"' in p.stdout.strip())

    def testDeleteFeatures(self):
        shell(f"{apollo} assembly add-gff {P} -i test_data/tiny.fasta.gff3 -a vv1 -f")
        p = shell(f"{apollo} feature search {P} -a vv1 -t EDEN")
        fid = json.loads(p.stdout)[0]["_id"]

        p = shell(f"{apollo} feature delete {P} -i {fid} --dry-run")
        self.assertTrue(fid in p.stdout)

        shell(f"{apollo} feature delete {P} -i {fid}")
        p = shell(f"{apollo} feature search {P} -a vv1 -t EDEN")
        self.assertEqual(p.stdout.strip(), "[]")

        p = shell(f"{apollo} feature delete {P} -i {fid}", strict=False)
        self.assertEqual(p.returncode, 1)
        self.assertTrue("The following featureId was not found in database" in p.stderr)

        p = shell(f"{apollo} feature delete {P} --force -i {fid}")
        self.assertEqual(p.returncode, 0)

    def testAddChildFeatures(self):
        shell(f"{apollo} assembly add-gff {P} -i test_data/tiny.fasta.gff3 -a vv1 -f")
        p = shell(f"{apollo} feature search {P} -a vv1 -t contig")
        fid = json.loads(p.stdout)[0]["_id"]

        shell(f"{apollo} feature add-child {P} -i {fid} -s 10 -e 20 -t contig_read")
        p = shell(f"{apollo} feature search {P} -a vv1 -t contig_read")
        self.assertTrue("contig_read" in p.stdout)
        self.assertTrue('"start": 9' in p.stdout)
        self.assertTrue('"end": 20' in p.stdout)

        p = shell(
            f"{apollo} feature add-child {P} -i {fid} -s 10 -e 2000 -t contig_read",
            strict=False,
        )
        self.assertTrue(p.returncode != 0)
        self.assertTrue("Child feature coordinates" in p.stderr)

        # Should this fail?
        p = shell(
            f"{apollo} feature add-child {P} -i {fid} -s 10 -e 20 -t FOOBAR",
            strict=False,
        )
        self.assertEqual(p.returncode, 0)

    def testImportFeatures(self):
        shell(f"{apollo} assembly add-fasta {P} -i test_data/tiny.fasta -a vv1 -f")
        shell(f"{apollo} feature import {P} -i test_data/tiny.fasta.gff3 -a vv1")
        p = shell(f"{apollo} feature search {P} -a vv1 -t contig")
        out = json.loads(p.stdout)
        self.assertEqual(len(out), 2)

        # Import again: Add to existing feature
        p = shell(f"{apollo} feature import {P} -i test_data/tiny.fasta.gff3 -a vv1")
        p = shell(f"{apollo} feature search {P} -a vv1 -t contig")
        out = json.loads(p.stdout)
        self.assertEqual(len(out), 4)

        # Import again: delete {P} existing
        p = shell(f"{apollo} feature import {P} -d -i test_data/tiny.fasta.gff3 -a vv1")
        p = shell(f"{apollo} feature search {P} -a vv1 -t contig")
        out = json.loads(p.stdout)
        self.assertEqual(len(out), 2)

        p = shell(f"{apollo} assembly delete {P} -a vv2")
        p = shell(
            f"{apollo} feature import {P} -i test_data/tiny.fasta.gff3 -a vv2",
            strict=False,
        )
        self.assertTrue(p.returncode != 0)
        self.assertTrue('Assembly "vv2" does not exist' in p.stderr)

        p = shell(f"{apollo} feature import {P} -i foo.gff3 -a vv1", strict=False)
        self.assertTrue(p.returncode != 0)
        self.assertTrue('File "foo.gff3" does not exist' in p.stderr)

    def testCopyFeature(self):
        shell(
            f"{apollo} assembly add-gff {P} -i test_data/tiny.fasta.gff3 -a source -f"
        )
        shell(f"{apollo} assembly add-fasta {P} -i test_data/tiny.fasta -a dest -f")
        shell(f"{apollo} assembly add-fasta {P} -i test_data/tiny.fasta -a dest2 -f")
        p = shell(f"{apollo} feature search {P} -a source -t contig")
        fid = json.loads(p.stdout)[0]["_id"]

        shell(f"{apollo} feature copy {P} -i {fid} -r ctgA -a dest -s 1")
        p = shell(f"{apollo} feature search {P} -a dest -t contig")
        out = json.loads(p.stdout)[0]
        self.assertEqual(out["start"], 0)
        self.assertEqual(out["end"], 50)

        # RefSeq id does not need assembly
        p = shell(f"{apollo} refseq get {P} -a dest2")
        destRefSeq = [x["_id"] for x in json.loads(p.stdout) if x["name"] == "ctgA"][0]
        p = shell(f"{apollo} feature copy {P} -i {fid} -r {destRefSeq} -s 2")

        p = shell(f"{apollo} feature search {P} -a dest2 -t contig")
        out = json.loads(p.stdout)[0]
        self.assertEqual(out["start"], 1)
        self.assertEqual(out["end"], 51)

        # Copy to same assembly
        shell(f"{apollo} feature copy {P} -i {fid} -r ctgA -a source -s 10")
        p = shell(f"{apollo} feature search {P} -a source -t contig")
        out = json.loads(p.stdout)

        # Copy non-existant feature or refseq
        p = shell(
            f"{apollo} feature copy {P} -i FOOBAR -r ctgA -a dest -s 1", strict=False
        )
        self.assertTrue(p.returncode != 0)
        self.assertTrue("ERROR" in p.stderr)

        p = shell(
            f"{apollo} feature copy {P} -i {fid} -r FOOBAR -a dest -s 1", strict=False
        )
        self.assertTrue(p.returncode != 0)
        self.assertTrue("No reference" in p.stderr)

        # Ambiguous refseq
        p = shell(f"{apollo} feature copy {P} -i {fid} -r ctgA -s 1", strict=False)
        self.assertTrue(p.returncode != 0)
        self.assertTrue("more than one" in p.stderr)

    def testGetChanges(self):
        shell(
            f"{apollo} assembly add-fasta {P} -i test_data/tiny.fasta -a myAssembly -f"
        )
        shell(
            f"{apollo} assembly add-fasta {P} -i test_data/tiny.fasta -a yourAssembly -f"
        )
        shell(
            f"{apollo} assembly add-fasta {P} -i test_data/tiny.fasta -a ourAssembly -f"
        )

        p = shell(f"{apollo} change get {P}")
        json.loads(p.stdout)
        self.assertTrue("myAssembly" in p.stdout)
        self.assertTrue("yourAssembly" in p.stdout)

        p = shell(f"{apollo} change get {P} -a myAssembly ourAssembly")
        self.assertTrue("myAssembly" in p.stdout)
        self.assertTrue("ourAssembly" in p.stdout)
        self.assertTrue("yourAssembly" not in p.stdout)

        # Delete assemblies and get changes by assembly name: Nothing is
        # returned because the assemblies collection doesn't contain that name
        # anymore. Ideally you should still be able to get changes by name?
        shell(f"{apollo} assembly delete {P} -a myAssembly yourAssembly ourAssembly")
        p = shell(f"{apollo} change get {P} -a myAssembly")
        out = json.loads(p.stdout)
        self.assertEqual(len(out), 0)

    def testGetSequence(self):
        shell(f"{apollo} assembly add-fasta {P} -i test_data/tiny.fasta -a v1 -f")
        shell(f"{apollo} assembly add-fasta {P} -i test_data/tiny.fasta -a v2 -f")

        p = shell(f"{apollo} assembly sequence {P} -a nonExistant", strict=False)
        self.assertTrue(p.returncode != 0)
        self.assertTrue("returned 0 assemblies" in p.stderr)

        p = shell(f"{apollo} assembly sequence {P} -a v1 -s 0", strict=False)
        self.assertTrue(p.returncode != 0)
        self.assertTrue("must be greater than 0" in p.stderr)

        p = shell(f"{apollo} assembly sequence {P} -a v1")
        seq = p.stdout.strip().split("\n")
        self.assertEqual(len(seq), 18)
        self.assertEqual(seq[0], ">ctgA:1..420")
        self.assertEqual(
            seq[1],
            "cattgttgcggagttgaacaACGGCATTAGGAACACTTCCGTCTCtcacttttatacgattatgattggttctttagcct",
        )
        self.assertEqual(seq[6], "ttggtcgctccgttgtaccc")
        self.assertEqual(seq[7], ">ctgB:1..800")
        self.assertEqual(
            seq[-1],
            "CTCGACATGCATCATCAGCCTGATGCTGATACATGCTAGCTACGTGCATGCTCGACATGCATCATCAGCCTGATGCTGAT",
        )

        p = shell(f"{apollo} assembly sequence {P} -a v1 -r ctgB -s 1 -e 1")
        seq = p.stdout.split("\n")
        self.assertEqual(seq[0], ">ctgB:1..1")
        self.assertEqual(seq[1], "A")

        p = shell(f"{apollo} assembly sequence {P} -a v1 -r ctgB -s 2 -e 4")
        seq = p.stdout.split("\n")
        self.assertEqual(seq[0], ">ctgB:2..4")
        self.assertEqual(seq[1], "CAT")

        p = shell(f"{apollo} assembly sequence {P} -r ctgB", strict=False)
        self.assertTrue(p.returncode != 0)
        self.assertTrue("found in more than one" in p.stderr)

    def testGetFeatureById(self):
        shell(f"{apollo} assembly add-gff {P} -i test_data/tiny.fasta.gff3 -a v1 -f")
        p = shell(f"{apollo} feature get {P} -a v1")
        ff = json.loads(p.stdout)

        x1 = ff[0][0]["_id"]
        x2 = ff[0][1]["_id"]
        p = shell(f"{apollo} feature get-id {P} -i {x1} {x1} {x2}")
        out = json.loads(p.stdout)
        self.assertEqual(len(out), 2)
        self.assertEqual(out[0]["_id"], x1)
        self.assertEqual(out[1]["_id"], x2)

        p = shell(f"{apollo} feature get-id {P} -i FOOBAR")
        self.assertEqual(p.stdout.strip(), "[]")

        p = shell(f"echo -e '{x1} \n {x2}' | {apollo} feature get-id {P}")
        out = json.loads(p.stdout)
        self.assertEqual(len(out), 2)


if __name__ == "__main__":
    unittest.main()
