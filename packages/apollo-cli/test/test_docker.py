#!/usr/bin/env python3

import os
import shutil
import sys
import unittest
from utils import shell

apollo = "docker run --network host -v ${PWD}/tmpTestDocker/.config:/root/.config/apollo-cli -v ${PWD}/test_data:/data apollo"

def setUpModule():
    os.makedirs("tmpTestDocker/.config", exist_ok=True) 
    shell("docker build -t apollo .")

    # See apollo-collaboration-server/.development.env for credentials etc.
    shell(f"{apollo} config address http://localhost:3999")
    shell(f"{apollo} config accessType root")
    shell(f"{apollo} config rootCredentials.username admin")
    shell(f"{apollo} config rootCredentials.password pass")
    shell(f"{apollo} login", timeout=60)

def tearDownModule():
    shutil.rmtree('tmpTestDocker')


class TestDocker(unittest.TestCase):
    def setUp(self):
        sys.stderr.write("\n" + self.id().split(".")[-1] + "\n")  # Print test name

    def testPrintHelp(self):
        p = shell(f"{apollo} --help")
        self.assertTrue("COMMANDS" in p.stdout)

    def testAddAssembly(self):
        p = shell(f"{apollo} assembly add-gff -i data/tiny.fasta.gff3 -a vv1 -f")


if __name__ == "__main__":
    unittest.main()
