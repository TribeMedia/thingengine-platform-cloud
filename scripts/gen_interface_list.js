// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2016 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

require('thingengine-core/lib/polyfill');

const Q = require('q');
const fs = require('fs');
const csv = require('csv');
const crypto = require('crypto');
const ThingTalk = require('thingtalk');

const db = require('../util/db');
const model = require('../model/schema');
const exampleModel = require('../model/example');
const deviceModel = require('../model/device');
const tokenize = require('../util/tokenize');

function findInvocation(parsed, id) {
    if (parsed.action)
        return parsed.action;
    if (parsed.query)
        return parsed.query;
    if (parsed.trigger)
        return parsed.trigger;
    console.log(id + ' not action query or trigger');
}

function getMeta(invocation) {
    var match = /^tt:([^\.]+)\.(.+)$/.exec(invocation.name.id);
    if (match === null)
        throw new TypeError('Channel name not in proper format');
    var kind = match[1];
    var channelName = match[2];
    return [kind, channelName];
}

function main() {
    var output = fs.createWriteStream(process.argv[2]);
    output.setDefaultEncoding('utf8');

    db.withClient((dbClient) => {
        const deviceMap = {};

        return deviceModel.getAll(dbClient).then((devices) => {
            devices.forEach((d) => {
                if (!d.approved_version)
                    return;
                deviceMap[d.primary_kind] = {
                    name: d.name,
                    examples: []
                };
            });
        }).then(() => {
            return exampleModel.getBaseByLanguage(dbClient, 'en');
        }).then((examples) => {
            const kindMap = {
                'thermostat': 'com.nest',
                'light-bulb': 'com.hue',
                'security-camera': 'com.nest',
                'car': 'com.tesla',
                'speaker': 'org.thingpedia.bluetooth.speaker.a2dp',
                'scale': 'com.bodytrace.scale',
                'heatpad': 'com.parklonamerica.heatpad',
                'activity-tracker': 'com.jawbone.up',
                'fitness-tracker': 'com.jawbone.up',
                'heartrate-monitor': 'com.jawbone.up',
                'sleep-tracker': 'com.jawbone.up',
                'tumblr-blog': 'com.tumblr'
            };

            var dupes = new Set;

            examples.forEach((ex) => {
                if (dupes.has(ex.target_json))
                    return;
                dupes.add(ex.target_json);
                var parsed = JSON.parse(ex.target_json);
                var invocation = findInvocation(parsed);
                var [kind, channelName] = getMeta(invocation);

                if (kind in kindMap)
                    kind = kindMap[kind];
                if (!(kind in deviceMap)) {
                    console.log('Unrecognized kind ' + kind);
                } else {
                    var tokens = tokenize.tokenize(ex.utterance);

                    deviceMap[kind].examples.push(tokens.map((t) => t.startsWith('$') ? '____' : t).join(' ')
                        .replace(/ \' /g, "'"));
                }
            });

            for (var kind in deviceMap) {
                var d = deviceMap[kind];
                output.write(d.name + ':\n');
                for (var ex of d.examples)
                    output.write(ex + '\n');
                output.write('\n');
            }
            output.end();
        });
    }).done();

    output.on('finish', () => process.exit());
}
main();
