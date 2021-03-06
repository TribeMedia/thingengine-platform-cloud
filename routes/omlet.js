// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2015 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details

const Q = require('q');
const express = require('express');
const jade = require('jade');
const crypto = require('crypto');

const user = require('../util/user');
const model = require('../model/user');
const db = require('../util/db');

var router = express.Router();

router.get('/register', function(req, res) {
    if (req.user) {
        res.render('error', { page_title: req._("Thingpedia - Error"),
                              error: req._("You are already registered for Thingpedia") });
        return;
    }

    res.render('omlet_register', { page_title: req._("Thingpedia - Complete Registration") });
});

module.exports = router;
