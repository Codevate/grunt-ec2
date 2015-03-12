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
            ImageId: conf('AWS_IMAGE_ID'),
            InstanceType: conf('AWS_INSTANCE_TYPE'),
            MinCount: 1,
            MaxCount: 1,
            KeyName: name,
            SecurityGroups: [conf('AWS_SECURITY_GROUP')],
            SecurityGroupIds: [conf('AWS_SECURITY_GROUP_ID')],
            SubnetId: conf('AWS_SUBNET_ID')
        };
        var cmd;
        if (params.SecurityGroups[0]) {
          delete params.SecurityGroupIds;
          delete params.SubnetId;
          cmd = 'ec2 run-instances --image-id %s --instance-type %s --count %s --key-name %s --security-groups %s';
          aws.log(cmd, params.ImageId, params.InstanceType, params.MinCount, params.KeyName, params.SecurityGroups[0]);
        } else {
          delete params.SecurityGroups;
          cmd = 'ec2 run-instances --image-id %s --instance-type %s --count %s --key-name %s --security-group-ids %s --subnet-id %s';
          aws.log(cmd, params.ImageId, params.InstanceType, params.MinCount, params.KeyName, params.SecurityGroupIds[0], params.SubnetId);
        }
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
