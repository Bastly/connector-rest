var express    = require('express');
var app        = express();
var bodyParser = require('body-parser');
var constants = require('bastly_constants');


//allows CORS for everywhere
var allowCrossDomain = function(req, res, next) {    
    res.header('Access-Control-Allow-Credentials', true);
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, Origin, Accept');        
    next();
};
app.use(allowCrossDomain);

var IP_ATAHUALPA = '127.0.0.1';
//var bastly = require('bastly')({ipAtahualpa:IP_ATAHUALPA});
var bastly = require('../sdk-node')({ipAtahualpa:IP_ATAHUALPA});

// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var port = process.env.PORT || 8080;        // set our port
console.log('Listenint to port: ', port);

// ROUTES FOR OUR API
// =============================================================================
var router = express.Router();              // get an instance of the express Router

// chaski worker request
router.get('/requestChaski', function(req, res) {
    var channel = req.param('channel');
    var chaskiType = req.param('chaskiType');
    if(!channel){
        res.json({ message: "must specify ?channel="  });   
        return;
    }
    if(!chaskiType){
        res.json({ message: "must specify ?chaskiType="+constants.CHASKI_TYPE_SOCKETIO + '/' + constants.CHASKI_TYPE_ZEROMQ });   
        return;
    }
    bastly.getWorker(channel, chaskiType, function(reply){
        console.log('got reply from get worker: ' + reply);
        res.json({ message: reply  });   
    });
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
