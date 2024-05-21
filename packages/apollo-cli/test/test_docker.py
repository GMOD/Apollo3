#!/usr/bin/env python3

import os
import shutil
import sys
import unittest
from pathlib import Path
from utils import shell

hostTmpDir = os.path.abspath("tmpTestDocker")
hostDataDir = os.path.abspath("test_data")
apollo = f"docker run --network host -v {hostTmpDir}/.config:/home/apolloUser/.config/apollo-cli -v {hostDataDir}:/data apollo"


def setUpModule():
    os.makedirs(os.path.join(hostTmpDir, ".config"), exist_ok=True)
    shell(
        "docker build --build-arg USER_ID=$(id -u) --build-arg GROUP_ID=$(id -g) -t apollo ."
    )

    # See apollo-collaboration-server/.development.env for credentials etc.
    shell(f"{apollo} config address http://localhost:3999")
    shell(f"{apollo} config accessType root")
    shell(f"{apollo} config rootCredentials.username admin")
    shell(f"{apollo} config rootCredentials.password pass")
    shell(f"{apollo} login", timeout=60)


def tearDownModule():
    shutil.rmtree(hostTmpDir)


class TestDocker(unittest.TestCase):
    def setUp(self):
        sys.stderr.write("\n" + self.id().split(".")[-1] + "\n")  # Print test name

    def testPrintHelp(self):
        p = shell(f"{apollo} --help")
        self.assertTrue("COMMANDS" in p.stdout)

    def testAddAssembly(self):
        shell(f"{apollo} assembly add-gff -i data/tiny.fasta.gff3 -a vv1 -f")
        p = shell(f"{apollo} assembly get -a vv1")
        self.assertTrue("vv1" in p.stdout)

        shell(f"{apollo} assembly delete -a vv1")
        p = shell(f"{apollo} assembly get -a vv1")
        self.assertEqual("[]", p.stdout.strip())

    def testFilePermission(self):
        cfg = Path(os.path.join(hostTmpDir, ".config/config.yaml"))
        owner = cfg.owner()
        group = cfg.group()
        host = os.getenv("USERNAME")
        self.assertEqual(host, owner)
        self.assertEqual(host, group)


if __name__ == "__main__":
    unittest.main()
