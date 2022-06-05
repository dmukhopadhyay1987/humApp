var app = angular.module('hum');

app.controller('rootCtrl', ['$scope', '$cordovaDialogs', '$interval', 'socket', function($scope, $cordovaDialogs, $interval, socket) {

	$scope.util = {

			isVoidString : function(s) {
				return !(s != null && angular.isDefined(s) && s !== undefined && s!== "undefined" && s !== "");
			},
			isVoidArray : function(a) {
				return !(a != null && angular.isDefined(a) && a !== undefined && a !== "undefined" && a.length > 0);
			},
			degrees: function(radians) {
				return radians * 180 / Math.PI;
			}
	};

	$scope.root = {
			model: {
				id: '',
				modeSensor: true,
				partner: '',
				f_time: 0,
				t_promise: null,
				in_flight_promise: null, 
				online: {},
				control : {
					joystick: {
						x: 0,
						y: 0,
						r: 0,
						a: 0
					},
					throttle: {
						t: 0
					}
				},
				sensor: {
					r: '',
					p: '',
					y: ''
				},
				options: {
					frequency: 100
				},
				vdo: false,
				vdo_src: ''
			},
			getRequest: function() {
				var partner = new Partner($scope.root.model.partner);
				var req_time = new Date().getTime();
				partner.req.src = $scope.root.model.id;
				partner.req.dest = partner.id;
				partner.req.req_time = req_time;
				return partner.req;
			},
			refresh: function get(e, control) {
				$scope.root.model.control = new Control(control.r, control.a, control.t);
				var req = $scope.root.getRequest();
				req.data = $scope.root.model.control;
				$scope.root.control(req);
				if(!$scope.$$phase) $scope.$apply();
			},
			control : function(data) {
				socket.emit('control', data);
			},
			throttleUp : function() {
				if($scope.root.model.t_promise){
					$interval.cancel($scope.root.model.t_promise);
				}
				$scope.root.model.t_promise = $interval(function () { 
					if($scope.root.model.control.throttle.t < 1) {
						$scope.root.model.control.throttle.t += 0.01;
					}
				}, 100);
			},
			throttleDn : function() {
				if($scope.root.model.t_promise){
					$interval.cancel($scope.root.model.t_promise);
				}
				$scope.root.model.t_promise = $interval(function () { 
					if($scope.root.model.control.throttle.t > 0) {
						$scope.root.model.control.throttle.t -= 0.01;
					}
				}, 100);
			},
			throttleRlz : function() {
				$interval.cancel($scope.root.model.t_promise);
				$scope.root.model.t_promise = null;
			},
			init : function() {
				socket.init();
			}

	};

	$scope.$watch('root.model.control.throttle.t', function(val) {
		
		if(val > 0 && $scope.root.model.in_flight_promise == null) {
			$scope.root.model.in_flight_promise = $interval(function () {
				$scope.root.model.f_time += 100;
			}, 100);
			var req = $scope.root.getRequest();
			req.data = {};
			socket.emit('vdo_start', req);
		} else if(val <= 0 && $scope.root.model.in_flight_promise != null) {
			$interval.cancel($scope.root.model.in_flight_promise);
			$scope.root.model.in_flight_promise = null;
			$scope.root.model.f_time = 0;
			var req = $scope.root.getRequest();
			req.data = {};
			socket.emit('vdo_stop', req);
		}
		
	}, true);

}]);