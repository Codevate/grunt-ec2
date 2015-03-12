'use strict';

var util = require('util');
var chalk = require('chalk');
var aws = require('./lib/aws.js');
var conf = require('./lib/conf.js');
var workflow = require('./lib/workflow.js');

module.exports = function (grunt) {

    grunt.registerTask('ec2-run-instance', 'Spins up an EC2 instance, gives a name tag and assigns an IP', function (name) {
        conf.init(grunt);

        if (arguments.length === 0) {
            grunt.fatal([
                'You should provide a name for the instance.',
                'e.g: ' + chalk.yellow('grunt ec2-run-instance:name')
            ].join('\n'));
        }

        grunt.log.writeln('Launching EC2 %s instance', chalk.cyan(conf('AWS_INSTANCE_TYPE')));

        var done = this.async();
        var params = {
            ImageId: ['--image-id', conf('AWS_IMAGE_ID')].join(' '),
            InstanceType: ['--instance-type', conf('AWS_INSTANCE_TYPE')].join(' '),
            MinCount: ['--count', 1].join(' '),
            KeyName: ['--key-name', name].join(' '),
            SecurityGroups: workflow.if_has('AWS_SECURITY_GROUP', ['--security-groups', conf('AWS_SECURITY_GROUP')]).join(' '),
            SecurityGroupIds: workflow.if_has('AWS_SECURITY_GROUP_ID', ['--security-group-ids', conf('AWS_SECURITY_GROUP_ID')]).join(' '),
            SubnetId: workflow.if_has('AWS_SUBNET_ID', ['--subnet-id', conf('AWS_SUBNET_ID')]).join(' ')
        };
        var cmd = 'ec2 run-instances %s %s %s %s %s %s %s';
        aws.log(cmd, params.ImageId, params.InstanceType, params.MinCount, params.KeyName, params.SecurityGroups, params.SecurityGroupIds, params.SubnetId);
        aws.ec2.runInstances(params, aws.capture(next));

        function next (result) {
            var elastic = conf('ELASTIC_IP');
            var id = result.Instances[0].InstanceId;
            var tasks = [
                util.format('ec2-create-tag:%s:%s', id, name)
            ];

            if (elastic) {
                tasks.push('ec2-assign-address:' + id);
            }

            grunt.log.ok('Instance requested, initializing...');
            grunt.task.run(tasks);
            done();
        }
    });
};
