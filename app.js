var express    = require('express');
var app        = express();
var bodyParser = require('body-parser');

var IP_ATAHUALPA = '127.0.0.1';
var bastly = require('bastly')({ipAtahualpa:IP_ATAHUALPA});

// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var port = process.env.PORT || 8080;        // set our port
console.log('Listenint to port: ', port);

// ROUTES FOR OUR API
// =============================================================================
var router = express.Router();              // get an instance of the express Router

// test route to make sure everything is working (accessed at GET http://localhost:8080/api)
router.get('/requestChaski', function(req, res) {
    bastly.getWorker('channelId', function(reply){
        console.log('got reply: ' + reply);
        res.json({ message: reply  });   
    });
});

router.post('/publishMessage', function(req, res) {
    
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
