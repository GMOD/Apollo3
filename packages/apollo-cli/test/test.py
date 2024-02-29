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

    def testDeletAssembly(self):
        p = shell(f"{apollo} assemblies delete -n volvox1 volvox2 volvox3")
        p = shell(
            f"{apollo} assemblies add-gff -i test_data/tiny.fasta.gff3 -n volvox1"
        )
        p = shell(
            f"{apollo} assemblies add-gff -i test_data/tiny.fasta.gff3 -n volvox2"
        )
        p = shell(
            f"{apollo} assemblies add-gff -i test_data/tiny.fasta.gff3 -n volvox3"
        )
        p = shell(
            f"""{apollo} assemblies get | jq '.[] | select(.name == "volvox1") | ._id'"""
        )
        aid = p.stdout.strip()
        p = shell(f"{apollo} assemblies delete -n {aid} volvox2")
        p = shell(f"{apollo} assemblies delete -n {aid} volvox2")  # Ok
        p = shell(f"{apollo} assemblies get")
        self.assertTrue(aid not in p.stdout)
        self.assertTrue("volvox1" not in p.stdout)
        self.assertTrue("volvox2" not in p.stdout)
        self.assertTrue("volvox3" in p.stdout)

    def testAddAssemblyFromGff(self):
        p = shell(f"{apollo} assemblies delete -n vv1")
        p = shell(
            f"{apollo} assemblies add-gff -i test_data/tiny.fasta.gff3 -n vv1 --omit-features"
        )

        ## Get id of assembly named vv1 and check there are no features
        p = shell(f"{apollo} assemblies get -n vv1")
        self.assertTrue("vv1" in p.stdout)
        self.assertTrue("vv2" not in p.stdout)
        asm_id = json.loads(p.stdout)[0]["_id"]

        p = shell(f"{apollo} refSeqs get")
        refseq = json.loads(p.stdout.strip())
        vv1ref = [x for x in refseq if x["assembly"] == asm_id]
        refseq_id = [x["_id"] for x in vv1ref if x["name"] == "ctgA"][0]

        p = shell(f"{apollo} features get -r {refseq_id}")
        ff = json.loads(p.stdout)
        self.assertEqual(ff[0], [])
        self.assertEqual(ff[1], [])

        p = shell(
            f"{apollo} assemblies add-gff -i test_data/tiny.fasta.gff3 -n vv1",
            strict=False,
        )
        self.assertTrue(p.returncode != 0)
        self.assertTrue('Error: Assembly "vv1" already exists' in p.stderr)

    def testAddAssemblyFromLocalFasta(self):
        p = shell(f"{apollo} assemblies delete -n vv1")

        p = shell(f"{apollo} assemblies add-fasta -i test_data/tiny.fasta -n vv1")
        p = shell(f"{apollo} assemblies get -n vv1")
        self.assertTrue("vv1" in p.stdout)

    def testAddAssemblyFromExternalFasta(self):
        p = shell(f"{apollo} assemblies delete -n vv1")
        p = shell(
            f"""{apollo} assemblies add-fasta -n vv1 \
                -i https://raw.githubusercontent.com/GMOD/Apollo3/main/packages/apollo-collaboration-server/test/data/volvox.fa \
                -x https://raw.githubusercontent.com/GMOD/Apollo3/main/packages/apollo-collaboration-server/test/data/volvox.fa.fai
                  """
        )
        p = shell(f"{apollo} assemblies get -n vv1")
        self.assertTrue("vv1" in p.stdout)

    def testEditFeatureType(self):
        p = shell(f"{apollo} assemblies delete -n vv1")
        p = shell(f"{apollo} assemblies add-gff -i test_data/tiny.fasta.gff3 -n vv1")

        ## Get id of assembly named vv1
        p = shell(f"{apollo} assemblies get -n vv1")
        asm_id = json.loads(p.stdout)[0]["_id"]

        ## Get refseqs in assembly vv1
        p = shell(
            f"""{apollo} refSeqs get | jq '.[] | select(.assembly == "{asm_id}" and .name == "ctgA") | ._id'"""
        )
        refseq = p.stdout.strip()

        ## Get features in vv1
        p = shell(f"{apollo} features get -r {refseq}")
        features = json.loads(p.stdout)[0]
        self.assertTrue(len(features) > 2)

        # Get id of feature of type contig
        contig = [x for x in features if x["type"] == "contig"]
        self.assertEqual(len(contig), 1)
        contig_id = contig[0]["_id"]

        ## Edit type of "contig" feature
        p = shell(f"{apollo} features edit-type -i {contig_id} -t region")

        p = shell(
            f"""{apollo} features get -r {refseq} | jq '.[0][] | select(._id == "{contig_id}")'"""
        )
        contig = json.loads(p.stdout)
        self.assertEqual(contig["type"], "region")

    def testEditFeatureCoords(self):
        p = shell(f"{apollo} assemblies delete -n vv1")
        p = shell(f"{apollo} assemblies add-gff -i test_data/tiny.fasta.gff3 -n vv1")

        ## Get id of assembly named vv1
        p = shell(f"{apollo} assemblies get -n vv1")
        asm_id = json.loads(p.stdout)[0]["_id"]

        ## Get refseqs in assembly vv1
        p = shell(
            f"""{apollo} refSeqs get | jq '.[] | select(.assembly == "{asm_id}" and .name == "ctgA") | ._id'"""
        )
        refseq = p.stdout.strip()

        ## Get features in vv1
        p = shell(f"{apollo} features get -r {refseq}")
        features = json.loads(p.stdout)[0]
        self.assertTrue(len(features) > 2)

        # Get id of feature of type contig
        contig = [x for x in features if x["type"] == "contig"]
        self.assertEqual(len(contig), 1)
        contig_id = contig[0]["_id"]

        ## Edit start and end coordinates
        p = shell(f"{apollo} features edit-coords -i {contig_id} -s 80 -e 160")
        p = shell(f"{apollo} features edit-coords -i {contig_id} -s 20 -e 100")

        p = shell(
            f"""{apollo} features get -r {refseq} | jq '.[0][] | select(._id == "{contig_id}")'"""
        )
        contig = json.loads(p.stdout)
        self.assertEqual(contig["start"], 20 - 1)
        self.assertEqual(contig["end"], 100)

        p = shell(f"{apollo} features edit-coords -i {contig_id} -s 1 -e 1")
        p = shell(
            f"""{apollo} features get -r {refseq} | jq '.[0][] | select(._id == "{contig_id}")'"""
        )
        contig = json.loads(p.stdout)
        self.assertEqual(contig["start"], 0)
        self.assertEqual(contig["end"], 1)

        p = shell(f"{apollo} features edit-coords -i {contig_id} -s 0", strict=False)
        self.assertEqual(p.returncode, 1)
        self.assertEqual("Coordinates must be greater than 0", p.stderr.strip())

        p = shell(
            f"{apollo} features edit-coords -i {contig_id} -s 10 -e 9", strict=False
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
        p = shell(f"{apollo} features edit-coords -i {mrna_id} -s 1", strict=False)
        self.assertTrue(p.returncode != 0)
        self.assertTrue("exceeds the bounds of its parent" in p.stderr)

    def testEditAttributes(self):
        p = shell(f"{apollo} assemblies delete -n vv1")
        p = shell(f"{apollo} assemblies add-gff -i test_data/tiny.fasta.gff3 -n vv1")

        ## Get id of assembly named vv1
        p = shell(f"{apollo} assemblies get -n vv1")
        asm_id = json.loads(p.stdout)[0]["_id"]

        p = shell(
            f"""{apollo} refSeqs get | jq '.[] | select(.assembly == "{asm_id}" and .name == "ctgA") | ._id'"""
        )
        refseq = p.stdout.strip()

        ## Get features in vv1
        p = shell(
            f"""{apollo} features get -r {refseq} | jq '.[0][] | select(.type == "contig") | ._id'"""
        )
        fid = p.stdout.strip()

        ## Edit existing attribute value
        p = shell(
            f"{apollo} features edit-attribute -i {fid} -a source -v 'Eggs & Stuff'"
        )
        p = shell(f"{apollo} features edit-attribute -i {fid} -a source")
        out = json.loads(p.stdout)
        self.assertEqual(out[0], "Eggs & Stuff")

        ## Add attribute
        p = shell(f"{apollo} features edit-attribute -i {fid} -a newAttr -v stuff")
        p = shell(f"{apollo} features edit-attribute -i {fid} -a newAttr")
        self.assertTrue("stuff" in p.stdout)

        ## List of values
        p = shell(f"{apollo} features edit-attribute -i {fid} -a newAttr -v A B C")
        p = shell(f"{apollo} features edit-attribute -i {fid} -a newAttr")
        out = json.loads(p.stdout)
        self.assertEqual(out, ["A", "B", "C"])

        ## Special fields
        p = shell(
            f"{apollo} features edit-attribute -i {fid} -a 'Gene Ontology' -v GO:0051728 GO:0019090"
        )
        p = shell(f"{apollo} features edit-attribute -i {fid} -a 'Gene Ontology'")
        out = json.loads(p.stdout)
        self.assertEqual(out, ["GO:0051728", "GO:0019090"])

        # This should fail
        p = shell(
            f"{apollo} features edit-attribute -i {fid} -a 'Gene Ontology' -v FOOBAR"
        )

    def testSearchFeatures(self):
        p = shell(f"{apollo} assemblies delete -n vv1 vv2")
        p = shell(f"{apollo} assemblies add-gff -i test_data/tiny.fasta.gff3 -n vv1")
        p = shell(f"{apollo} assemblies add-gff -i test_data/tiny.fasta.gff3 -n vv2")

        p = shell(f"{apollo} features search -a vv1 vv2 -t EDEN")
        out = json.loads(p.stdout)
        self.assertEqual(len(out), 2)
        self.assertTrue("EDEN" in p.stdout)

        p = shell(f"{apollo} features search -a vv1 -t EDEN")
        out = json.loads(p.stdout)
        self.assertEqual(len(out), 1)
        self.assertTrue("EDEN" in p.stdout)

        p = shell(f"{apollo} features search -a foobar -t EDEN")
        self.assertEqual("[]", p.stdout.strip())
        self.assertTrue("Warning" in p.stderr)

        p = shell(f"{apollo} features search -a vv1 -t foobarspam")
        self.assertEqual("[]", p.stdout.strip())

    def testDeleteFeatures(self):
        p = shell(f"{apollo} assemblies delete -n vv1")
        p = shell(f"{apollo} assemblies add-gff -i test_data/tiny.fasta.gff3 -n vv1")
        p = shell(f"{apollo} features search -a vv1 -t EDEN")
        fid = json.loads(p.stdout)[0]["_id"]

        p = shell(f"{apollo} features delete -i {fid}")
        p = shell(f"{apollo} features search -a vv1 -t EDEN")
        self.assertEqual(p.stdout.strip(), "[]")

        p = shell(f"{apollo} features delete -i {fid}", strict=False)
        self.assertEqual(p.returncode, 1)
        self.assertTrue("The following featureId was not found in database" in p.stderr)

    def testAddChildFeatures(self):
        p = shell(f"{apollo} assemblies delete -n vv1")
        p = shell(f"{apollo} assemblies add-gff -i test_data/tiny.fasta.gff3 -n vv1")
        p = shell(f"{apollo} features search -a vv1 -t contig")
        fid = json.loads(p.stdout)[0]["_id"]

        p = shell(f"{apollo} features add-child -i {fid} -s 10 -e 20 -t contig_read")
        p = shell(f"{apollo} features search -a vv1 -t contig_read")
        self.assertTrue("contig_read" in p.stdout)
        self.assertTrue('"start": 9' in p.stdout)
        self.assertTrue('"end": 20' in p.stdout)

        p = shell(
            f"{apollo} features add-child -i {fid} -s 10 -e 2000 -t contig_read",
            strict=False,
        )
        self.assertTrue(p.returncode != 0)
        self.assertTrue("Child feature coordinates" in p.stderr)

        # This should fail
        p = shell(
            f"{apollo} features add-child -i {fid} -s 10 -e 20 -t FOOBAR", strict=False
        )
        self.assertEqual(p.returncode, 0)

    def testImportFeatures(self):
        p = shell(f"{apollo} assemblies delete -n vv1")
        p = shell(f"{apollo} assemblies add-fasta -i test_data/tiny.fasta -n vv1")
        p = shell(f"{apollo} features import -i test_data/tiny.fasta.gff3 -a vv1")
        p = shell(f"{apollo} features search -a vv1 -t contig")
        out = json.loads(p.stdout)
        self.assertEqual(len(out), 1)
         
        p = shell(f"{apollo} features import -i test_data/tiny.fasta.gff3 -a vv1")
        p = shell(f"{apollo} features search -a vv1 -t contig")
        out = json.loads(p.stdout)
        self.assertEqual(len(out), 2)

        p = shell(f"{apollo} features import -d -i test_data/tiny.fasta.gff3 -a vv1")
        p = shell(f"{apollo} features search -a vv1 -t contig")
        out = json.loads(p.stdout)
        self.assertEqual(len(out), 1)

        p = shell(f"{apollo} assemblies delete -n vv2")
        p = shell(f"{apollo} features import -i test_data/tiny.fasta.gff3 -a vv2", strict=False)
        self.assertTrue(p.returncode != 0)
        self.assertTrue('Assembly "vv2" does not exist' in p.stderr)

        p = shell(f"{apollo} features import -i foo.gff3 -a vv1", strict=False)
        self.assertTrue(p.returncode != 0)
        self.assertTrue('File "foo.gff3" does not exist' in p.stderr)
        

if __name__ == "__main__":
    unittest.main()
