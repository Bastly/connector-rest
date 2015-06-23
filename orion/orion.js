var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/test');
var Schema = mongoose.Schema;
var request = require('request');

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
    var IP_CALLBACK = opts.IP_CALLBACK;

    module.registerOrionInstance = function (req, res) {
        var orionIp = req.body.ip;
        var userApiKey = req.body.apiKey;
        var regex = req.body.pattern || "";

        console.log(orionIp, userApiKey, regex);

        if (! orionIp || ! userApiKey) {
            res.send(400, {status: "error", message: "missing OrionIp, pattern or apiKey"});
        } else {
            // if its already registered update
            User.findOne({ apiKey: userApiKey }, function (err, user) {
                if (err){
                    res.send(500, {status: "error", message: "userkey not found"});
                }

                if (user) { // exists update

                } else {
                    console.log('ApiKey does not exist, creating subscription for this');
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
                        if (error) console.log('err', error);
                        if (body.contextResponses[0].statusCode.code == 200) {
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
                                    "reference": "http://" + IP_CALLBACK + "/api/subscriptions",
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
                                if (error) {
                                    console.log('err', error);
                                } else {
                                    var user = new User({ subscriptionId : body.registrationId, apiKey : userApiKey});
                                    user.save(function (err) {});
                                    console.log('registering apikey: ' + userApiKey + ' withRegId: ' + body.registrationId);
                                    res.send(200, {status: "ok", message: "registered to attributes: " + attrs.toString() });
                                }
                            });
                        } else {
                            res.send(500, {status: "error", message: "no entities subscribed to" });
                        }
                    });
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

