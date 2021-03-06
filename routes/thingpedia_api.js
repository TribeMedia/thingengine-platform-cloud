// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Thingpedia
//
// Copyright 2015-2016 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details

const Q = require('q');
const express = require('express');
const csv = require('csv');
const crypto = require('crypto');

const db = require('../util/db');
const device = require('../model/device');
const app = require('../model/app');
const user = require('../model/user');
const organization = require('../model/organization');

const ThingTalk = require('thingtalk');
const AppCompiler = ThingTalk.Compiler;
const SchemaRetriever = ThingTalk.SchemaRetriever;

const ThingpediaClient = require('../util/thingpedia-client');
const i18n = require('../util/i18n');

var router = express.Router();

router.get('/schema/:schemas', function(req, res) {
    var schemas = req.params.schemas.split(',');
    if (schemas.length === 0) {
        res.json({});
        return;
    }

    var client = new ThingpediaClient(req.query.developer_key, req.query.locale);

    client.getSchemas(schemas, req.query.version).then(function(obj) {
        if (obj.developer)
            res.cacheFor(3600000);
        else
            res.cacheFor(86400000);
        res.json(obj);
    }).catch(function(e) {
        console.error(e.stack);
        res.status(400).send('Error: ' + e.message);
    }).done();
});

router.get('/schema-metadata/:schemas', function(req, res) {
    var schemas = req.params.schemas.split(',');
    if (schemas.length === 0) {
        res.json({});
        return;
    }

    var client = new ThingpediaClient(req.query.developer_key, req.query.locale);

    client.getMetas(schemas).then(function(obj) {
        if (obj.developer)
            res.cacheFor(3600000);
        else
            res.cacheFor(86400000);
        res.json(obj);
    }).catch(function(e) {
        res.status(400).send('Error: ' + e.message);
    }).done();
});

router.get('/code/devices/:kind', function(req, res) {
    var client = new ThingpediaClient(req.query.developer_key, req.query.locale);

    client.getDeviceCode(req.params.kind, req.query.version).then(function(code) {
        if (code.developer)
            res.cacheFor(3600000);
        else
            res.cacheFor(86400000);
        res.json(code);
    }).catch(function(e) {
        res.status(400).send('Error: ' + e.message);
    }).done();
});

router.get('/devices/setup/:kinds', function(req, res) {
    var kinds = req.params.kinds.split(',');
    if (kinds.length === 0) {
        res.json({});
        return;
    }

    var client = new ThingpediaClient(req.query.developer_key, req.query.locale);
    client.getDeviceSetup(kinds).then(function(result) {
        res.cacheFor(86400000);
        res.status(200).json(result);
    }).catch(function(e) {
        res.status(500).json({ error: e.message });
    }).done();
});

router.get('/devices', function(req, res) {
    if (req.query.class && ['online', 'physical', 'data',
            'media', 'social-network', 'home', 'communication',
            'health', 'service', 'data-management'].indexOf(req.query.class) < 0) {
        res.status(404).json("Invalid device class");
        return;
    }

    var client = new ThingpediaClient(req.query.developer_key, req.query.locale);
    client.getDeviceFactories(req.query.class).then(function(obj) {
        res.cacheFor(86400000);
        res.json(obj);
    }).catch(function(e) {
        console.error('Failed to retrieve device factories: ' + e.message);
        console.error(e.stack);
        res.status(500).send('Error: ' + e.message);
    }).done();
});

router.get('/apps', function(req, res) {
    var start = parseInt(req.query.start) || 0;
    var limit = Math.min(parseInt(req.query.limit) || 20, 20);

    var client = new ThingpediaClient(req.query.developer_key, req.query.locale);
    client.getApps(start, limit).then(function(obj) {
        res.cacheFor(86400000);
        res.json(obj);
    }).catch(function(e) {
        console.error('Failed to retrieve device factories: ' + e.message);
        console.error(e.stack);
        res.status(500).send('Error: ' + e.message);
    }).done();
});

router.get('/code/apps/:app_id', function(req, res) {
    var client = new ThingpediaClient(req.query.developer_key, req.query.locale);
    client.getAppCode(req.params.app_id).then(function(obj) {
        res.cacheFor(86400000);
        res.status(200).json(obj);
    }).catch(function(e) {
        res.status(400).send('Error: ' + e.message);
    }).done();
});
router.post('/discovery', function(req, res) {
    var client = new ThingpediaClient(req.query.developer_key, req.query.locale);

    client.getKindByDiscovery(req.body).then(function(result) {
        if (result === null) {
            res.status(404).send('Not Found');
            return;
        }

        res.cacheFor(86400000);
        res.status(200).send(result.primary_kind);
    }).catch(function(e) {
        console.log('Failed to complete discovery request: ' + e.message);
        console.log(e.stack);
        res.status(400).send('Error: ' + e.message);
    });
});

router.get('/examples/by-kinds/:kinds', function(req, res) {
    var kinds = req.params.kinds.split(',');
    if (kinds.length === 0) {
        res.json([]);
        return;
    }

    var client = new ThingpediaClient(req.query.developer_key, req.query.locale);
    var isBase = req.query.base !== '0';

    client.getExamplesByKinds(kinds, isBase).then((result) => {
        res.cacheFor(300000);
        res.status(200).json(result);
    }).catch((e) => {
        res.status(500).json({ error: e.message });
    });
});

router.get('/examples', function(req, res) {
    var client = new ThingpediaClient(req.query.developer_key, req.query.locale);

    var isBase = req.query.base !== '0';

    if (req.query.key) {
        client.getExamplesByKey(req.query.key, isBase).then((result) => {
            res.cacheFor(300000);
            res.status(200).json(result);
        }).catch((e) => {
            res.status(500).json({ error: e.message });
        });
    } else {
        res.status(400).json({ error: "Bad Request" });
    }
});

router.get('/examples/click/:id', function(req, res) {
    var client = new ThingpediaClient(req.query.developer_key, req.query.locale);

    client.clickExample(req.params.id).then(() => {
        res.cacheFor(300000);
        res.status(200).json({ result: 'ok' });
    }, (e) => {
        res.status(500).json({ error: e.message });
    }).done();
});

router.get('/random-rule', function(req, res) {
    const locale = req.query.locale || 'en-US';
    const language = (locale || 'en').split(/[-_\@\.]/)[0];

    const N = Math.min(parseInt(req.query.limit) || 20, 20);

    const policy = req.query.policy || 'uniform';
    const client = new ThingpediaClient(req.query.developer_key, req.query.locale);
    const schemaRetriever = new SchemaRetriever(client);

    return db.withClient((dbClient) => {
        return db.selectAll(dbClient, "select kind from device_schema where approved_version is not null and kind_type <> 'global'", []);
    }).then((rows) => {
        let kinds = rows.map(r => r.kind);

        let stream = ThingTalk.Generate.genRandomRules(kinds, schemaRetriever, N, {
            applyHeuristics: true,
            allowUnsynthesizable: false,
            strictParameterPassing: true,
            samplingPolicy: policy,
            actionArgConstantProbability: 0.7,
            argConstantProbability: 0.3,
            requiredArgConstantProbability: 0.9,
            applyFiltersToInputs: false,
            filterClauseProbability: 0.3
        });

        res.status(200).set('Content-Type', 'application/json');

        res.write('[');
        var first = true;
        stream.on('data', (prog) => {
            if (!first)
                res.write(',');
            first = false;
            res.write(JSON.stringify(ThingTalk.Ast.prettyprint(prog, true)));
        });
        stream.on('error', (err) => {
            console.error('Error generating one rule: ' + err.message);
        });
        stream.on('end', () => {
            res.write(']');
            res.end();
        });
    }, (e) => {
        res.status(500).json({ error: e.message });
    }).done();
});

router.get('/random-rule/by-kind/:kind', function(req, res) {
    const locale = req.query.locale || 'en-US';
    const language = (locale || 'en').split(/[-_\@\.]/)[0];
    const gettext = i18n.get(locale);
    const N = Math.min(parseInt(req.query.limit) || 150, 150);
    const policy = 'only-' + req.params.kind;
    const client = new ThingpediaClient(req.query.developer_key, req.query.locale);
    const sentences_per_hit = 3;

    function makeId() { return crypto.randomBytes(8).toString('hex'); }
    function postprocess(str) { return str.replace(/your/g, 'my').replace(/ you /g, ' I '); }

    const schemaRetriever = new SchemaRetriever(client);

    return db.withClient((dbClient) => {
        return db.selectAll(dbClient, "select kind from device_schema where approved_version is not null and kind_type <> 'global'", []);
    }).then((rows) => {
        let kinds = rows.map(r => r.kind);

        let stream = ThingTalk.Generate.genRandomRules(kinds, schemaRetriever, N, {
            applyHeuristics: true,
            allowUnsynthesizable: false,
            strictParameterPassing: true,
            samplingPolicy: policy,
            actionArgConstantProbability: 0.7,
            argConstantProbability: 0.3,
            requiredArgConstantProbability: 0.9,
            applyFiltersToInputs: false,
            filterClauseProbability: 0.3
        });

        res.set('Content-disposition', 'attachment; filename=synthetic_sentences_for_turk.csv');
        res.status(200).set('Content-Type', 'text/csv');
        let output = csv.stringify();
        output.pipe(res);
        let headers = [];
        for (var i = 1; i <= 3; i ++) {
            headers = headers.concat(['id' + i, 'thingtalk' + i, 'sentence' + i]);
        }
        output.write(headers);

        let row = [];
        stream.on('data', (prog) => {
            const reconstructed = ThingTalk.Describe.describeProgram(gettext, prog, true);
            const tt = ThingTalk.Ast.prettyprint(prog, true).trim();
            row = row.concat([makeId(), tt, postprocess(reconstructed)]);
            if (row.length === sentences_per_hit * 3) {
                output.write(row);
                row = [];
            }
        });
        stream.on('error', (err) => {
            console.error('Error generating one rule: ' + err.message);
        });
        stream.on('end', () => {
            output.end();
        });
    }, (e) => {
        res.status(500).json({ error: e.message });
    }).done();
});

module.exports = router;
