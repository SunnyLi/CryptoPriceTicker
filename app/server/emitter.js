var node = require('http').createServer(server),
    io = require('socket.io').listen(node),
    MongoClient = require('mongodb').MongoClient;
    node.listen(8080);

function server (request, response){
    response.writeHead(200);
    response.end('<html>\
                    <head><title>Give me Nyan!</title></head>\
                    <body>NYAN~ KJH3Hqzi8dQ89tHUjNvWumMhW1ZdYv9EQz</body>\
                  </html>');
}

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
var list = JSON.parse(JSON.stringify(collections));

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

    // set all list
    traverse3(collections, updateList);
    // set all prev
    setTimeout(function() {
        traverse3(list, updatePrevious)
    }, 1000);
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

function updateList(exchange, market, interval) {
    collections[exchange][market][interval].find({}).sort({time: -1}).limit(100).toArray(
        function(err, results) {
            list[exchange][market][interval] =  results;
        }
    )
}

function updatePrevious(exchange, market, interval) {
    prev[exchange][market][interval] = list[exchange][market][interval][0];
}



// new view
io.sockets.on('connection', function(socket){
    socket.on('switch-view', function(data){
        if (socket.room) socket.leave(socket.room);
//        console.log(socket.room);
        socket.room = data.exchange + '-' + data.market + '-latest';

        // check if it matches a collection
        var valid = false;
        traverse3(collections, function(exchange, market, interval) {
            if (data.exchange == exchange && data.market == market){
                valid = true;
                return;
            }
        })

        if (valid){
            updateList(data.exchange, data.market, 'latest');
            setTimeout(function(){socket.emit('render', list[data.exchange][data.market]['latest'])}, 1000);
            // get updates
            socket.join(socket.room);
        }
    })
})

// update view
setInterval(function(){
    traverse3(collections, function(exchange, market, interval) {
        collections[exchange][market][interval].find({ time: {$gt: prev[exchange][market][interval].time} })
                                                .sort({time: -1}).limit(5).toArray(
            function(err, results) {
                if (results.length > 0){
                    io.sockets.in(exchange + '-' + market + '-latest').emit('update', results);
                    prev[exchange][market][interval] = results[0];
                }
            }
        )
    })
}, 120000);
