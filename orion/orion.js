
module.exports = function (opts) {

    var subscriptionsToApiKey = {};
    var apiKeysToSubscriptionsId = {};
    var IP_CALLBACK = opts.IP_CALLBACK;

    module.checkPattern = function (req, res) {
        var orionIp = req.body.ip;
        var regex = req.body.pattern;

        if (! orionIp || ! regex) {
            res.send(400, {status: "error", message: "missing OrionIp and/or pattern"});
        } else {

        request.post({
            url: 'http://' + orionIp + '/v1/queryContext',
            json: true,
            body: {
                    "entities": [
                        {
                            "type": [],
                            "isPattern": "true",
                            "id": ".*" + regex
                        }
                    ]
                }
        },
        function (error, response, body) {
            if (body.errorCode){
                res.send(200, {status: "error", message:"no entities found with given pattern"});
            } else {
                res.send(200, {status: "ok", message:"found entities that match given pattern"});
            }
        });
    }
    }

    module.registerOrionInstance = function (req, res) {
        var orionIp = req.body.ip;
        var userApiKey = req.body.apiKey;
        var regex = req.body.pattern;

        if (! orionIp || ! regex || ! userApiKey) {
            res.send(400, {status: "error", message: "missing OrionIp, pattern or apiKey"});
        } else {

        request.post({
            url: 'http://' + orionIp + '/v1/queryContext',
            json: true,
            body: {
                    "entities": [
                        {
                            "type": [],
                            "isPattern": "true",
                            "id": ".*" + regex
                        }
                    ]
                }
        },
            function (error, response, body) {
                if (error) console.log('err', error);
                if (body.contextResponses[0].statuCode.code == 200) {
                    var attrs = [];
                    _.each( elem.contextElement.attributes, function (attribute){
                        attrs.push(attribute.name);
                    });

                    // Register to all changes in structures in ORION each 30 secs
                    request.post({
                        url: 'http://' + orionIp + '/v1/subscribeContext',
                        json: true,
                        body: {
                            "entities": [
                            {
                                "type": [],
                                "isPattern": "true",
                                "id": ".*" + regex
                            }
                            ],
                            "attributes": [],
                            "reference": "http://" + IP_CALLBACK + "/api/subscribtionObjectStructure",
                            "duration": "P12M",
                            "notifyConditions": [
                            {
                                "type": "ONCHANGE",
                                "attributes" : attrs
                            }
                            ]
                        }
                    },
                    function (error, response, body) {
                        if (error) console.log('err', error);
                        else {
                            subscriptionsToApiKey[body.registrationId] = userApiKey;
                            apiKeysToSubscriptionsId[userApiKey] = body.registrationId;
                            console.log('registering apikey: ' + userApiKey + ' withRegId: ' + body.registrationId);
                        }
                    });
                } else {
                    res.sendStatus(503);
                }
            });
        }
    }

    module.updatesFromOrion = function (req, res) {
        var updatedElement = req.body.contextResponses[0].contextElement;
        console.log('received update from ORION--------------------------------------------------');
        var channels = [];
        if (_.findLastIndex(updatedElement.attributes, { name: 'channels' }) != -1) {
            channels = updatedElement.attributes[_.findLastIndex(updatedElement.attributes, { name: 'channels' })].value;
        } else {
            channels.push("orion");
        }
        
        //get APIKEY FROM SUBSCRIPTION ID AND PUT IT TO THE NEXT CALL FOR CHANNELS

        _.each(channels, function (channel) {
            //TODO verify apikey, from is ORION?
            bastly.sendMessage(channel, "ORION", apiKey, updatedElement, function(err, reply){
                console.log('message sent from ORION to client', err, reply); 
            });
        });

        res.sendStatus(200);
    }

return module;
}

