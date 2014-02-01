var request = require('request'),
    cheerio = require('cheerio'),
    MongoClient = require('mongodb').MongoClient,
    format = require('util').format;

var db;
MongoClient.connect('mongodb://127.0.0.1:27017/nyan', function (err, mongo) {
    db = mongo;
    if (err) {
        throw err;
    } else {
        console.log("successfully connected to the database");
        findPrev();
    }
});

var prev;
function findPrev(){
    var collection = db.collection("freshmarket");
    collection.find({}).sort({time: -1}).limit(1).toArray(
        function(err, results) {
            prev =  results[0];
            console.log('last: ');
            console.log(prev);
        });
}
// collection.find({}).sort({time: -1}).limit(1).toArray(function(err, result){console.log(result)})

// assert valid data
function isNumber(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

// first NYAN / LTC exchange w/ bad SSL
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

setInterval(function(){
    request('https://freshmarket.co.in/index.php?page=trade&market=107', function (error, response, html) {
      if (!error && response.statusCode == 200) {
        
        var res = [];
        var $ = cheerio.load(html);
        $('center div.box table#page thead tr').each(function(i, element){
        
          var cur = $(this);
          var rate = cur.find(">:first-child").text();
          var nyan = cur.find(">:nth-child(2)").text();
          var ltc = cur.find(">:nth-child(3)").text();
          var time = Math.round(new Date(cur.find(">:nth-child(4)").text().replace(/-/g, " ").replace("/", " ")).getTime() / 1000);

          var meta = {
            rate: rate,
            nyan: nyan,
            ltc: ltc,
            time: time
          }
          
          // insert till
          if (rate == prev.rate & nyan == prev.nyan & ltc == prev.ltc || time <= prev.time)
          { 
            console.log('result:');
            console.log(res);
            if (res.length > 0)
                add_new_data(res);
            return false;   // need to be false!
          }
          
          if (isNumber(meta.rate)){
            console.log('push:');
            console.log(meta);
            res.push(meta);
          }
        });
      }else{
        console.log('parse error:');
        console.log(error);
      }
    })}, 120000 // 2 min poll
);

function add_new_data(data){
    var collection = db.collection("freshmarket");
    
    collection.insert(data, 
        function(err, docs) {
            console.log('insert error:');
            console.log(err);
        });
    
    setTimeout(function(){findPrev()}, 10000);
}
