var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/test');
var Schema = mongoose.Schema;
var request = require('request');
var _ = require('underscore');

var UserSchema = new Schema({
  subscriptionId: {
    type: String,
    unique: true,
    required: true
  },
  apiKey: {
    type: String,
    unique: true,
    required: true
  }
});

var User = mongoose.model('User', UserSchema);

module.exports = function (opts) {
    var IP_CALLBACK = opts.webHook;
    var bastly = opts.bastlyInstance;

    console.log('setting orion module with webhook on ' + IP_CALLBACK);

    module.registerOrionInstance = function (req, res) {
        var orionIp = req.body.ip;
        var userApiKey = req.body.apiKey;
        var regex = req.body.pattern || "";

        console.log(orionIp, userApiKey, regex);

        if (! orionIp || ! userApiKey) {
            res.send(400, {status: "error", message: "missing OrionIp, pattern or apiKey"});
        } else {
            // check if Orion si where its says it is
            request.get({
                url: 'http://' + orionIp + '/version',
                json: true,
            },
            function (error, response, body) {
                if (error) {
                    console.log('err', error);
                    res.send(500, {status: "error", message: "no orion on given IP"});
                } else {
                    // if its already registered update
            User.findOne({ apiKey: userApiKey }, function (err, user) {
                if (err){
                    res.send(500, {status: "error", message: "userkey not found"});
                }
                if (user) { // exists update delete subscription and create a new one
                    
                    request.post({
                    url: 'http://' + orionIp + '/v1/unsubscribeContext',
                    json: true,
                    body: {
                            "subscriptionId": user.subscriptionId
                        }
                    }, function (error, response, body) {
                        if (error) {
                            console.log('err', error);
                            res.send(500, {status: "error", message: error});
                        }
                    });

                } 
                    
                    console.log('creating a new subscription for this');
                     // if does not exist create subscription
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
                    }, function (error, response, body) {
                        if (error) {
                            console.log('err', error);
                            res.send(500, {status: "error", message: error});
                        } 
                        if (body.contextResponses[0].statusCode.code == 200) {
                            var attrs = [];
                            _.each( body.contextResponses[0].contextElement.attributes, function (attribute){
                                attrs.push(attribute.name);
                            });

                            // Register to all changes in structures in ORION
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
                                    "reference": "http://" + IP_CALLBACK + "/api/subscriptions",
                                    "duration": "P12M",
                                    "notifyConditions": [
                                    {
                                        "type": "ONCHANGE",
                                        "condValues" : attrs
                                    }
                                    ]
                                }
                            },
                            function (error, response, body) {
                                if (error) {
                                    console.log('err', error);
                                } else {
                                    console.log(body);
                                    if (! user) {
                                        var user = new User({ subscriptionId : body.subscribeResponse.subscriptionId, apiKey : userApiKey});
                                        user.save(function (err) { console.log(err) });
                                    } else {
                                        user.subscriptionId = body.subscribeResponse.subscriptionId;
                                        user.save(function (err) { console.log(err) });
                                    }
                                    console.log('registering apikey: ' + userApiKey + ' withRegId: ' + body.subscribeResponse.subscriptionId);
                                    res.send(200, {status: "ok", message: "registered to attributes: " + attrs.toString() });
                                }
                            });
                        } else {
                            res.send(500, {status: "error", message: "no entities subscribed to" });
                        }
                    });
                
            });  
                }
            });

            
        }
    }

    module.updatesFromOrion = function (req, res) {
        console.log('received update from ORION--------------------------------------------------');
        var updatedElement = req.body.contextResponses[0].contextElement;
        var channels = [];
        if (_.findLastIndex(updatedElement.attributes, { name: 'channels' }) != -1) {
            channels = updatedElement.attributes[_.findLastIndex(updatedElement.attributes, { name: 'channels' })].value;
        } else {
            channels.push("orion");
        }
        
        //get APIKEY FROM SUBSCRIPTION ID AND PUT IT TO THE NEXT CALL FOR CHANNELS
        var apiKey = req.body.subscriptionId;

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

