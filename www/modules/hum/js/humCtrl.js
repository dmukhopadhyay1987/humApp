var app = angular.module('hum');

app.controller('humCtrl', ['$scope', '$cordovaDialogs', 'sensor', 'socket', function($scope, $cordovaDialogs, sensor, socket) {

	var initialHeading = 0;
	var initialHeadingSet = false;
	
	var adjustLimits = function(val, min, max) {
		return (Math.abs(val) < min ? 
				0 :
					(Math.abs(val) > Math.abs(max) ? 
							(val > 0 ?
									max :
										-max):
											val));
	};

	var calculateRoll = function(x, y, z) {
		return R * adjustLimits(degrees(Math.atan2(y, z)), ROLL_MIN, ROLL_MAX) / ROLL_MAX;
	};

	var calculatePitch = function(x, y, z) {
		return R * adjustLimits(degrees(Math.atan2((- x) , Math.sqrt(y * y + z * z))), PITCH_MIN, PITCH_MAX) / PITCH_MAX;
	};

	var calculateYaw = function(h) {
		if(!initialHeadingSet && h != 0) {
			initialHeadingSet = true;
			initialHeading = h;
		}
		h = h - initialHeading;
		h = adjustLimits((h > 180 ? (h - 360) : h), YAW_MIN, YAW_MAX);
		return h;
	};
	
	var rp_change = function(result) {
		$scope.root.model.sensor.r = calculateRoll(result.x, result.y, result.z);
		$scope.root.model.sensor.p = calculatePitch(result.x, result.y, result.z);
		if(!$scope.$$phase) $scope.$apply();
	};

	var y_change = function(result) {
		$scope.root.model.sensor.y = calculateYaw(result.magneticHeading);
		if(!$scope.$$phase) $scope.$apply();
	}

	var processFeedback = function(d) {
		data = d.feedback; 
		var x = data[2] - data[0];
		var y = data[3] - data[1];

		var theta = degrees(Math.atan2(y, x));
		var r = Math.sqrt(x*x + y*y);

		var ret = {
				motor: data,
				res_vector: {
					y: y,
					x: x,
					r: r,
					a: theta
				}
		}

		return ret;
	}

	$scope.init = function() {

		socket.init(function() {
			socket.on('id', function(id) {
				$scope.root.model.id = id;
				if(!$scope.$$phase) $scope.$apply();
			});
			
			socket.on('online', function(online) {
				$scope.root.model.online = {}
				for(var o in online) {
					$scope.root.model.online[online[o]] = new Partner(online[o]);
				}
				$scope.root.model.partner = $scope.root.model.online[online[0]].id;
				if(!$scope.$$phase) $scope.$apply();
				console.log($scope.root.model.online);
			});

			socket.on('new_online', function(new_online) {
				$scope.root.model.online[new_online] = new Partner(new_online);
				if(!$scope.$$phase) $scope.$apply();
			});

			socket.on('control_feedback', function(res) {
				var res_time = new Date().getTime();
				res.res_time = res_time;
				$scope.root.model.online[res.src].res = res;
				res.delay = res.res_time - res.req_time;
				$scope.root.model.control.feedback = processFeedback(res.data);
				if(!$scope.$$phase) $scope.$apply();
			});
			
			socket.on('vdo_feedback', function(res) {
				var res_time = new Date().getTime();
				res.res_time = res_time;
				$scope.root.model.vdo_src = res.data.vdo;
				if(!$scope.$$phase) $scope.$apply();
			});
			
		});
		
		sensor.setOptions($scope.root.model.options);
		sensor.init(rp_change, y_change);
	};
	
	$scope.$on('START', $scope.root.refresh);
	$scope.$on('MOVE', $scope.root.refresh);
	$scope.$on('END', $scope.root.refresh);

	$scope.init();
}]);