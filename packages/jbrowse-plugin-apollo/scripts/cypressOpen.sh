#!/usr/bin/env bash

export MONGODB_URI=mongodb://localhost:27017/apolloTestDb2
export GUEST_USER_ROLE=admin

cypress open 
