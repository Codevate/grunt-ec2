'use strict';

var fs = require('fs');
var path = require('path');
var util = require('util');
var chalk = require('chalk');
var conf = require('./lib/conf.js');
var workflow = require('./lib/workflow.js');

module.exports = function (grunt) {

    grunt.registerTask('ec2-setup', 'Sets up port forwarding, installs `rsync`, `node`, and `pm2`, enqueues `ec2-nginx-configure`', function (name) {
        conf.init(grunt);

        if (arguments.length === 0) {
            grunt.fatal([
                'You should provide an instance name.',
                'e.g: ' + chalk.yellow('grunt ec2-setup:name')
            ].join('\n'));
        }

        // TODO rsync user, node user, nginx user?

        var done = this.async();
        var cert = conf('SRV_RSYNC_CERT');
        var latest = conf('SRV_RSYNC_LATEST');
        var versions = conf('SRV_VERSIONS');
        var steps = [[
            util.format('echo "configuring up %s instance..."', name)
        ], [ // rsync
            util.format('sudo mkdir -p %s', versions),
            util.format('sudo chown -R ubuntu %s', versions),
            util.format('sudo mkdir -p %s', cert),
            util.format('sudo chown -R ubuntu %s', cert),
            util.format('sudo mkdir -p %s', latest),
            util.format('sudo chown -R ubuntu %s', latest)
        ], workflow.if_has('SSL_ENABLED', { // send certificates
            rsync: {
                name: 'cert',
                local: conf('SSL_CERTIFICATE_DIRECTORY'),
                remote: conf('SRV_RSYNC_CERT'),
                dest: conf('SRV_CERT'),
                includes: [
                    '*/',
                    conf('SSL_CERTIFICATE'),
                    conf('SSL_CERTIFICATE_KEY')
                ],
                excludes: ['*']
            }
        }), [ // node.js
            'sudo apt-get update --fix-missing',
            'sudo apt-get install -y python-software-properties build-essential git-core -y',
            'curl -sL https://deb.nodesource.com/setup_0.12 | sudo bash -',
            'sudo apt-get install -y nodejs',
            'curl -sL https://npmjs.org/install.sh | sudo bash -'
        ], [ // pm2
            'sudo apt-get install -y make g++',
            'sudo npm install -g pm2 --unsafe-perm',
            'sudo pm2 startup ubuntu -u ubuntu',
            'sudo chown -R ubuntu /home/ubuntu/.pm2',
            'sudo chown -R ubuntu /home/ubuntu/.npm',
        ], conf('AWS_POST_SETUP') // post setup commands
        ];

        workflow(steps, { name: name }, next);

        function next () {
            grunt.log.writeln('Enqueued task for %s configuration.', chalk.cyan('nginx'));
            grunt.task.run('ec2-nginx-configure:' + name);
            done();
        }
    });
};
