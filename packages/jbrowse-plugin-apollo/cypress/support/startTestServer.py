#!/usr/bin/env python3

import argparse
import subprocess
import glob 
import os
import signal
import time
import re
import sys

if __name__ == "__main__":
    parser = argparse.ArgumentParser("(Re)start apollo server")
    parser.add_argument('--package-dir', '-p', default='packages')
    parser.add_argument('--logdir', '-d', default='tmp')
    parser.add_argument('--mongodb-uri', '-m', default='mongodb://localhost:27017/apolloTestDb')
    parser.add_argument('--guest-user-role', '-g', default='admin')
    args = parser.parse_args()

    procs = ['apollo-shared', 'jbrowse-plugin-apollo', 'apollo-collaboration-server']
    for proc in procs:
        basepath = os.path.join(args.logdir, proc)
        log = glob.glob(basepath + '*.log')
        for f in log:
            pid = int(os.path.basename(f).split('.')[-2])
            try:
                sys.stderr.write(f'Terminating {proc} with pid {pid}, if still running\n')
                os.kill(pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            os.remove(f)

        err = glob.glob(basepath + '*.err')
        for f in err:
            os.remove(f)

    # This is horrible: We kill every process from node
    sp = subprocess.Popen('pgrep -f `which node`', shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, executable='/bin/bash')
    sp.wait()
    node_procs = [int(x.strip()) for x in sp.stdout.readlines()]
    for pid in node_procs:
            try:
                sys.stderr.write(f'Terminating node process with pid {pid}\n')
                os.kill(pid, signal.SIGTERM)
            except ProcessLookupError:
                pass

    os.makedirs(args.logdir, exist_ok=True)
    
    errfiles = {}
    for proc in procs:
        basepath = os.path.join(args.logdir, proc)
        cmd =  f'''\
                export MONGODB_URI='{args.mongodb_uri}'
                export GUEST_USER_ROLE='{args.guest_user_role}'
                ( exec yarn --cwd {args.package_dir}/{proc} start > {basepath}.${{BASHPID}}.log 2> {basepath}.${{BASHPID}}.err )'''
        sys.stderr.write(cmd + '\n')
        sp = subprocess.Popen(cmd, shell=True, executable='/bin/bash')
        time.sleep(5)
        err = glob.glob(os.path.join(args.logdir, proc) + '*.err')
        assert len(err) == 1
        errfiles[proc] = err[0]
    
    if len(errfiles) != 3:
        sys.stderr.write('Unexpected number of log files: %s\n' % str(errfiles))
        for err in errfiles:
            pid = int(os.path.basename(err).split('.')[-2])
            os.kill(pid, signal.SIGTERM)
        sys.exit(1)

    while True:
        sys.stderr.write('Waiting for Apollo to start\n')
        time.sleep(5)
        err = glob.glob(os.path.join(args.logdir, 'jbrowse-plugin-apollo') + '*.err')
        with open(errfiles['jbrowse-plugin-apollo']) as fin:
            for line in fin:
                started = re.search('created .*' + re.escape('dist/jbrowse-plugin-apollo.umd.development.js'), line)
                if started is not None:
                    sys.stderr.write('Apollo started\n')
                    sys.exit(0)