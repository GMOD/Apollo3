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
import sys
import subprocess
import unittest


class shell:
    def __init__(self, cmd, strict=True):
        print(cmd)
        cmd = f"set -e; set -u; set -o pipefail\n{cmd}"
        p = subprocess.Popen(
            cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE
        )
        stdout, stderr = p.communicate()
        self.returncode = p.returncode
        self.stdout = stdout.decode()
        self.stderr = stderr.decode()
        self.cmd = cmd
        if strict and self.returncode != 0:
            raise subprocess.SubprocessError(
                f"{self.stderr}\nExit code: {self.returncode}"
            )


apollo = "yarn dev"


class TestCLI(unittest.TestCase):
    def setUp(self):
        sys.stderr.write("\n" + self.id().split(".")[-1] + "\n")  # Print test name

    def testPrintHelp(self):
        p = shell(f"{apollo} --help")
        self.assertTrue("COMMANDS" in p.stdout)

    def testFeatureGet(self):
        shell(f"{apollo} assembly delete -a vv1 vv2")
        shell(f"{apollo} assembly add-gff -i test_data/tiny.fasta.gff3 -n vv1")
        shell(f"{apollo} assembly add-gff -i test_data/tiny.fasta.gff3 -n vv2")

        p = shell(f"{apollo} feature get -r ctgA", strict=False)
        self.assertTrue(p.returncode != 0)
        self.assertTrue("More than one reference" in p.stderr)

        p = shell(f"{apollo} feature get -a vv1 -r ctgA")
        out = json.loads(p.stdout)
        self.assertTrue(len(out[0]) > 2)

        p = shell(f"{apollo} feature get -a vv1 -r ctgA -s 40 -e 41")
        out = json.loads(p.stdout)
        self.assertEqual(len(out[0]), 1)

        p = shell(f"{apollo} feature get -a vv1 -r ctgA -s 1000 -e 1000")
        out = json.loads(p.stdout)
        self.assertEqual([[], []], out)

        p = shell(f"{apollo} feature get -r FOOBAR")
        out = json.loads(p.stdout)
        self.assertEqual([[], []], out)

        p = shell(f"{apollo} feature get -a FOOBAR -r ctgA")
        out = json.loads(p.stdout)
        self.assertEqual([[], []], out)

    def testAssemblyGet(self):
        shell(f"{apollo} assembly delete -a vv1 vv2 vv3")
        shell(f"{apollo} assembly add-fasta -i test_data/tiny.fasta -n vv1")
        shell(f"{apollo} assembly add-fasta -i test_data/tiny.fasta -n vv2")
        shell(f"{apollo} assembly add-fasta -i test_data/tiny.fasta -n vv3")
        p = shell(f"{apollo} assembly get")
        self.assertTrue("vv1" in p.stdout)
        self.assertTrue("vv2" in p.stdout)
        self.assertTrue("vv3" in p.stdout)

        p = shell(f"{apollo} assembly get -a vv1 vv2")
        self.assertTrue("vv1" in p.stdout)
        self.assertTrue("vv2" in p.stdout)
        self.assertTrue("vv3" not in p.stdout)

        out = json.loads(p.stdout)
        aid = [x for x in out if x["name"] == "vv1"][0]["_id"]
        p = shell(f"{apollo} assembly get -a {aid} vv2")
        self.assertTrue("vv1" in p.stdout)
        self.assertTrue("vv2" in p.stdout)
        self.assertTrue("vv3" not in p.stdout)

    def testDeleteAssembly(self):
        shell(f"{apollo} assembly delete -a volvox1 volvox2 volvox3")
        shell(f"{apollo} assembly add-gff -i test_data/tiny.fasta.gff3 -n volvox1")
        shell(f"{apollo} assembly add-gff -i test_data/tiny.fasta.gff3 -n volvox2")
        shell(f"{apollo} assembly add-gff -i test_data/tiny.fasta.gff3 -n volvox3")
        p = shell(
            f"""{apollo} assembly get | jq '.[] | select(.name == "volvox1") | ._id'"""
        )
        aid = p.stdout.strip()
        shell(f"{apollo} assembly delete -a {aid} volvox2")
        shell(f"{apollo} assembly delete -a {aid} volvox2")  # Ok
        p = shell(f"{apollo} assembly get")
        self.assertTrue(f"{aid}" not in p.stdout)
        self.assertTrue("volvox1" not in p.stdout)
        self.assertTrue("volvox2" not in p.stdout)
        self.assertTrue("volvox3" in p.stdout)

    def testAddAssemblyFromGff(self):
        shell(f"{apollo} assembly delete -a vv1")
        shell(
            f"{apollo} assembly add-gff -i test_data/tiny.fasta.gff3 -n vv1 --omit-features"
        )

        ## Get id of assembly named vv1 and check there are no features
        p = shell(f"{apollo} assembly get -a vv1")
        self.assertTrue("vv1" in p.stdout)
        self.assertTrue("vv2" not in p.stdout)
        asm_id = json.loads(p.stdout)[0]["_id"]

        p = shell(f"{apollo} refseq get")
        refseq = json.loads(p.stdout.strip())
        vv1ref = [x for x in refseq if x["assembly"] == asm_id]
        refseq_id = [x["_id"] for x in vv1ref if x["name"] == "ctgA"][0]

        p = shell(f"{apollo} feature get -r {refseq_id}")
        ff = json.loads(p.stdout)
        self.assertEqual(ff[0], [])
        self.assertEqual(ff[1], [])

        p = shell(
            f"{apollo} assembly add-gff -i test_data/tiny.fasta.gff3 -n vv1",
            strict=False,
        )
        self.assertTrue(p.returncode != 0)
        self.assertTrue('Error: Assembly "vv1" already exists' in p.stderr)

    def testAddAssemblyFromLocalFasta(self):
        shell(f"{apollo} assembly delete -a vv1")
        shell(f"{apollo} assembly add-fasta -i test_data/tiny.fasta -n vv1")
        p = shell(f"{apollo} assembly get -a vv1")
        self.assertTrue("vv1" in p.stdout)

    def testAddAssemblyFromExternalFasta(self):
        shell(f"{apollo} assembly delete -a vv1")
        shell(
            f"""{apollo} assembly add-fasta -n vv1 \
                -i https://raw.githubusercontent.com/GMOD/Apollo3/main/packages/apollo-collaboration-server/test/data/volvox.fa \
                -x https://raw.githubusercontent.com/GMOD/Apollo3/main/packages/apollo-collaboration-server/test/data/volvox.fa.fai
                  """
        )
        p = shell(f"{apollo} assembly get -a vv1")
        self.assertTrue("vv1" in p.stdout)

    def testEditFeatureType(self):
        shell(f"{apollo} assembly delete -a vv1")
        shell(f"{apollo} assembly add-gff -i test_data/tiny.fasta.gff3 -n vv1")

        ## Get id of assembly named vv1
        p = shell(f"{apollo} assembly get -a vv1")
        asm_id = json.loads(p.stdout)[0]["_id"]

        ## Get refseqs in assembly vv1
        p = shell(
            f"""{apollo} refseq get | jq '.[] | select(.assembly == "{asm_id}" and .name == "ctgA") | ._id'"""
        )
        refseq = p.stdout.strip()

        ## Get feature in vv1
        p = shell(f"{apollo} feature get -r {refseq}")
        features = json.loads(p.stdout)[0]
        self.assertTrue(len(features) > 2)

        # Get id of feature of type contig
        contig = [x for x in features if x["type"] == "contig"]
        self.assertEqual(len(contig), 1)
        contig_id = contig[0]["_id"]

        ## Edit type of "contig" feature
        p = shell(f"{apollo} feature edit-type -i {contig_id} -t region")

        p = shell(
            f"""{apollo} feature get -r {refseq} | jq '.[0][] | select(._id == "{contig_id}")'"""
        )
        contig = json.loads(p.stdout)
        self.assertEqual(contig["type"], "region")

    def testEditFeatureCoords(self):
        shell(f"{apollo} assembly delete -a vv1")
        shell(f"{apollo} assembly add-gff -i test_data/tiny.fasta.gff3 -n vv1")

        ## Get id of assembly named vv1
        p = shell(f"{apollo} assembly get -a vv1")
        asm_id = json.loads(p.stdout)[0]["_id"]

        ## Get refseqs in assembly vv1
        p = shell(
            f"""{apollo} refseq get | jq '.[] | select(.assembly == "{asm_id}" and .name == "ctgA") | ._id'"""
        )
        refseq = p.stdout.strip()

        ## Get feature in vv1
        p = shell(f"{apollo} feature get -r {refseq}")
        features = json.loads(p.stdout)[0]
        self.assertTrue(len(features) > 2)

        # Get id of feature of type contig
        contig = [x for x in features if x["type"] == "contig"]
        self.assertEqual(len(contig), 1)
        contig_id = contig[0]["_id"]

        ## Edit start and end coordinates
        shell(f"{apollo} feature edit-coords -i {contig_id} -s 80 -e 160")
        shell(f"{apollo} feature edit-coords -i {contig_id} -s 20 -e 100")

        p = shell(
            f"""{apollo} feature get -r {refseq} | jq '.[0][] | select(._id == "{contig_id}")'"""
        )
        contig = json.loads(p.stdout)
        self.assertEqual(contig["start"], 20 - 1)
        self.assertEqual(contig["end"], 100)

        p = shell(f"{apollo} feature edit-coords -i {contig_id} -s 1 -e 1")
        p = shell(
            f"""{apollo} feature get -r {refseq} | jq '.[0][] | select(._id == "{contig_id}")'"""
        )
        contig = json.loads(p.stdout)
        self.assertEqual(contig["start"], 0)
        self.assertEqual(contig["end"], 1)

        p = shell(f"{apollo} feature edit-coords -i {contig_id} -s 0", strict=False)
        self.assertEqual(p.returncode, 1)
        self.assertEqual("Coordinates must be greater than 0", p.stderr.strip())

        p = shell(
            f"{apollo} feature edit-coords -i {contig_id} -s 10 -e 9", strict=False
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
        p = shell(f"{apollo} feature edit-coords -i {mrna_id} -s 1", strict=False)
        self.assertTrue(p.returncode != 0)
        self.assertTrue("exceeds the bounds of its parent" in p.stderr)

    def testEditAttributes(self):
        shell(f"{apollo} assembly delete -a vv1")
        shell(f"{apollo} assembly add-gff -i test_data/tiny.fasta.gff3 -n vv1")

        ## Get id of assembly named vv1
        p = shell(f"{apollo} assembly get -a vv1")
        asm_id = json.loads(p.stdout)[0]["_id"]

        p = shell(
            f"""{apollo} refseq get | jq '.[] | select(.assembly == "{asm_id}" and .name == "ctgA") | ._id'"""
        )
        refseq = p.stdout.strip()

        ## Get feature in vv1
        p = shell(
            f"""{apollo} feature get -r {refseq} | jq '.[0][] | select(.type == "contig") | ._id'"""
        )
        fid = p.stdout.strip()

        ## Edit existing attribute value
        p = shell(
            f"{apollo} feature edit-attribute -i {fid} -a source -v 'Eggs & Stuff'"
        )
        p = shell(f"{apollo} feature edit-attribute -i {fid} -a source")
        out = json.loads(p.stdout)
        self.assertEqual(out[0], "Eggs & Stuff")

        ## Add attribute
        p = shell(f"{apollo} feature edit-attribute -i {fid} -a newAttr -v stuff")
        p = shell(f"{apollo} feature edit-attribute -i {fid} -a newAttr")
        self.assertTrue("stuff" in p.stdout)

        ## List of values
        p = shell(f"{apollo} feature edit-attribute -i {fid} -a newAttr -v A B C")
        p = shell(f"{apollo} feature edit-attribute -i {fid} -a newAttr")
        out = json.loads(p.stdout)
        self.assertEqual(out, ["A", "B", "C"])

        ## Special fields
        p = shell(
            f"{apollo} feature edit-attribute -i {fid} -a 'Gene Ontology' -v GO:0051728 GO:0019090"
        )
        p = shell(f"{apollo} feature edit-attribute -i {fid} -a 'Gene Ontology'")
        out = json.loads(p.stdout)
        self.assertEqual(out, ["GO:0051728", "GO:0019090"])

        # This should fail
        p = shell(
            f"{apollo} feature edit-attribute -i {fid} -a 'Gene Ontology' -v FOOBAR"
        )

    def testSearchFeatures(self):
        shell(f"{apollo} assembly delete -a vv1 vv2")
        shell(f"{apollo} assembly add-gff -i test_data/tiny.fasta.gff3 -n vv1")
        shell(f"{apollo} assembly add-gff -i test_data/tiny.fasta.gff3 -n vv2")

        p = shell(f"{apollo} feature search -a vv1 vv2 -t EDEN")
        out = json.loads(p.stdout)
        self.assertEqual(len(out), 2)
        self.assertTrue("EDEN" in p.stdout)

        p = shell(f"{apollo} feature search -a vv1 -t EDEN")
        out = json.loads(p.stdout)
        self.assertEqual(len(out), 1)
        self.assertTrue("EDEN" in p.stdout)

        p = shell(f"{apollo} feature search -a foobar -t EDEN")
        self.assertEqual("[]", p.stdout.strip())
        self.assertTrue("Warning" in p.stderr)

        p = shell(f"{apollo} feature search -a vv1 -t foobarspam")
        self.assertEqual("[]", p.stdout.strip())

    def testDeleteFeatures(self):
        shell(f"{apollo} assembly delete -a vv1")
        shell(f"{apollo} assembly add-gff -i test_data/tiny.fasta.gff3 -n vv1")
        p = shell(f"{apollo} feature search -a vv1 -t EDEN")
        fid = json.loads(p.stdout)[0]["_id"]

        shell(f"{apollo} feature delete -i {fid}")
        p = shell(f"{apollo} feature search -a vv1 -t EDEN")
        self.assertEqual(p.stdout.strip(), "[]")

        p = shell(f"{apollo} feature delete -i {fid}", strict=False)
        self.assertEqual(p.returncode, 1)
        self.assertTrue("The following featureId was not found in database" in p.stderr)

    def testAddChildFeatures(self):
        shell(f"{apollo} assembly delete -a vv1")
        shell(f"{apollo} assembly add-gff -i test_data/tiny.fasta.gff3 -n vv1")
        p = shell(f"{apollo} feature search -a vv1 -t contig")
        fid = json.loads(p.stdout)[0]["_id"]

        shell(f"{apollo} feature add-child -i {fid} -s 10 -e 20 -t contig_read")
        p = shell(f"{apollo} feature search -a vv1 -t contig_read")
        self.assertTrue("contig_read" in p.stdout)
        self.assertTrue('"start": 9' in p.stdout)
        self.assertTrue('"end": 20' in p.stdout)

        p = shell(
            f"{apollo} feature add-child -i {fid} -s 10 -e 2000 -t contig_read",
            strict=False,
        )
        self.assertTrue(p.returncode != 0)
        self.assertTrue("Child feature coordinates" in p.stderr)

        # This should fail
        p = shell(
            f"{apollo} feature add-child -i {fid} -s 10 -e 20 -t FOOBAR", strict=False
        )
        self.assertEqual(p.returncode, 0)

    def testImportFeatures(self):
        shell(f"{apollo} assembly delete -a vv1")
        shell(f"{apollo} assembly add-fasta -i test_data/tiny.fasta -n vv1")
        shell(f"{apollo} feature import -i test_data/tiny.fasta.gff3 -a vv1")
        p = shell(f"{apollo} feature search -a vv1 -t contig")
        out = json.loads(p.stdout)
        self.assertEqual(len(out), 1)

        p = shell(f"{apollo} feature import -i test_data/tiny.fasta.gff3 -a vv1")
        p = shell(f"{apollo} feature search -a vv1 -t contig")
        out = json.loads(p.stdout)
        self.assertEqual(len(out), 2)

        p = shell(f"{apollo} feature import -d -i test_data/tiny.fasta.gff3 -a vv1")
        p = shell(f"{apollo} feature search -a vv1 -t contig")
        out = json.loads(p.stdout)
        self.assertEqual(len(out), 1)

        p = shell(f"{apollo} assembly delete -a vv2")
        p = shell(
            f"{apollo} feature import -i test_data/tiny.fasta.gff3 -a vv2", strict=False
        )
        self.assertTrue(p.returncode != 0)
        self.assertTrue('Assembly "vv2" does not exist' in p.stderr)

        p = shell(f"{apollo} feature import -i foo.gff3 -a vv1", strict=False)
        self.assertTrue(p.returncode != 0)
        self.assertTrue('File "foo.gff3" does not exist' in p.stderr)

    def testCopyFeature(self):
        shell(f"{apollo} assembly delete -a source dest dest2")
        shell(f"{apollo} assembly add-gff -i test_data/tiny.fasta.gff3 -n source")
        shell(f"{apollo} assembly add-fasta -i test_data/tiny.fasta -n dest")
        shell(f"{apollo} assembly add-fasta -i test_data/tiny.fasta -n dest2")
        p = shell(f"{apollo} feature search -a source -t contig")
        fid = json.loads(p.stdout)[0]["_id"]

        shell(f"{apollo} feature copy -i {fid} -r ctgA -a dest -s 1")
        p = shell(f"{apollo} feature search -a dest -t contig")
        out = json.loads(p.stdout)[0]
        self.assertEqual(out["start"], 0)
        self.assertEqual(out["end"], 50)

        # RefSeq id does not need assembly
        p = shell(f"{apollo} refseq get -a dest2")
        destRefSeq = [x["_id"] for x in json.loads(p.stdout) if x["name"] == "ctgA"][0]
        p = shell(f"{apollo} feature copy -i {fid} -r {destRefSeq} -s 2")

        p = shell(f"{apollo} feature search -a dest2 -t contig")
        out = json.loads(p.stdout)[0]
        self.assertEqual(out["start"], 1)
        self.assertEqual(out["end"], 51)

        # Copy to same assembly
        shell(f"{apollo} feature copy -i {fid} -r ctgA -a source -s 10")
        p = shell(f"{apollo} feature search -a source -t contig")
        out = json.loads(p.stdout)
        print(out)

        # Copy non-existant feature or refseq
        p = shell(f"{apollo} feature copy -i FOOBAR -r ctgA -a dest -s 1", strict=False)
        self.assertTrue(p.returncode != 0)
        self.assertTrue("ERROR" in p.stderr)

        p = shell(
            f"{apollo} feature copy -i {fid} -r FOOBAR -a dest -s 1", strict=False
        )
        self.assertTrue(p.returncode != 0)
        self.assertTrue("No reference" in p.stderr)

        # Ambiguous refseq
        p = shell(f"{apollo} feature copy -i {fid} -r ctgA -s 1", strict=False)
        self.assertTrue(p.returncode != 0)
        self.assertTrue("More than one" in p.stderr)


if __name__ == "__main__":
    unittest.main()
