var request = require('request');
var cheerio = require('cheerio');

// assert valid data
function isNumber(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

// first NYAN / LTC exchange w/ bad SSL
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

setInterval(function(){
    request('https://freshmarket.co.in/index.php?page=trade&market=107', function (error, response, html) {
      if (!error && response.statusCode == 200) {
      
        // fetch last
        
        var res = []
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
          if (rate == 0.00100000 & nyan == 1000 & ltc == 1000 || time <= 1391230000)
          { 
            console.log(res);
            return false;
          }
          
          if (isNumber(meta.rate))
            res.push(meta);
        });
      }else{
        console.log(error);
      }
    })}, 120000 // 2 min poll
);
