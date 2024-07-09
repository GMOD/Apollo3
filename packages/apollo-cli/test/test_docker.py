#!/usr/bin/env python3

import os
import shutil
import sys
import unittest
from pathlib import Path
from utils import shell

hostTmpDir = os.path.abspath("tmpTestDocker")
hostDataDir = os.path.abspath("test_data")
apollo = f"docker run --network host -v {hostTmpDir}:/root/.config/apollo-cli -v {hostDataDir}:/data apollo"


def setUpModule():
    if os.path.exists(hostTmpDir) and os.path.isdir(hostTmpDir):
        shutil.rmtree(hostTmpDir)
    os.makedirs(os.path.join(hostTmpDir), exist_ok=True)
    cfg = open(os.path.join(hostTmpDir, "config.yml"), "w")
    cfg.close()

    shell("docker build --no-cache -t apollo .")

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

    def testMissingConfig(self):
        p = shell(
            f"{apollo} config address --config-file {hostTmpDir}/new.yml http://localhost:3999",
            strict=False,
        )
        self.assertTrue(p.returncode != 0)
        self.assertTrue("does not exist yet" in p.stderr)

        p = shell(
            f"{apollo} config address --config-file /root/.config/apollo-cli/new.yml http://localhost:3999",
            strict=False,
        )
        self.assertTrue(p.returncode != 0)
        self.assertTrue("does not exist yet" in p.stderr)

        cfg = open(os.path.join(hostTmpDir, "new.yml"), "w")
        cfg.close()
        p = shell(
            f"{apollo} config address --config-file /root/.config/apollo-cli/new.yml http://localhost:3999"
        )
        self.assertEqual(0, p.returncode)


if __name__ == "__main__":
    unittest.main()
