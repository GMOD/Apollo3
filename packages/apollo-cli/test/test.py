#!/usr/bin/env python3

"""USAGE: Change to Apollo3/packages/apollo-cli, make this script executable:

    chmod a+x ./test/test.py

and run it:

    ./test/test.py
    ./test/test.py TestCLI.testAddAssemblyFromGff # Run only this test
"""

import hashlib
import json
import os
import sys
import unittest
from utils import shell


apollo = "yarn dev"
P = "--profile testAdmin"


def setUpModule():
    # See apollo-collaboration-server/.development.env for credentials etc.
    shell(f"{apollo} config {P} address http://localhost:3999")
    shell(f"{apollo} config {P} accessType root")
    shell(f"{apollo} config {P} rootCredentials.username admin")
    shell(f"{apollo} config {P} rootCredentials.password pass")
    shell(f"{apollo} login {P} -f")


class TestCLI(unittest.TestCase):
    def setUp(self):
        sys.stderr.write("\n" + self.id().split(".")[-1] + "\n")  # Print test name

    def testPrintHelp(self):
        p = shell(f"{apollo} --help")
        self.assertTrue("COMMANDS" in p.stdout)

    def testGetConfigFile(self):
        p = shell(f"{apollo} config --get-config-file")
        self.assertTrue(p.stdout.strip().startswith("/"))

    def testConfigInvalidKeys(self):
        p = shell(f"{apollo} config {P} address spam", strict=False)
        self.assertEqual(1, p.returncode)
        self.assertTrue("Invalid setting:" in p.stderr)

        p = shell(f"{apollo} config {P} ADDRESS http://localhost:3999", strict=False)
        self.assertEqual(1, p.returncode)
        self.assertTrue("Invalid setting:" in p.stderr)

        p = shell(f"{apollo} config {P} accessType spam", strict=False)
        self.assertEqual(1, p.returncode)
        self.assertTrue("Invalid setting:" in p.stderr)

    def testCanChangeAccessType(self):
        p = shell(f"{apollo} config {P} accessType google")
        p = shell(f"{apollo} config {P} rootCredentials.username")
        self.assertEqual("", p.stdout.strip())

    def testApolloStatus(self):
        p = shell(f"{apollo} status {P}")
        self.assertEqual(p.stdout.strip(), "testAdmin: Logged in")

        shell(f"{apollo} logout {P}")
        p = shell(f"{apollo} status {P}")
        self.assertEqual(p.stdout.strip(), "testAdmin: Logged out")

        shell(f"{apollo} login {P}")

    def testFeatureGet(self):
        shell(f"{apollo} assembly add-from-gff {P} -i test_data/tiny.fasta.gff3 -a vv1 -f")
        shell(f"{apollo} assembly add-from-gff {P} -i test_data/tiny.fasta.gff3 -a vv2 -f")

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
        self.assertEqual(len(out), 1)

        p = shell(f"{apollo} feature get {P} -a vv1 -r ctgA -s 1000 -e 1000")
        out = json.loads(p.stdout)
        self.assertEqual([], out)

        p = shell(f"{apollo} feature get {P} -r FOOBAR")
        out = json.loads(p.stdout)
        self.assertEqual([], out)

        p = shell(f"{apollo} feature get {P} -a FOOBAR -r ctgA", strict=False)
        self.assertTrue(p.returncode != 0)
        self.assertTrue("returned 0 assemblies" in p.stderr)

    def testAssemblyGet(self):
        shell(f"{apollo} assembly add-from-fasta {P} test_data/tiny.fasta -a vv1 -f")
        shell(f"{apollo} assembly add-from-fasta {P} test_data/tiny.fasta -a vv2 -f")
        shell(f"{apollo} assembly add-from-fasta {P} test_data/tiny.fasta -a vv3 -f")
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
            f"{apollo} assembly add-from-gff {P} -i test_data/tiny.fasta.gff3 -a volvox1 -f"
        )
        shell(
            f"{apollo} assembly add-from-gff {P} -i test_data/tiny.fasta.gff3 -a volvox2 -f"
        )
        shell(
            f"{apollo} assembly add-from-gff {P} -i test_data/tiny.fasta.gff3 -a volvox3 -f"
        )
        p = shell(
            f"""{apollo} assembly get {P} | jq '.[] | select(.name == "volvox1") | ._id'"""
        )
        aid = p.stdout.strip()

        p = shell(f"{apollo} assembly delete {P} -v -a {aid} volvox2 volvox2")
        out = json.loads(p.stdout)
        self.assertEqual(len(out), 2)
        self.assertTrue("2 " in p.stderr)

        shell(f"{apollo} assembly delete {P} -a {aid} volvox2")  # Ok
        p = shell(f"{apollo} assembly get {P}")
        self.assertTrue(f"{aid}" not in p.stdout)
        self.assertTrue("volvox1" not in p.stdout)
        self.assertTrue("volvox2" not in p.stdout)
        self.assertTrue("volvox3" in p.stdout)

    def testIdReader(self):
        shell(f"{apollo} assembly add-from-gff {P} -i test_data/tiny.fasta.gff3 -a v1 -f")
        shell(f"{apollo} assembly add-from-gff {P} -i test_data/tiny.fasta.gff3 -a v2 -f")
        shell(f"{apollo} assembly add-from-gff {P} -i test_data/tiny.fasta.gff3 -a v3 -f")
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
        p = shell(
            f"{apollo} assembly add-from-gff {P} -i test_data/tiny.fasta.gff3 -a vv1 --omit-features -f"
        )
        out = json.loads(p.stdout)
        self.assertTrue("fileId" in out.keys())

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
        self.assertEqual(ff, [])

        p = shell(
            f"{apollo} assembly add-from-gff {P} -i test_data/tiny.fasta.gff3 -a vv1",
            strict=False,
        )
        self.assertTrue(p.returncode != 0)
        self.assertTrue('Error: Assembly "vv1" already exists' in p.stderr)

        # Default assembly name
        shell(f"{apollo} assembly add-from-gff {P} -i test_data/tiny.fasta.gff3 -f")
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
            f"{apollo} assembly add-from-fasta {P} test_data/tmp.fa -a test -f",
            timeout=60,
        )
        shell(
            f"{apollo} assembly add-from-gff {P} -i test_data/tmp.fa -a test -f",
            strict=False,
            timeout=60,
        )
        shell(
            f"{apollo} assembly add-from-fasta {P} test_data/tmp.fa -a test -f",
            timeout=60,
        )

        os.remove("test_data/tmp.fa")

    def testAddAssemblyFromLocalFasta(self):
        p = shell(f"{apollo} assembly add-from-fasta {P} test_data/tiny.fasta -a vv1 -f")
        out = json.loads(p.stdout)
        self.assertTrue("fileId" in out.keys())

        p = shell(f"{apollo} assembly get {P} -a vv1")
        self.assertTrue("vv1" in p.stdout)
        p = shell(
            f"{apollo} assembly add-from-fasta {P} test_data/tiny.fasta -a vv1",
            strict=False,
        )
        self.assertTrue(p.returncode != 0)
        self.assertTrue('Error: Assembly "vv1" already exists' in p.stderr)

        p = shell(f"{apollo} assembly add-from-fasta {P} na.fa -a vv1 -f", strict=False)
        self.assertTrue(p.returncode != 0)
        self.assertTrue("does not exist" in p.stderr)

        # Test default name
        shell(f"{apollo} assembly add-from-fasta {P} test_data/tiny.fasta -f")
        p = shell(f"{apollo} assembly get {P} -a tiny.fasta")
        self.assertTrue("tiny.fasta" in p.stdout)

    def testAddAssemblyFromExternalFasta(self):
        p = shell(
            f"""{apollo} assembly add-from-fasta {P} -a vv1 -f \
                https://raw.githubusercontent.com/GMOD/Apollo3/main/packages/apollo-collaboration-server/test/data/volvox.fa \
                -x https://raw.githubusercontent.com/GMOD/Apollo3/main/packages/apollo-collaboration-server/test/data/volvox.fa.fai
                  """
        )
        out = json.loads(p.stdout)
        self.assertTrue("fileId" not in out.keys())

        p = shell(f"{apollo} assembly get {P} -a vv1")
        self.assertTrue("vv1" in p.stdout)

        p = shell(
            f"{apollo} assembly add-from-fasta {P} -a vv1 -f https://x.fa -x https://x.fai",
            strict=False,
        )
        self.assertTrue(p.returncode != 0)

    def testEditFeatureFromJson(self):
        shell(f"{apollo} assembly add-from-gff {P} -i test_data/tiny.fasta.gff3 -a vv1 -f")
        p = shell(f"{apollo} feature search {P} -a vv1 -t BAC")
        out = json.loads(p.stdout)[0]
        self.assertEqual(out["type"], "BAC")

        p = shell(f"{apollo} assembly get {P} -a vv1")
        asm_id = json.loads(p.stdout)[0]["_id"]

        req = [
            {
                "typeName": "TypeChange",
                "changedIds": [out["_id"]],
                "assembly": asm_id,
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
        shell(f"{apollo} assembly add-from-gff {P} -i test_data/tiny.fasta.gff3 -a vv1 -f")

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
        features = json.loads(p.stdout)
        self.assertTrue(len(features) > 2)

        # Get id of feature of type contig
        contig = [x for x in features if x["type"] == "contig"]
        self.assertEqual(len(contig), 1)
        contig_id = contig[0]["_id"]

        ## Edit type of "contig" feature
        p = shell(f"{apollo} feature edit-type {P} -i {contig_id} -t region")

        p = shell(
            f"""{apollo} feature get {P} -r {refseq} | jq '.[] | select(._id == "{contig_id}")'"""
        )
        contig = json.loads(p.stdout)
        self.assertEqual(contig["type"], "region")

        # Return current type
        p = shell(f"{apollo} feature edit-type {P} -i {contig_id}")
        self.assertEqual(p.stdout.strip(), "region")

    def testEditFeatureCoords(self):
        shell(f"{apollo} assembly add-from-gff {P} -i test_data/tiny.fasta.gff3 -a vv1 -f")

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
        features = json.loads(p.stdout)
        self.assertTrue(len(features) > 2)

        # Get id of feature of type contig
        contig = [x for x in features if x["type"] == "contig"]
        self.assertEqual(len(contig), 1)
        contig_id = contig[0]["_id"]

        ## Edit start and end coordinates
        shell(f"{apollo} feature edit-coords {P} -i {contig_id} -s 80 -e 160")
        shell(f"{apollo} feature edit-coords {P} -i {contig_id} -s 20 -e 100")

        p = shell(
            f"""{apollo} feature get {P} -r {refseq} | jq '.[] | select(._id == "{contig_id}")'"""
        )
        contig = json.loads(p.stdout)
        self.assertEqual(contig["min"], 20 - 1)
        self.assertEqual(contig["max"], 100)

        p = shell(f"{apollo} feature edit-coords {P} -i {contig_id} -s 1 -e 1")
        p = shell(
            f"""{apollo} feature get {P} -r {refseq} | jq '.[] | select(._id == "{contig_id}")'"""
        )
        contig = json.loads(p.stdout)
        self.assertEqual(contig["min"], 0)
        self.assertEqual(contig["max"], 1)

        p = shell(f"{apollo} feature edit-coords {P} -i {contig_id} -s 0", strict=False)
        self.assertEqual(2, p.returncode)
        self.assertTrue("Coordinates must be greater than 0" in p.stderr.strip())

        p = shell(
            f"{apollo} feature edit-coords {P} -i {contig_id} -s 10 -e 9", strict=False
        )
        self.assertEqual(2, p.returncode)
        self.assertTrue(
            "Error: The new end coordinate is lower than the new start coordinate"
            in p.stderr.strip(),
        )

        ## Edit a feature by extending beyond the boundary of its parent and
        ## check it throws a meaningful error message
        eden_gene = None
        for x in features:
            if x["type"] == "gene" and x["attributes"]["gff_name"] == ["EDEN"]:
                eden_gene = x
        self.assertTrue(eden_gene is not None)
        mrna = eden_gene["children"]
        mrna_id = list(mrna.keys())[0]
        p = shell(f"{apollo} feature edit-coords {P} -i {mrna_id} -s 1", strict=False)
        self.assertTrue(p.returncode != 0)
        self.assertTrue("exceeds the bounds of its parent" in p.stderr)

    def testEditAttributes(self):
        shell(f"{apollo} assembly add-from-gff {P} -i test_data/tiny.fasta.gff3 -a vv1 -f")

        ## Get id of assembly named vv1
        p = shell(f"{apollo} assembly get {P} -a vv1")
        asm_id = json.loads(p.stdout)[0]["_id"]

        p = shell(
            f"""{apollo} refseq get {P} | jq '.[] | select(.assembly == "{asm_id}" and .name == "ctgA") | ._id'"""
        )
        refseq = p.stdout.strip()

        ## Get feature in vv1
        p = shell(
            f"""{apollo} feature get {P} -r {refseq} | jq '.[] | select(.type == "contig") | ._id'"""
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
        shell(f"{apollo} assembly add-from-gff {P} -i test_data/tiny.fasta.gff3 -a vv1 -f")
        shell(f"{apollo} assembly add-from-gff {P} -i test_data/tiny.fasta.gff3 -a vv2 -f")

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
        shell(f"{apollo} assembly add-from-gff {P} -i test_data/tiny.fasta.gff3 -a vv1 -f")
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
        shell(f"{apollo} assembly add-from-gff {P} -i test_data/tiny.fasta.gff3 -a vv1 -f")
        p = shell(f"{apollo} feature search {P} -a vv1 -t contig")
        fid = json.loads(p.stdout)[0]["_id"]

        shell(f"{apollo} feature add-child {P} -i {fid} -s 10 -e 20 -t contig_read")
        p = shell(f"{apollo} feature search {P} -a vv1 -t contig_read")
        self.assertTrue("contig_read" in p.stdout)
        self.assertTrue('"min": 9' in p.stdout)
        self.assertTrue('"max": 20' in p.stdout)

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
        shell(f"{apollo} assembly add-from-fasta {P} test_data/tiny.fasta -a vv1 -f")
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
            f"{apollo} assembly add-from-gff {P} -i test_data/tiny.fasta.gff3 -a source -f"
        )
        shell(f"{apollo} assembly add-from-fasta {P} test_data/tiny.fasta -a dest -f")
        shell(f"{apollo} assembly add-from-fasta {P} test_data/tiny.fasta -a dest2 -f")
        p = shell(f"{apollo} feature search {P} -a source -t contig")
        fid = json.loads(p.stdout)[0]["_id"]

        shell(f"{apollo} feature copy {P} -i {fid} -r ctgA -a dest -s 1")
        p = shell(f"{apollo} feature search {P} -a dest -t contig")
        out = json.loads(p.stdout)[0]
        self.assertEqual(out["min"], 0)
        self.assertEqual(out["max"], 50)

        # RefSeq id does not need assembly
        p = shell(f"{apollo} refseq get {P} -a dest2")
        destRefSeq = [x["_id"] for x in json.loads(p.stdout) if x["name"] == "ctgA"][0]
        p = shell(f"{apollo} feature copy {P} -i {fid} -r {destRefSeq} -s 2")

        p = shell(f"{apollo} feature search {P} -a dest2 -t contig")
        out = json.loads(p.stdout)[0]
        self.assertEqual(out["min"], 1)
        self.assertEqual(out["max"], 51)

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
            f"{apollo} assembly add-from-fasta {P} test_data/tiny.fasta -a myAssembly -f"
        )
        shell(
            f"{apollo} assembly add-from-fasta {P} test_data/tiny.fasta -a yourAssembly -f"
        )
        shell(
            f"{apollo} assembly add-from-fasta {P} test_data/tiny.fasta -a ourAssembly -f"
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
        shell(f"{apollo} assembly add-from-fasta {P} test_data/tiny.fasta -a v1 -f")
        shell(f"{apollo} assembly add-from-fasta {P} test_data/tiny.fasta -a v2 -f")

        p = shell(f"{apollo} assembly sequence {P} -a nonExistant", strict=False)
        self.assertTrue(p.returncode != 0)
        self.assertTrue("returned 0 assemblies" in p.stderr)

        p = shell(f"{apollo} assembly sequence {P} -a v1 -s 0", strict=False)
        self.assertTrue(p.returncode != 0)
        self.assertTrue("must be greater than 0" in p.stderr)

        p = shell(f"{apollo} assembly sequence {P} -a v1")
        seq = p.stdout.strip().split("\n")
        self.assertEqual(len(seq), 25)
        self.assertEqual(seq[0], ">ctgA:1..420")
        self.assertEqual(
            seq[1],
            "cattgttgcggagttgaacaACGGCATTAGGAACACTTCCGTCTCtcacttttatacgattatgattggttctttagcct",
        )
        self.assertEqual(seq[6], "ttggtcgctccgttgtaccc")
        self.assertEqual(seq[7], ">ctgB:1..800")
        self.assertEqual(
            seq[-1],
            "ttggtcgctccgttgtaccc",
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
        shell(f"{apollo} assembly add-from-gff {P} -i test_data/tiny.fasta.gff3 -a v1 -f")
        p = shell(f"{apollo} feature get {P} -a v1")
        ff = json.loads(p.stdout)

        x1 = ff[0]["_id"]
        x2 = ff[1]["_id"]
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

    def testAssemblyChecks(self):
        ## TODO: Improve tests once more checks exist (currently there is only
        ## CDSCheck)
        shell(f"{apollo} assembly add-from-gff {P} -i test_data/tiny.fasta.gff3 -a v1 -f")

        # Test view available check type
        p = shell(f"{apollo} assembly check {P}")
        out = json.loads(p.stdout)
        self.assertTrue("CDSCheck" in p.stdout)
        cdsCheckId = [x for x in out if x["name"] == "CDSCheck"][0]["_id"]

        # Test view checks set for assembly
        p = shell(f"{apollo} assembly check {P} -a v1")
        self.assertEqual(p.stdout.strip(), "[]")

        # Test non-existant assembly
        p = shell(f"{apollo} assembly check {P} -a non-existant", strict=False)
        self.assertEqual(p.returncode, 1)
        self.assertTrue("non-existant" in p.stderr)

        # Test non-existant check
        p = shell(f"{apollo} assembly check {P} -a v1 -c not-a-check", strict=False)
        self.assertEqual(p.returncode, 1)
        self.assertTrue("not-a-check" in p.stderr)

        # Test add checks. Test check is added as opposed to replacing current
        # checks with input list
        shell(f"{apollo} assembly check {P} -a v1 -c CDSCheck CDSCheck")
        p = shell(f"{apollo} assembly check {P} -a v1")
        out = json.loads(p.stdout)
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["name"], "CDSCheck")

        # Works also with check id
        shell(f"{apollo} assembly add-from-gff {P} -i test_data/tiny.fasta.gff3 -a v2 -f")
        shell(f"{apollo} assembly check {P} -a v2 -c {cdsCheckId}")
        p = shell(f"{apollo} assembly check {P} -a v2")
        out = json.loads(p.stdout)
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["name"], "CDSCheck")

        # Delete check
        shell(f"{apollo} assembly check {P} -a v1 -d -c CDSCheck")
        p = shell(f"{apollo} assembly check {P} -a v1")
        out = json.loads(p.stdout)
        self.assertEqual(p.stdout.strip(), "[]")

    def testFeatureChecks(self):
        shell(f"{apollo} assembly add-from-gff {P} -i test_data/tiny.fasta.gff3 -a v1 -f")
        shell(f"{apollo} assembly check {P} -a v1 -c CDSCheck")
        p = shell(f"{apollo} feature check {P} -a v1")
        ## If we don't edit a feature, checks are not activated (!?)
        self.assertEqual(p.stdout.strip(), "[]")

        p = shell(f"{apollo} feature get {P} -a v1")
        ff = json.loads(p.stdout)
        g1 = [
            x
            for x in ff
            if x["type"] == "gene" and x["attributes"]["gff_id"] == ["MyGene"]
        ][0]
        g2 = [
            x
            for x in ff
            if x["type"] == "gene" and x["attributes"]["gff_id"] == ["AnotherGene"]
        ][0]

        shell(f"{apollo} feature edit-coords {P} -i {g1['_id']} -e 201")
        shell(f"{apollo} feature edit-coords {P} -i {g2['_id']} -e 251")
        p = shell(f"{apollo} feature check {P} -a v1")
        out = json.loads(p.stdout)
        self.assertTrue(len(out) > 1)
        self.assertTrue("InternalStopCodonCheck" in p.stdout)

        ## Ids with checks
        ids = []
        for x in out:
            ids.extend(x["ids"])
        self.assertTrue(len(set(ids)) > 1)

        ## Retrieve by feature id
        xid = " ".join(ids)
        p = shell(f"{apollo} feature check {P} -i {xid}")
        self.assertTrue("InternalStopCodonCheck" in p.stdout)

    def testFeatureChecksIndexed(self):
        shell(
            f"{apollo} assembly add-from-fasta {P} -a v1 test_data/tiny.fasta.gz --no-db -f"
        )
        shell(f"{apollo} feature import {P} -a v1 -i test_data/tiny.fasta.gff3 -d")
        # shell(f"{apollo} assembly add-from-gff {P} -i test_data/tiny.fasta.gff3 -a v1 -f")
        shell(f"{apollo} assembly check {P} -a v1 -c CDSCheck")
        p = shell(f"{apollo} feature check {P} -a v1")
        ## If we don't edit a feature, checks are not activated (!?)
        self.assertEqual(p.stdout.strip(), "[]")

        p = shell(f"{apollo} feature get {P} -a v1")
        ff = json.loads(p.stdout)
        g1 = [x for x in ff if x["gffId"] == "MyGene"][0]
        g2 = [x for x in ff if x["gffId"] == "AnotherGene"][0]

        shell(f"{apollo} feature edit-coords {P} -i {g1['_id']} -e 201")
        shell(f"{apollo} feature edit-coords {P} -i {g2['_id']} -e 251")
        p = shell(f"{apollo} feature check {P} -a v1")
        out = json.loads(p.stdout)
        self.assertTrue(len(out) > 1)
        self.assertTrue("InternalStopCodonCheck" in p.stdout)

        ## Ids with checks
        ids = []
        for x in out:
            ids.extend(x["ids"])
        self.assertTrue(len(set(ids)) > 1)

        ## Retrieve by feature id
        xid = " ".join(ids)
        p = shell(f"{apollo} feature check {P} -i {xid}")
        self.assertTrue("InternalStopCodonCheck" in p.stdout)

    def testFeatureChecksIndexed(self):
        shell(
            f"{apollo} assembly add-from-fasta {P} -a v1 test_data/tiny.fasta.gz --no-db -f"
        )
        shell(f"{apollo} feature import {P} -a v1 -i test_data/tiny.fasta.gff3 -d")
        # shell(f"{apollo} assembly add-from-gff {P} -i test_data/tiny.fasta.gff3 -a v1 -f")
        shell(f"{apollo} assembly check {P} -a v1 -c CDSCheck")
        p = shell(f"{apollo} feature check {P} -a v1")
        ## If we don't edit a feature, checks are not activated (!?)
        self.assertEqual(p.stdout.strip(), "[]")

        p = shell(f"{apollo} feature get {P} -a v1")
        ff = json.loads(p.stdout)
        g1 = [x for x in ff if x["gffId"] == "MyGene"][0]
        g2 = [x for x in ff if x["gffId"] == "AnotherGene"][0]

        shell(f"{apollo} feature edit-coords {P} -i {g1['_id']} -e 201")
        shell(f"{apollo} feature edit-coords {P} -i {g2['_id']} -e 251")
        p = shell(f"{apollo} feature check {P} -a v1")
        out = json.loads(p.stdout)
        self.assertTrue(len(out) > 1)
        self.assertTrue("InternalStopCodonCheck" in p.stdout)

        ## Ids with checks
        ids = []
        for x in out:
            ids.extend(x["ids"])
        self.assertTrue(len(set(ids)) > 1)

        ## Retrieve by feature id
        xid = " ".join(ids)
        p = shell(f"{apollo} feature check {P} -i {xid}")
        self.assertTrue("InternalStopCodonCheck" in p.stdout)

    def testUser(self):
        p = shell(f"{apollo} user get {P}")
        out = json.loads(p.stdout)
        self.assertTrue(len(out) > 0)

        p = shell(f"{apollo} user get {P} -r admin")
        out2 = json.loads(p.stdout)
        self.assertTrue(len(out) > 0)
        self.assertTrue(len(out) > len(out2))

        p = shell(f"{apollo} user get {P} -r admin -u admin")
        out = json.loads(p.stdout)
        self.assertEqual(len(out), 1)

        p = shell(f"{apollo} user get {P} -r readOnly -u admin")
        out = json.loads(p.stdout)
        self.assertEqual(len(out), 0)

    def testApolloProfileEnv(self):
        p = shell(
            f"""export APOLLO_PROFILE=testAdmin2
                {apollo} config address http://localhost:3999
                {apollo} config accessType root
                {apollo} config rootCredentials.username admin
                {apollo} config rootCredentials.password pass
                {apollo} login
                {apollo} status
                {apollo} user get"""
        )
        self.assertTrue("testAdmin2: Logged in" in p.stdout)
        self.assertTrue("createdAt" in p.stdout)

    def testApolloConfigCreateEnv(self):
        p = shell(
            f"""\
                export APOLLO_DISABLE_CONFIG_CREATE=1
                rm -f tmp.yml
                {apollo} config --config-file tmp.yml address http://localhost:3999""",
            strict=False,
        )
        self.assertTrue(p.returncode != 0)
        self.assertTrue("does not exist yet" in p.stderr)
        self.assertFalse(os.path.isfile("tmp.yml"))

        p = shell(
            f"""\
                export APOLLO_DISABLE_CONFIG_CREATE=0
                rm -f tmp.yml
                {apollo} config --config-file tmp.yml address http://localhost:3999"""
        )
        self.assertEqual(0, p.returncode)
        self.assertTrue(os.path.isfile("tmp.yml"))

        p = shell(
            f"""\
                unset APOLLO_DISABLE_CONFIG_CREATE
                rm -f tmp.yml
                {apollo} config --config-file tmp.yml address http://localhost:3999"""
        )
        self.assertEqual(0, p.returncode)
        self.assertTrue(os.path.isfile("tmp.yml"))

        os.remove("tmp.yml")

    def testInvalidAccess(self):
        p = shell(f"{apollo} user get --profile foo", strict=False)
        self.assertEqual(1, p.returncode)
        self.assertTrue('Profile "foo" does not exist' in p.stderr)

    def testRefNameAliasConfiguration(self):
        shell(f"{apollo} assembly add-from-gff {P} -i test_data/tiny.fasta.gff3 -a asm1 -f")

        p = shell(f"{apollo} assembly get {P} -a asm1")
        self.assertTrue("asm1" in p.stdout)
        self.assertTrue("asm2" not in p.stdout)
        asm_id = json.loads(p.stdout)[0]["_id"]

        p = shell(
            f"{apollo} refseq add-alias {P} -i test_data/alias.txt -a asm2",
            strict=False,
        )
        self.assertTrue("Assembly asm2 not found" in p.stderr)

        p = shell(
            f"{apollo} refseq add-alias {P} -i test_data/alias.txt -a asm1",
            strict=False,
        )
        self.assertTrue(
            "Reference name aliases added successfully to assembly asm1" in p.stdout
        )

        p = shell(f"{apollo} refseq get {P}")
        refseq = json.loads(p.stdout.strip())
        vv1ref = [x for x in refseq if x["assembly"] == asm_id]
        refname_aliases = {x["name"]: x["aliases"] for x in vv1ref}
        self.assertTrue(
            all(alias in refname_aliases.get("ctgA", []) for alias in ["ctga", "CTGA"])
        )
        self.assertTrue(
            all(alias in refname_aliases.get("ctgB", []) for alias in ["ctgb", "CTGB"])
        )
        self.assertTrue(
            all(alias in refname_aliases.get("ctgC", []) for alias in ["ctgc", "CTGC"])
        )

    @unittest.skip("Works locally but fails on github")
    def testLogin(self):
        # This should wait for user's input
        p = shell(f"{apollo} login {P}", timeout=5, strict=False)
        self.assertTrue(
            "Timeout" in p.stderr
        )  # NB: "Timeout" comes from utils.py, not Apollo
        # This should be ok
        shell(f"{apollo} login {P} --force", timeout=5, strict=True)
    def testFileUpload(self):
        p = shell(f"{apollo} file upload {P} -t text/x-fasta -i test_data/tiny.fasta")
        out = json.loads(p.stdout)
        self.assertEqual("text/x-fasta", out["type"])
        self.assertTrue(out["_id"])

        p = shell(f"{apollo} file upload {P} -i test_data/tiny.fasta")
        out = json.loads(p.stdout)
        self.assertEqual("text/x-fasta", out["type"])

        p = shell(f"{apollo} file upload {P} -i test_data/tiny.fasta.gff3")
        out = json.loads(p.stdout)
        self.assertEqual("text/x-gff3", out["type"])

        p = shell(
            f"{apollo} file upload {P} -t text/x-gff3 -i test_data/tiny.fasta.gff3"
        )
        out = json.loads(p.stdout)
        self.assertEqual("text/x-gff3", out["type"])

        p = shell(f"{apollo} file upload {P} -i test_data/guest.yaml", strict=False)
        self.assertTrue(p.returncode != 0)

    def testFileUploadGzip(self):
        # Uploading a gzip file must skip compression and just copy the file
        with open("test_data/tiny.fasta.gz", "rb") as gz:
            md5 = hashlib.md5(gz.read()).hexdigest()
        p = shell(f"{apollo} file upload {P} -i test_data/tiny.fasta.gz")
        out = json.loads(p.stdout)
        self.assertEqual(md5, out["checksum"])
        shell(f"{apollo} assembly add-file {P} -f -i {out['_id']}")

    def testAddAssemblyWithoutLoadingInMongo(self):
        # It would be good to check that really there was no sequence loading
        shell(f"{apollo} assembly add-from-fasta {P} -f --no-db test_data/tiny.fasta.gz")
        p = shell(f"{apollo} assembly sequence {P} -a tiny.fasta.gz")
        self.assertTrue(p.stdout.startswith(">"))

        p = shell(
            f"{apollo} assembly add-from-fasta {P} -f --no-db test_data/tiny.fasta",
            strict=False,
        )
        self.assertTrue(p.returncode != 0)

    def testAddAssemblyFromFileId(self):
        p = shell(f"{apollo} file upload {P} -i test_data/tiny.fasta")
        fid = json.loads(p.stdout)["_id"]
        p = shell(f"{apollo} assembly add-file {P} -i {fid} -a up -f")
        out = json.loads(p.stdout)
        self.assertEqual("up", out["name"])
        self.assertEqual(fid, out["fileId"])

        shell(f"{apollo} assembly delete {P} -a up")
        shell(
            f"{apollo} file upload {P} -i test_data/tiny.fasta | {apollo} assembly add-file {P} -a up -f"
        )
        p = shell(f"{apollo} assembly get {P} -a up")
        out = json.loads(p.stdout)
        self.assertEqual("up", out[0]["name"])

    def testGetFiles(self):
        shell(f"{apollo} file upload {P} -i test_data/tiny.fasta")
        p = shell(f"{apollo} file upload {P} -i test_data/tiny.fasta")
        fid = json.loads(p.stdout)["_id"]

        p = shell(f"{apollo} file get {P}")
        out = json.loads(p.stdout)
        self.assertTrue(len(out) >= 2)
        self.assertTrue([x for x in out if x["_id"] == fid])

        p = shell(f"{apollo} file get {P} -i {fid} {fid}")
        out = json.loads(p.stdout)
        self.assertTrue(len(out) == 1)

        p = shell(f"{apollo} file get {P} -i nonexists")
        out = json.loads(p.stdout)
        self.assertEqual(0, len(out))

    def testDownloadFile(self):
        p = shell(f"{apollo} file upload {P} -i test_data/tiny.fasta")
        up = json.loads(p.stdout)
        if os.path.exists(up["basename"]):
            raise Exception(
                f"File {up['basename']} exists - if safe to do so, delete it before running this test"
            )

        shell(f"{apollo} file download {P} -i {up['_id']}")
        with open(up["basename"]) as fin:
            down = "".join(fin.readlines())
            self.assertTrue(down.startswith(">"))
            self.assertTrue(down.strip().endswith("accc"))
        os.remove(up["basename"])

        shell(f"{apollo} file download {P} -i {up['_id']} -o tmp.fa")
        with open("tmp.fa") as fin:
            down = "".join(fin.readlines())
            self.assertTrue(down.startswith(">"))
            self.assertTrue(down.strip().endswith("accc"))
        os.remove("tmp.fa")

        p = shell(f"{apollo} file download {P} -i {up['_id']} -o -")
        self.assertTrue(p.stdout.startswith(">"))
        self.assertTrue(p.stdout.strip().endswith("accc"))

    def testDeleteFile(self):
        p = shell(f"{apollo} file upload {P} -i test_data/tiny.fasta")
        up1 = json.loads(p.stdout)
        p = shell(f"{apollo} file upload {P} -i test_data/tiny.fasta")
        up2 = json.loads(p.stdout)

        p = shell(f"{apollo} file delete {P} -i {up1['_id']} {up2['_id']}")
        out = json.loads(p.stdout)
        self.assertEqual(2, len(out))

        p = shell(f"{apollo} file get {P} -i {up1['_id']} {up2['_id']}")
        out = json.loads(p.stdout)
        self.assertEqual(0, len(out))


if __name__ == "__main__":
    unittest.main()
