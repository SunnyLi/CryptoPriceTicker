angular.module('nyan-chart', ['ngRoute'])

.value('socketUrl', 'http://socket.ny.anime.re:8080')

.factory('socket', ['$rootScope', 'socketUrl', function ($rootScope, socketUrl) {
  var socket = io.connect(socketUrl);
  return {
    on: function (eventName, callback) {
      socket.on(eventName, function () {
        var args = arguments;
        $rootScope.$apply(function () {
          callback.apply(socket, args);
        });
      });
    },
    emit: function (eventName, data, callback) {
      socket.emit(eventName, data, function () {
        var args = arguments;
        $rootScope.$apply(function () {
          if (callback) {
            callback.apply(socket, args);
          }
        });
      })
    },
    getSocket: function () {
      return socket;
    }
  };
}])

.config(['$routeProvider', function($routeProvider) {
    $routeProvider
        .when('/', {
            controller: 'Ticker',
            templateUrl: 'price.html'
        })
        .when('/:market/:exchange/', {
            controller: 'Ticker',
            templateUrl: 'price.html'
        })
        .when('/diff/', {   // unimplemented
            controller: 'Difficulty',
            templateUrl: 'diff.html'
        })
        .otherwise({
            redirectTo:'/'
        });
}])

.controller('Ticker', ['$scope', '$routeParams', '$rootScope', 'socket', function($scope, $routeParams, $rootScope, socket) {

    $rootScope.markets = {
        'btc': ['coinedup', 'cryptsy (unimplemented)'],
        'ltc': ['freshmarket']
    };

    $rootScope.market = 'btc';
    $rootScope.exchange = 'coinedup';

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
        socket.getSocket().removeAllListeners();
    })

    // helpful..
    console.log($rootScope.market + ' ' + $rootScope.exchange + ' ...');

    // charting
    $scope.app = [];
    var time_adj = 0;

    socket.emit('switch-view', {
                    market: $scope.market,
                    exchange: $scope.exchange,
                    interval: 'latest'
               })

    socket.on('render', function(data){
        // initialize charts and table
        $scope.app.data = data;
        $scope.app.coordinate = [];
        $scope.app.coordinate.real = [];
        $scope.app.coordinate.high = [];
        $scope.app.coordinate.low = [];
        $scope.app.chart = [$('#price-overtime')];
        $scope.app.ymax = 0.001;    // LTC

        if ($scope.market == 'btc')
            $scope.app.ymax = 0.002;


        // wrong order!
        $scope.app.data.sort(function (a, b) {
            if (a.time > b.time)
            return 1;
            if (a.time < b.time)
            return -1;
            // a must be equal to b
            return 0;
        });

        $scope.app.data.forEach(function(trade) {
            $scope.app.coordinate.real.push([trade.time * 1000 - time_adj, trade.rate]);
        });

        if ($scope.app.data[0].high) {
            $scope.app.data.forEach(function(trade) {
                $scope.app.coordinate.high.push([trade.time * 1000 - time_adj, trade.high]);
            });
        }

        if ($scope.app.data[0].low) {
            $scope.app.data.forEach(function(trade) {
                $scope.app.coordinate.low.push([trade.time * 1000 - time_adj, trade.low]);
            });
        }

        $scope.app.plot = $.plot($scope.app.chart[0], [
            { data: $scope.app.coordinate.real, id: 'actual', lines: {fill: false} } ,
            { data: $scope.app.coordinate.high, fillBetween: 'actual', color: "#0f0" },
            { data: $scope.app.coordinate.low, fillBetween: 'actual', color: "#f00" }
        ], {
            lines: { show: true, fill: true },
            points: { show: true },
            series: { downsample: { threshold: 200 } },
            xaxis: { mode: "time", timeformat: "%m/%d %H:%M", ticks: 5, minTickSize: [1/2, "hour"], timezone: "browser",
                        min: $scope.app.coordinate.real[$scope.app.coordinate.real.length - 1][0] - 10000000,
                        panRange: [$scope.app.coordinate.real[0][0] - 2000000, new Date().getTime() + 5000000] },
            yaxis: { min: $scope.app.ymax / 2, max: $scope.app.ymax, panRange: [-0.0002, $scope.app.ymax / 2 * 3],
                        zoomRange: $scope.app.ymax },
            zoom: { interactive: true, center: {right: 0} },
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

        // update ticker
        $('#value').text($scope.app.data[$scope.app.data.length-1].rate);

        for (var i = $scope.app.data.length - 18; i < $scope.app.data.length; i++){
            date = new Date($scope.app.data[i].time * 1000 - time_adj);
            $('#table-header').after(
                '<tr><td><abbr title="' + date.toString() + '">' + pad(date.getHours()) +
                                    ':' + pad(date.getMinutes()) + '</abbr></td>' +
                '<td>' + $scope.app.data[i].rate + '</td></tr>'
            );
        }
    });

    socket.on('update', function (new_data) {
        new_data = new_data.reverse();
        $scope.app.data = $scope.app.data.concat(new_data);
        new_data.forEach(function(trade) {
            $scope.app.coordinate.real.push([trade.time * 1000 - time_adj, trade.rate]);

            date = new Date(trade.time * 1000 - time_adj);
            $('#table-header').after(
                '<tr><td><abbr title="' + date.toString() + '">' + pad(date.getHours()) +
                                    ':' + pad(date.getMinutes()) + '</abbr></td>' +
                '<td>' + trade.rate + '</td></tr>'
            );

        });

        if (new_data[0].high) {
            new_data.forEach(function(trade) {
                $scope.app.coordinate.high.push([trade.time * 1000 - time_adj, trade.high]);
            });
        }

        if (new_data[0].low) {
            new_data.forEach(function(trade) {
                $scope.app.coordinate.low.push([trade.time * 1000 - time_adj, trade.low]);
            });
        }

        $scope.app.plot.setData([
            { data: $scope.app.coordinate.real, id: 'actual', lines: {fill: false} } ,
            { data: $scope.app.coordinate.high, fillBetween: 'actual', color: "#0f0" },
            { data: $scope.app.coordinate.low, fillBetween: 'actual', color: "#f00" }
        ]);

        // Since the axes don't change, we don't need to call $scope.app.plot.setupGrid()
        $scope.app.plot.draw();

        // update ticker
        $('#value').text($scope.app.data[$scope.app.data.length-1].rate);
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
