#!/bin/bash
sed -i "s/listen_addresses = 'localhost'/listen_addresses = '*'/g" /etc/postgresql/*/main/postgresql.conf
systemctl restart postgresql
