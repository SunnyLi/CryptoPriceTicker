var node = require('http').createServer(server),
io = require('socket.io').listen(node),
MongoClient = require('mongodb').MongoClient;

var db, collection;
var prev;
MongoClient.connect('mongodb://127.0.0.1:27017/nyan', function (err, mongo) {
    db = mongo;
    collection = db.collection("freshmarket");
    if (err) {
        throw err;
    } else {
        console.log("successfully connected to the database");
        latest();
        setTimeout(function(){
            prev = list[0];
            console.log(prev);
        }, 2000);
    }
});

var list = [];
function latest() {
    collection.find({}).sort({time: -1}).limit(20).toArray(
        function(err, results) {
            list =  results;
            console.log('last: ');
            console.log(list);
        }
    );
}

node.listen(8080);


function server (request, response){
    response.writeHead(200);
    //response.end('let\'s just end\n with <b>this</b>.');
}

io.sockets.on('connection', function(socket){
    latest();
    setTimeout(function(){socket.emit('welcome', list)}, 2000);
})


// update
setInterval(function(){
    
    collection.find({ time: {$gt: prev.time} }).sort({time: -1}).limit(10).toArray(
        function(err, results) {
            console.log(results);
            if (results.length > 0){
                io.sockets.emit('update', results);
                console.log("update pushed!");
                prev = results[0];
            }
        }
    );
    
}, 30000);
