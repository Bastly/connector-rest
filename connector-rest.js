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
var orion = require('./orion/orion')({ webHook: IP_CALLBACK, bastlyInstance : bastly});

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
    console.log(req.query);
    var channel = req.query.channel;
    var from = req.query.from;
    var apiKey = req.query.apiKey;
   
    if(!channel || !from || !apiKey){
        res.status(404).body({ message: "must specify channel, from and apiKey"  });
        return;
    }

    bastly.getWorker(channel, from, apiKey, function (error, reply) {
        console.log('got reply from get worker: ' + error + 'payload ' + reply);
        if (error) {
            res.status(404).send(reply);   
        } else {
            res.status(200).send(reply);   
        }  
    });
});

// message publisher 
router.post('/publishMessage', function(req, res) {
    var data = JSON.parse(req.body.data);    
    var from = req.body.from;
    var to = req.body.to;
    var apiKey = req.body.apiKey;

    console.log('data is this-------------------->', data, data === 'object');

    bastly.sendMessage(to, from, apiKey, data, function(err, reply){
        console.log('messasge ack!' + reply); 
        if (err) {
            res.status(404).send({ message: reply });  
        } else {
            res.status(200).send({ message: reply }); 
        }
         
    });
});

router.post('/subscriptions', orion.updatesFromOrion);

router.post('/registerOrion', orion.registerOrionInstance);

// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
app.use('/api', router);

// START THE SERVER
// =============================================================================
app.listen(port);