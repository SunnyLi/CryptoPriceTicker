angular.module('crypto-chart', ['ngRoute'])

.value('socketUrl', 'http://api.marketmonitor.io:80/BTC/USD/trades')

.factory('Socket', ['$rootScope', function ($rootScope) {
  var Socket = function (socketUrl) {
    var self = this;
    self.socket = io.connect(socketUrl);

    this.on = function (eventName, callback) {
      self.socket.on(eventName, function () {
        var args = arguments;
        $rootScope.$apply(function () {
          callback.apply(self.socket, args);
        });
      });
    };

    this.emit = function (eventName, data, callback) {
      self.socket.emit(eventName, data, function () {
        var args = arguments;
        $rootScope.$apply(function () {
          if (callback) {
            callback.apply(self.socket, args);
          }
        });
      });
    };

    this.getSocket = function () {
      return self.socket;
    };
  };

  return Socket;
}])

.factory('sockets', ['Socket', function(Socket) {
  // moar sockets!!
  var trades = new Socket('http://api.marketmonitor.io:80/BTC/USD/trades'),
      summary = new Socket('http://api.marketmonitor.io:80/BTC/USD/summary'),
      volume = new Socket('http://api.marketmonitor.io:80/BTC/USD/volume'),
      priceDistribution = new Socket('http://api.marketmonitor.io:80/BTC/USD/priceDistribution');

  return {
    trades: trades,
    summary: summary,
    volume: volume,
    priceDistribution: priceDistribution,
    removeListeners: function () {
      trades.getSocket().removeAllListeners();
      summary.getSocket().removeAllListeners();
      volume.getSocket().removeAllListeners();
      priceDistribution.getSocket().removeAllListeners();
    }
  };
}])

.config(['$routeProvider', function($routeProvider) {
    $routeProvider
        .when('/', {
            controller: 'Ticker',
            templateUrl: 'app/client/views/price.html'
        })
        .when('/:market/:exchange/', {
            controller: 'Ticker',
            templateUrl: 'app/client/views/price.html'
        })
        .otherwise({
            redirectTo:'/'
        });
}])

.controller('Ticker', ['$scope', '$routeParams', '$rootScope', 'sockets', function($scope, $routeParams, $rootScope, sockets) {

    $rootScope.markets = {
        'btc': ['All Markets'],
        'doge': []
    };

    $rootScope.market = 'btc';
    $rootScope.exchange = 'All';  // default view
  
    sockets.summary.on('update', function (data) {
      $rootScope.price_high = data.high;
      $rootScope.price_low = data.low;
    });

    if($routeParams.market && $routeParams.market in $rootScope.markets){
        $rootScope.market = $routeParams.market;

        if ($routeParams.exchange)
            if($.inArray($routeParams.exchange, $rootScope.markets[$rootScope.market]) > -1){
                $rootScope.exchange = $routeParams.exchange;
            } else {
                $rootScope.exchange = $rootScope.markets[$rootScope.market][0];
            }
    }

    // lazy top-bar reset
    $('span#selections').trigger('mouseleave');

    // remove old listeners
    $scope.$on('$destroy', function (event) {
        sockets.removeListeners();
    })

    // helpful..
    console.log($rootScope.market + ' ' + $rootScope.exchange + ' ...');

    // charting
    $scope.app = [];

//    socket.on('render', function(data){
        // initialize charts and table
        $scope.app.data = [ // temporary setup data
          {date: Date.now()-10000, price: 375},
          {date: Date.now()-100, price: 375}
        ];
        $scope.app.coordinate = [];
        $scope.app.coordinate.real = [];
        $scope.app.chart = [$('#price-overtime')];
        $scope.app.ymax = 500;

        $scope.app.data.sort(function (a, b) {
            if (a.time > b.time)
            return 1;
            if (a.time < b.time)
            return -1;
            // a must be equal to b
            return 0;
        });

        $scope.app.data.forEach(function(trade) {
            $scope.app.coordinate.real.push([trade.date, trade.price]);
        });

        $scope.app.plot = $.plot($scope.app.chart[0], [
            { data: $scope.app.coordinate.real, id: 'actual', lines: {fill: false} }
        ], {
            lines: { show: true, fill: true },
            points: { show: true },
            series: { downsample: { threshold: 200 } },
            xaxis: { mode: "time", timeformat: "%m/%d %H:%M:%S", ticks: 5, minTickSize: [10, "second"], timezone: "browser",
                        min: Date.now()-1000, zoomRange: [1000, 1000000],
                        panRange: [Date.now()-1000, null]
                   },
            yaxis: { min: $scope.app.ymax / 2, max: $scope.app.ymax, panRange: [-0.0002, $scope.app.ymax / 2 * 3],
                        zoomRange: [5, $scope.app.ymax / 2] },
            zoom: { interactive: true, center: {left: 500} },
            pan: { interactive: true }
        });

        $scope.app.chart[0].bind("plotpan", function (event, plot) {
            var axes = plot.getAxes();
            $(".message").html("Panning to x: "  + axes.xaxis.min.toFixed(0)
                + " &ndash; " + axes.xaxis.max.toFixed(0)
                + " and y: " + axes.yaxis.min.toFixed(8)
                + " &ndash; " + axes.yaxis.max.toFixed(8));
        });

        $scope.app.chart[0].bind("plotzoom", function (event, plot) {
            var axes = plot.getAxes();
            $(".message").html("Zooming to x: "  + axes.xaxis.min.toFixed(0)
                + " &ndash; " + axes.xaxis.max.toFixed(0)
                + " and y: " + axes.yaxis.min.toFixed(8)
                + " &ndash; " + axes.yaxis.max.toFixed(8));
        });

//    });

    sockets.trades.on('trade', function (trade) {
        $scope.app.data = $scope.app.data.concat(trade);
        $scope.app.coordinate.real.push([trade.date, trade.price]);

        date = new Date(trade.date);
        $('#table-header').after(
          '<tr><td><abbr title="' + date.toString() + '">' + pad(date.getHours()) +
          ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds()) + '</abbr></td>' +
          '<td>' + trade.price + '</td>' + '<td>' + trade.amount + '</td>' + '</tr>'
        );

        $scope.app.plot.setData([
            { data: $scope.app.coordinate.real, id: 'actual', lines: {fill: false} }
        ]);

        // Since the axes don't change, we don't need to call $scope.app.plot.setupGrid()
        $scope.app.plot.draw();

        // update ticker
        $('.value').text($scope.app.data[$scope.app.data.length-1].price);
    });

    sockets.volume.on('update', function (data) {
      console.log('volume: ', data);
    });

    sockets.priceDistribution.on('update', function (data) {
      console.log('price distribution: ', data);
    });

}])

// time padding
function pad(n) { return n < 10 ? '0' + n : n }

// top menu watcher
$(document).ready(function(){
    rootscope = angular.element('html').scope();

    setTimeout(function() {
        // setup menu highlight
        menuReset();

        // listen for new events
        $('div#currency > span').mouseover(function() {
            // reset
            menuReset();
            // remove default
            $('#currency #'+rootscope.market).removeAttr('style');
            $('.exchange#'+rootscope.market).removeAttr('style');
            $('#'+rootscope.market+' #'+rootscope.exchange).removeAttr('style');
            // set temp
            hoverThis = this;
            $(this).css("color", "#a0a0a0");
            console.log($(this).attr('id'));
            $('.exchange#'+$(this).attr('id')).css('display', 'block');
        });

        $('span#selections').mouseleave(function(){menuReset()});

        function menuReset(){
            // remove all inline styles
            $('div#currency > span').removeAttr('style');
            $('.exchange').removeAttr('style');
            $('.exchange a').removeAttr('style');
            // set default
            $('#currency #'+rootscope.market).css("color", "white");
            $('.exchange#'+rootscope.market).css('display', 'block');
            $('#'+rootscope.market+' #'+rootscope.exchange).css("color", "white");   
        }
    }, 1000);
});
