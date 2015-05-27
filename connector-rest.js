var express    = require('express');
var app        = express();
var bodyParser = require('body-parser');
var request = require('request');
var _ = require('underscore');
var constants = require('bastly_constants');
var program = require('commander');

program
  .version('0.0.1')
  .usage('connector-rest --atahualpa <IP> --orion <IP:port> --callback <IP:port>')
  .option('-a, --atahualpa <IP>', 'specify atahualpa IP to connect to', '127.0.0.1')
  .option('-o, --orion <IP:port>', 'specify orion IP and PORT to connect to', '127.0.0.1:1026')
  .option('-c, --callback <IP:port>', 'specify the callback ip of this endpoint', '127.0.0.1:8080')
  .parse(process.argv);

console.log('Running with atahualpa on: ', program.atahualpa);
console.log('Running with orion on: ', program.orion);
console.log('Running with callback ip on: ', program.callback);

//allows CORS for everywhere
var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Credentials', true);
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, Origin, Accept');        
    next();
};

app.use(allowCrossDomain);

var IP_ORION = program.orion;
var IP_ATAHUALPA = program.atahualpa;
var IP_CALLBACK = program.callback;

var bastly = require('bastly')({ from: 'connector', apiKey: 'none', connector: IP_ATAHUALPA, middleware: true });

// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var port = process.env.PORT || 8080;        // set our port
var subscriptions = {};

console.log('Listenint to port: ', port);

// ROUTES FOR OUR API
// =============================================================================
var router = express.Router();              // get an instance of the express Router

// chaski worker request
router.get('/requestChaski', function(req, res) {
    var channel = req.param('channel');
    var from = req.param('from');
    var apiKey = req.param('apiKey');
   
    if(!channel || !from || !apiKey){
        res.json({ message: "must specify channel, from and apiKey"  });
        return;
    }

    bastly.getWorker(channel, from, apiKey, function (reply) {
        console.log('got reply from get worker: ' + reply);
        res.json({ message: reply  });   
    }, constants.CHASKI_TYPE_SOCKETIO );
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
                url: 'http://' + IP_ORION + '/v1/subscribeContext',
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
                    "reference": "http://" + IP_CALLBACK + "/api/subscription",
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
                console.log('body', body);
                subscriptions[elem.contextElement.id] = {subscriptionId : body.subscribeResponse.subscriptionId, attributes : attrs};
            });

        } else { // only update subscription if any attrs has change cause it generates a notification.
            if (_.difference(attrs, subscriptions[elem.contextElement.id].attributes).length > 0) {
                console.log('arrays differ');
                console.log('update subscription ', subscriptions[elem.contextElement.id].subscriptionId);

                request.post({
                    url: 'http://' + IP_ORION + '/v1/updateContextSubscription',
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
    var updatedElement = req.body.contextResponses[0].contextElement;
    var channels = [];
    if (_.findLastIndex(updatedElement.attributes, { name: 'channels' }) != -1) {
        channels = updatedElement.attributes[_.findLastIndex(updatedElement.attributes, { name: 'channels' })].value;
    }
    

    var apiKey = updatedElement.id.substring("BastlyKey:".length, updatedElement.id.indexOf(":userId:"));
    console.log('Object data updated: ', updatedElement);
   
    _.each(channels, function (channel) {
        //TODO verify apikey, from is ORION?
        bastly.sendMessage(channel, "ORION", apiKey,  updatedElement, function(reply){
            console.log('messasge ack!', reply); 
        });
    });

    res.sendStatus(200);
});

// message publisher 
router.post('/publishMessage', function(req, res) {
    var data = JSON.parse(req.body.data);    
    var from = req.body.from;
    var to = req.body.to;
    var apiKey = req.body.apiKey;
    bastly.sendMessage(to, from, apiKey, data, function(repply){
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


// Register to all changes in structures in ORION each 30 secs
request.post({
    url: 'http://' + IP_ORION + '/v1/subscribeContext',
    json: true,
    body: {
        "entities": [
            {
                "type": "BastlyMSG",
                "isPattern": "true",
                "id": "BastlyKey:*"
            }
        ],
        "attributes": [],
        "reference": "http://" + IP_CALLBACK + "/api/subscribtionObjectStructure",
        "duration": "P1M",
        "notifyConditions": [
            {
                "type": "ONTIMEINTERVAL",
                "condValues": [
                    "PT30S"
                ]
            }
        ]
    }
},
function (error, response, body) {
    if (error) console.log('err', error);
    console.log('res: ', response);
    console.log('body: ', body);
});
