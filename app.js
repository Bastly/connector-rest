var express    = require('express');
var app        = express();
var bodyParser = require('body-parser');
var request = require('request');
var _ = require('underscore');

var IP_ATAHUALPA = '127.0.0.1';
var bastly = require('bastly')({ipAtahualpa:IP_ATAHUALPA});

// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var port = process.env.PORT || 8080;        // set our port
var subscriptions = {};

console.log('Listenint to port: ', port);

// ROUTES FOR OUR API
// =============================================================================
var router = express.Router();              // get an instance of the express Router

// test route to make sure everything is working (accessed at GET http://localhost:8080/api)
router.get('/requestChaski', function (req, res) {
    console.log('requesting chaski');
    var channel = req.param('channel');
    if(!channel){
        res.json({ message: "must specify ?channel="  });   
        return;
    }
    console.log(channel);
    bastly.getWorker(channel, function(reply){
        console.log('got reply: ' + reply);
        res.json({ message: reply  });   
    });
});

router.post('/subscribtionObjectStructure', function (req, res){ //551c09c9984d23677ebc3cff
    // console.log('object structure watcher');

    _.each(req.body.contextResponses, function (elem) {

        // console.log(elem.contextElement);
        var attrs = [];
        _.each( elem.contextElement.attributes, function (attribute){
            attrs.push(attribute.name);
        });

        if ( subscriptions[elem.contextElement.id]  === undefined || subscriptions[elem.contextElement.id] === null){

            console.log('create subscription');
            request.post({
                url:'http://192.168.1.231:1026/v1/subscribeContext',
                json: true, 
                body: {
                    "entities": [
                    {
                        "type": "BastlyMSG",
                        "isPattern": "false",
                        "id": elem.contextElement.id
                    }
                    ],
                    "attributes": [],
                    "reference": "http://192.168.1.186:8080/api/subscription",
                    "duration": "P1M",
                    "notifyConditions": [
                    {
                        "type": "ONCHANGE",
                        "condValues": attrs
                    }
                    ],
                    "throttling": "PT1S"
                }
            },
            function (error, response, body) {
                console.log(body);
                subscriptions[elem.contextElement.id] = {subscriptionId : body.subscribeResponse.subscriptionId, attributes : attrs};
            });

        } else { // only update subscription if any attrs has change cause it generates a notification.
            if (_.difference(attrs, subscriptions[elem.contextElement.id].attributes).length > 0) {
                console.log('arrays differ');
                console.log('update subscription ', subscriptions[elem.contextElement.id].subscriptionId);

                request.post({
                    url:'http://192.168.1.231:1026/v1/updateContextSubscription',
                    json: true, 
                    body: {
                        "subscriptionId": subscriptions[elem.contextElement.id].subscriptionId,
                        "notifyConditions": [
                        {
                            "type": "ONCHANGE",
                            "condValues": attrs
                        }
                        ]
                    }
                },
                function (error, response, body) {
                    // console.log(body);
                    subscriptions[elem.contextElement.id].subscriptionId = body.subscribeResponse.subscriptionId;
                    subscriptions[elem.contextElement.id].attributes = attrs;
                });
            }  else {
                console.log('arrays do not differ', _.difference(attrs, subscriptions[elem.contextElement.id].attributes));
            }
        }

    });

    res.sendStatus(200);
});

router.post('/subscription', function (req, res) {
    console.log('subscription update of an object');
    console.log(req.body.contextResponses[0].contextElement);
    res.sendStatus(200);
});

router.post('/publishMessage', function (req, res) {

    bastly.sendMessage(req.body.channel, req.body.message, function(repply){
        console.log('messasge ack!'); 
        res.json({ message: 'ok' });   
    });
});

// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
app.use('/api', router);

// START THE SERVER
// =============================================================================
app.listen(port);

// subs 5512e663986d610148d74051