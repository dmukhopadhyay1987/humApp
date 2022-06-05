var humclientApp = angular.module('hum', ['ngTouch', 'ngCordova', 'ngTouchstart', 'ngTouchend']);

T = 100, R = 50, ROLL_MAX = 70, PITCH_MAX = 70, ROLL_MIN = 10, PITCH_MIN = 10, YAW_MAX = 180, YAW_MIN = 10;

Partner = function(p) {
	this.id = p;
	this.req = new Req_Res();
	this.res = new Req_Res();
}

degrees = function(radians) {
	return radians * 180 / Math.PI;
}

Joystick = function(r, a) {
	this.r = r;
	this.a = a;
	this.x = r * Math.cos(a);
	this.y = r * Math.sin(a);
}

Throttle = function(t) {
	this.t = (t > 0 && t) || -t;
}

Control = function(r, a, t) {
	this.joystick = new Joystick(r, a);
	this.throttle = new Throttle(t);
}

SensorControl = function(r, p, y) {
	this.r = r;
	this.p = p;
	this.y = y;
}

Req_Res = function() {
	this.src = null;
	this.dest = null;
	this.data = {
			cart: {
				x: 0,
				y: 0
			},
			polar: {
				r: 0,
				t: 0
			},
			start: {
				x: 0,
				y: 0
			},
			coords: {
				x: 0,
				y: 0
			},
			vdo: ''
	}
	this.req_time = null;
	this.res_time = null;
	this.delay = null;
};

var htmlEntities = function(t) {
	return String(t).replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

humclientApp.factory('sensor', ['$cordovaDeviceMotion', '$cordovaDeviceOrientation', function($cordovaDeviceMotion, $cordovaDeviceOrientation) {

	return {
		options : {}, 
		setOptions : function(options) {
			this.options = options;
		},
		init : function(cb1, cb2) {
			$cordovaDeviceMotion.watchAcceleration(this.options).then(
					null,
					function(err) {},
					cb1
			);

			$cordovaDeviceOrientation.watchHeading(this.options).then(
					null,
					function(err) {},
					cb2
			);
		}
	}
}]);

humclientApp.factory('socket', ['$rootScope', function($rootScope) {

	return {
		init : function(_callback) {
			$rootScope.socket = io.connect('http://192.168.178.51:3001', { 'force new connection': true } );
			if(_callback) _callback();
		},
		emit : function(event, req) {
			$rootScope.socket.emit(event, req);
		},
		on :  function(event, _callback) {
			$rootScope.socket.on(event, function(msg) {
				if(_callback) _callback(msg);
			});
		}
	};
}]);

humclientApp.filter('to_trusted', ['$sce', function($sce){
	return function(text) {
		return $sce.trustAsHtml(htmlEntities(text));
	};
}]);

humclientApp.directive('joystick', ['$rootScope', '$document', '$cordovaDialogs', function($rootScope, $document, $cordovaDialogs) {
	return {
		restrict: 'EA',
		scope: {
			xy: '=',
			rpy: '=',
			mode: '='
		},
		link: function(scope, elem, attr) {
			var startX = 0, startY = 0, x = 0, y = 0;
			var css_control_attributes = ['top', 'left', 'background', 'box-shadow', '-moz-box-shadow', '-webkit-box-shadow'];
			var css = {
					position: 'relative',
					cursor: 'pointer'
			};
			var tot_items = 0;
			var sampling_rate = 4;

			elem.css(css);

			var getCoordinates = function(event) {
				var originalEvent = event.originalEvent || event;
				var touches = originalEvent.touches && originalEvent.touches.length ? originalEvent.touches : [originalEvent];
				var e = (originalEvent.changedTouches && originalEvent.changedTouches[0]) || touches[0];

				return {
					x: e.clientX,
					y: e.clientY
				};
			};

			var setCss = function(pressed) {

				if(pressed) {
					css[css_control_attributes[0]] = y + 'px';
					css[css_control_attributes[1]] = x + 'px';
					css[css_control_attributes[2]] = '#53ff3b';
					css[css_control_attributes[3]] = '#666 -0px 15px 15px';
					css[css_control_attributes[4]] = '#666 -0px 15px 15px';
					css[css_control_attributes[5]] = '#666 -0px 15px 15px'; 
				} else {
					css[css_control_attributes[0]] = y + 'px';
					css[css_control_attributes[1]] = x + 'px';
					css[css_control_attributes[2]] = '#9dff90';
					css[css_control_attributes[3]] = '#666 -0px 15px 35px';
					css[css_control_attributes[4]] = '#666 -0px 15px 35px';
					css[css_control_attributes[5]] = '#666 -0px 15px 35px';
				}
			};

			function polar2cartesian(R, theta) {
				return {
					'x': R * Math.cos(theta),
					'y': R * Math.sin(theta)
				}

			};

			scope.$watch('rpy', function(newVal, oldVal) {
				if(scope.mode) {
					x = newVal.r * 2;
					y = -newVal.p * 2;
					if(x*x + y*y > R*R) {
						var theta = Math.atan2(y, x);
						var real = polar2cartesian(R, theta);
						x = real.x;
						y = real.y;
					}
					setCss(true);
					elem.css(css);
					if(++tot_items % sampling_rate == 0) {
						$rootScope.$broadcast('MOVE', getControl(x, y, T * scope.xy.throttle.t));
					}
				}
			}, true);

			elem.on('mousedown touchstart', function(event) {
				// Prevent default dragging of selected content
				event.preventDefault();
				tot_items = 0;
				var coords = getCoordinates(event);
				startX = coords.x - x;
				startY = coords.y - y;
				setCss(true);
				elem.css(css);
				$document.on('mousemove touchmove', change);
				$document.on('mouseup touchend', release);
				$rootScope.$broadcast('START', getControl(x, y, T * scope.xy.throttle.t));
			});

			function change(event) {
				var coords = getCoordinates(event);
				y = coords.y - startY;
				x = coords.x - startX;
				if(x*x + y*y > R*R) {
					var theta = Math.atan2(y, x);
					var real = polar2cartesian(R, theta);
					x = real.x;
					y = real.y;
				}
				setCss(true);
				elem.css(css);
				if(++tot_items % sampling_rate == 0) {
					$rootScope.$broadcast('MOVE', getControl(x, y, T * scope.xy.throttle.t));
				}
			};

			function release() {
				tot_items = 0;
				$document.off('mousemove touchmove', change);
				$document.off('mouseup touchend', release);
				y = 0, 
				x = 0;
				setCss(false);
				elem.css(css);
				$rootScope.$broadcast('END', getControl(x, y, T * scope.xy.throttle.t));
			};
		}
	};
}]);

var getControl = function(x, y, t) {

	var a = 0;

	if(x != 0 || y != 0) {
		a = (-degrees(Math.atan2(y, x)) || 0);
		if(a > 0) {
			a = a - 90;
		} else if (a < 0) {
			if(a > -90)
				a = a - 90;
			else
				a = a + 3 * 90;
		}
	} 

	return {
		'r': (Math.sqrt(x*x + y*y)/R || 0),
		'a': a,
		't': (t/T || 0)
	};
};

// humclientApp.directive('backImage', function(){
    // return {
		// restrict: 'A',
		// link: function(scope, element, attrs){
			// var url = attrs.backImg;
			// element.css({
				// 'background': 'url( ' + url + ' ) no-repeat center center' ,
				// 'z-index': '-10'
			// });
		// };
	// } 
// });​

humclientApp.directive('throttle', ['$document', '$rootScope', function($document, $rootScope) {
	return {
		restrict: 'EA',
		scope: {
			t: '='
		},
		link: function(scope, elem, attr) {
			var startY = 0, y = 0;
			var css_control_attributes = ['top', 'background', 'box-shadow', '-moz-box-shadow', '-webkit-box-shadow'];
			var css = {
					position: 'relative',
					cursor: 'pointer'
			};
			var tot_items = 0;
			var sampling_rate = 4;
			var setCss = function(pressed) {

				if(pressed) {
					css[css_control_attributes[0]] = y + 'px';
					css[css_control_attributes[1]] = '#53ff3b';
					css[css_control_attributes[2]] = '#666 -0px 15px 15px';
					css[css_control_attributes[3]] = '#666 -0px 15px 15px';
					css[css_control_attributes[4]] = '#666 -0px 15px 15px'; 
				} else {
					css[css_control_attributes[0]] = y + 'px';
					css[css_control_attributes[1]] = '#9dff90';
					css[css_control_attributes[2]] = '#666 -0px 15px 35px';
					css[css_control_attributes[3]] = '#666 -0px 15px 35px';
					css[css_control_attributes[4]] = '#666 -0px 15px 35px';
				}
			};

			setCss(false);
			elem.css(css);

			var getCoordinates = function(event) {
				var originalEvent = event.originalEvent || event;
				var touches = originalEvent.touches && originalEvent.touches.length ? originalEvent.touches : [originalEvent];
				var e = (originalEvent.changedTouches && originalEvent.changedTouches[0]) || touches[0];

				return {
					x: e.clientX,
					y: e.clientY
				};
			};

			scope.$watch('t', function(newVal, oldVal) {
				y = -newVal * T;
				if(y < -T) {
					y = -T;
				} else if(y > 0) {
					y = 0;
				}
				setCss(true);
				elem.css(css);
				if(++tot_items % sampling_rate == 0) {
					$rootScope.$broadcast('MOVE', getControl(null, null, -y));
				}
			}, true);
			
			elem.on('mousedown touchstart', function(event) {
				// Prevent default dragging of selected content
				event.preventDefault();
				tot_items = 0;
				var coords = getCoordinates(event);
				startY = coords.y - y;
				setCss(true);
				elem.css(css);
				$document.on('mousemove touchmove', change);
				$document.on('mouseup touchend', release);
				$rootScope.$broadcast('START', getControl(null, null, y));
			});

			function change(event) {
				var coords = getCoordinates(event);
				y = coords.y - startY;
				if(y < -T) {
					y = -T;
				} else if(y > 0) {
					y = 0;
				}
				setCss(true);
				elem.css(css);
				if(++tot_items % sampling_rate == 0) {
					$rootScope.$broadcast('MOVE', getControl(null, null, y));
				}
			}

			function release() {
				if(y == 0) {
					setCss(false);
					elem.css(css);
				}
				tot_items = 0;
				$rootScope.$broadcast('END', getControl(null,null,y));
				$document.off('mousemove touchmove', change);
				$document.off('mouseup touchend', release);
			}
		}
	};
}]);