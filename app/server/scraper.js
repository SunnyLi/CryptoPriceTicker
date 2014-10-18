var request = require('request'),
    cheerio = require('cheerio'),
    MongoClient = require('mongodb').MongoClient,
    format = require('util').format,
    io = require('socket.io/node_modules/socket.io-client');

// database collections
var collections = {
    "coinedup": {
        "btc": {}
    },
    "freshmarket": {
        "ltc": {}
    }
};

// non reference duplicate
var prev = JSON.parse(JSON.stringify(collections));

MongoClient.connect('mongodb://127.0.0.1:27017/nyan', function (err, mongo) {
    if (err) {
        throw err;
    } else {
        load_collections(mongo);
    }
});

function load_collections(db) {
    collections['coinedup']['btc']['latest'] = db.collection("coinedup-btc-latest");
    collections['freshmarket']['ltc']['latest'] = db.collection("freshmarket-ltc-daily");

    console.log("successfully connected to the database");

    // set all prev
    traverse3(collections, findPrevious);
}

function traverse3(object, callback) {
    for (var exchange in object) {
        var second = object[exchange];
        for (var market in second)
            if(second.hasOwnProperty(market)){
                var third = second[market];
                for (var interval in third)
                    if(third.hasOwnProperty(interval))
                        callback(exchange, market, interval);
            }
    }
}

function findPrevious(exchange, market, interval) {
    collections[exchange][market][interval].find({}).sort({time: -1}).limit(1).toArray(
        function(err, results) {
            prev[exchange][market][interval] =  results[0];
        }
    )
}

function insert(exchange, market, interval, data) {
    collections[exchange][market][interval].insert(data,
        function(err, docs) {
            console.log('inserted:');
            console.log(err);
            console.log(docs);
        });
    
    setTimeout(function(){ findPrevious(exchange, market, interval) }, 10000);
}


// ============================== Scrape ==============================

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function isNumber(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

//setInterval(function() {
//    // query all static sources
//}, 120000)

var coinedup = io.connect('https://socket.coinedup.com:3000');
coinedup.on('msg_updateOrderBook', function(data){
//    console.log(data);
    if (data.market == 'NYAN' && data.base == 'BTC')
        coinedup_update(data.base);
});

function coinedup_update(base){
    request('https://coinedup.com/OrderBook?market=NYAN&base='+base, function (error, response, html) {
        if (!error && response.statusCode == 200) {

            var $ = cheerio.load(html);

            var meta = {
                time: Math.round(new Date().getTime() / 1000),
                rate: $("div#elementDisplayLastPrice").find(">:first-child").text().match(/\d+\.\d+/)[0],
                high: $("div#elementDisplayBidAsk").find(">:nth-child(2)").text().match(/\d+\.\d+/)[0],
                low: $("div#elementDisplayBidAsk").find(">:first-child").text().match(/\d+\.\d+/)[0],
//                nyan: 0.001
            }

            if (isNumber(meta.rate) && isNumber(meta.high) && isNumber(meta.low)) {
                insert("coinedup", base.toLowerCase(), "latest", meta);
            }

        } else {
            console.log('error:');
            console.log(error);
        }
    })
}
