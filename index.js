var Service, Characteristic;
var request = require("request");
var pollingtoevent = require('polling-to-event');

const DEF_MIN_TEMPERATURE = -100,
	  DEF_MAX_TEMPERATURE = 100,
	  DEF_TIMEOUT = 5000;

module.exports = function(homebridge){
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	homebridge.registerAccessory("homebridge-http", "Http", HttpAccessory);
}


	function HttpAccessory(log, config) {
		this.log = log;

		// url info
		this.on_url                 = config["on_url"];
		this.on_body                = config["on_body"];
		this.off_url                = config["off_url"];
		this.off_body               = config["off_body"];
		this.status_url             = config["status_url"];
		this.setstatus_url          = config["setstatus_url"];
		this.temperature_url        = config["temperature_url"];
		this.brightness_url         = config["brightness_url"];
		this.brightness_urlup       = config["brightness_urlup"];
		this.brightness_urldown     = config["brightness_urldown"];

		this.brightnesslvl_url      = config["brightnesslvl_url"];
		this.http_method            = config["http_method"] 	  	 	|| "GET";;
		this.http_brightness_method = config["http_brightness_method"]  || this.http_method;
		this.username               = config["username"] 	  	 	 	|| "";
		this.password               = config["password"] 	  	 	 	|| "";
		this.sendimmediately        = config["sendimmediately"] 	 	|| "";
		this.service                = config["service"] 	  	 	 	|| "Switch";
		this.name                   = config["name"];
		this.brightnessHandling     = config["brightnessHandling"] 	 	|| "no";
		this.switchHandling 		= config["switchHandling"] 		 	|| "no";
		
		//realtime polling info
		this.state = false;
		this.currentlevel = 0;
		var that = this;
		
		// Status Polling, if you want to add additional services that don't use switch handling you can add something like this || (this.service=="Smoke" || this.service=="Motion"))
		if (this.status_url && this.switchHandling =="realtime") {
			var powerurl = this.status_url;
			var statusemitter = pollingtoevent(function(done) {
				that.httpRequest(powerurl, "", "GET", that.username, that.password, that.sendimmediately, function(error, response, body) {
					if (error) {
						that.log('HTTP get power function failed: %s', error.message);
						callback(error);
					} else {
						done(null, body);
					}
				})
			}, {longpolling:true,interval:5000,longpollEventName:"statuspoll"});

			statusemitter.on("statuspoll", function(data) {       
				var binaryState = parseInt(data);
				that.state = binaryState > 0;
				that.log(that.service, "received power",that.status_url, "state is currently", binaryState); 
				// switch used to easily add additonal services
				switch (that.service) {
					case "Switch":
						if (that.switchService ) {
							that.switchService .getCharacteristic(Characteristic.On)
							.setValue(that.state);
						}
						break;

					case "Light":
						if (that.lightbulbService) {
							that.lightbulbService.getCharacteristic(Characteristic.On)
							.setValue(that.state);
						}		
						break;	
					case "Fan":
						if (that.fanService) {
							that.fanService.getCharacteristic(Characteristic.On)
							.setValue(that.state);
						}		
						break;	
					case "Outlet":
						if (that.outletService) {
							that.outletService.getCharacteristic(Characteristic.On)
							.setValue(that.state);
						}		
						break;	

					case "TemperatureSensor":
						if (that.temperatureService) {
							that.temperatureService.getCharacteristic(Characteristic.CurrentTemperature)
							.setValue(that.state);
						}
						break;	

					case "HumiditySensor":
						if (that.humidityService) {
							that.humidityService.getCharacteristic(Characteristic.CurrentTemperature)
							.setValue(that.state);
						}
						break;			

					case "AirQualitySensor":
						if (that.airqualityService) {
							that.airqualityService.getCharacteristic(Characteristic.AirQuality)
							.setValue(that.state);
						}
						break;						

					case "LightsSensor":
						if (that.lightsService) {
							that.lightsService.getCharacteristic(Characteristic.CurrentAmbientLightLevel)
							.setValue(that.state);
						}
						break;						

					case "Thermostat":
						if (that.thermostatService) {
							that.thermostatService.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
							.setValue(that.CurrentHeatingCoolingState);
						}		
						break;			
					case "StatelessProgrammableSwitch":
						if (that.serviceStatelessProgrammableSwitch) {
							that.serviceStatelessProgrammableSwitch.getCharacteristic(Characteristic.ProgrammableSwitchEvent)
							.setValue(that.ProgrammableSwitchEvent);
						}		
						break;									
					}        
		});

	}
	// Brightness Polling
	if (this.brightnesslvl_url && this.brightnessHandling =="realtime") {
		var brightnessurl = this.brightnesslvl_url;
		var levelemitter = pollingtoevent(function(done) {
				that.httpRequest(brightnessurl, "", "GET", that.username, that.password, that.sendimmediately, function(error, response, responseBody) {
					if (error) {
							that.log('HTTP get power function failed: %s', error.message);
							return;
					} else {               				    
						done(null, responseBody);
					}
				}) // set longer polling as slider takes longer to set value
		}, {longpolling:true,interval:2000,longpollEventName:"levelpoll"});

		levelemitter.on("levelpoll", function(data) {  
			that.currentlevel = parseInt(data);

			if (that.lightbulbService) {				
				that.log(that.service, "received brightness",that.brightnesslvl_url, "level is currently", that.currentlevel); 		        
				that.lightbulbService.getCharacteristic(Characteristic.Brightness)
				.setValue(that.currentlevel);
			}        
		});
	}
	}

	HttpAccessory.prototype = {

	httpRequest: function(url, body, method, username, password, sendimmediately, callback) {
		request({
			url: url,
			body: body,
			method: method,
			rejectUnauthorized: false,
			auth: {
				user: username,
				pass: password,
				sendImmediately: sendimmediately
			}
		},
		function(error, response, body) {
			callback(error, response, body)
		})
	},

	getTemperature: function (callback) {
		var ops = {
		 uri:    this.temperature_url,
		 method: this.http_method,
		 timeout: this.timeout
		};
		this.log('Requesting temperature on "' + ops.uri + '", method ' + ops.method);
		request(ops, (error, res, body) => {
			var value = null;
			if (error) {
				this.log('HTTP bad response (' + ops.uri + '): ' + error.message);
				} 
			else {
				try {
					value = JSON.parse(body).temperature;
					if (value < this.minTemperature || value > this.maxTemperature || isNaN(value)) {
						throw "Invalid value received";
					}
					this.log('HTTP successful response: ' + body);
				} 
				catch (parseErr) {
					this.log('Error processing received information: ' + parseErr.message);
					error = parseErr;
					}
			}
		callback(error, value);
		});
		},


	getHumidity: function (callback) {
		var ops = {
		 uri:    this.status_url,
		 method: this.http_method,
		 timeout: this.timeout
		};
		this.log('Requesting humidity on "' + ops.uri + '", method ' + ops.method);
		request(ops, (error, res, body) => {
			var value = null;
			if (error) {
				this.log('HTTP bad response (' + ops.uri + '): ' + error.message);
				} 
			else {
				try {
					value = JSON.parse(body).humidity;
					if (isNaN(value)) {
						throw "Invalid value received";
					}
					this.log('HTTP successful response: ' + body);
				} 
				catch (parseErr) {
					this.log('Error processing received information: ' + parseErr.message);
					error = parseErr;
					}
			}
		callback(error, value);
		});
		},

	getLights: function (callback) {
		var ops = {
		 uri:    this.status_url,
		 method: this.http_method,
		 timeout: this.timeout
		};
		this.log('Requesting lights state on "' + ops.uri + '", method ' + ops.method);
		request(ops, (error, res, body) => {
			var value = null;
			if (error) {
				this.log('HTTP bad response (' + ops.uri + '): ' + error.message);
				} 
			else {
				try {
					value = JSON.parse(body).light;
					this.log(value);
					if (value == "dark") {value = 1}
					if (value == "normal") {value = 50}
					if (value == "hight") {value = 100}
					if (isNaN(value)) {
						throw "Invalid value received";
					}
					this.log('HTTP successful response: ' + body);
				} 
				catch (parseErr) {
					this.log('Error processing received information: ' + parseErr.message);
					error = parseErr;
					}
			}
		callback(error, value);
		});
		},

	getAirQuality: function (callback) {
		var ops = {
		 uri:    this.status_url,
		 method: this.http_method,
		 timeout: this.timeout
		};
		this.log('Requesting air quality state on "' + ops.uri + '", method ' + ops.method);
		request(ops, (error, res, body) => {
			var value = null;
			if (error) {
				this.log('HTTP bad response (' + ops.uri + '): ' + error.message);
				} 
			else {
				try {
					value = JSON.parse(body).air_quality;
					if (value == "unknown") {value = 0}
					if (value == "excellent") {value = 1}
					if (value == "good") {value = 2}
					if (value == "fair") {value = 3}
					if (value == "inferior") {value = 4}
					if (value == "poor") {value = 5}
					if (isNaN(value)) {
						throw "Invalid value received";
					}
					this.log('HTTP successful response: ' + body);
				} 
				catch (parseErr) {
					this.log('Error processing received information: ' + parseErr.message);
					error = parseErr;
					}
			}
		callback(error, value);
		});
		},


	setPowerState: function(powerOn, callback) {
		var url;
		var body;
		
		if (!this.on_url || !this.off_url) {
				this.log.warn("Ignoring request; No power url defined.");
				callback(new Error("No power url defined."));
				return;
		}
		
		if (powerOn) {
			url = this.on_url;
			body = this.on_body;
			this.log("Setting power state to on");
		} 


		else {
			url = this.off_url;
			body = this.off_body;
			this.log("Setting power state to off");
		}
		
		this.httpRequest(url, body, this.http_method, this.username, this.password, this.sendimmediately, function(error, response, responseBody) {
			if (error) {
			this.log('HTTP set power function failed: %s', error.message);
			callback(error);
			} else {
			this.log('HTTP set power function succeeded!');
			callback();
			}
		}.bind(this));
	},
  
    getPowerState: function(callback) {
		if (!this.status_url) {
			this.log.warn("Ignoring request; No status url defined.");
			callback(new Error("No status url defined."));
			return;
		}
	
		var url = this.status_url;
		this.log("Getting power state");

		this.httpRequest(url, "", "GET", this.username, this.password, this.sendimmediately, function(error, response, responseBody) {
		if (error) {
			this.log('HTTP get power function failed: %s', error.message);
			callback(error);
		} else {
			var binaryState = parseInt(responseBody);
			var powerOn = binaryState > 0;
			this.log("Power state is currently %s", binaryState);
			callback(null, powerOn);
		}
		}.bind(this));
	},

    getHeatingCoolingState: function(callback) {
		if (!this.status_url) {
			this.log.warn("Ignoring request; No status url defined.");
			callback(new Error("No status url defined."));
			return;
		}
	
		var url = this.status_url;
		this.log("Getting power state");

		this.httpRequest(url, "", "GET", this.username, this.password, this.sendimmediately, function(error, response, responseBody) {
		if (error) {
			this.log('HTTP get power function failed: %s', error.message);
			callback(error);
		} else {
			var binaryState = parseInt(responseBody);
			var powerOn = binaryState > 0;
			this.log("Thermostat current mode is %s", binaryState);
			callback(null, binaryState);
		}
		}.bind(this));
	},


	setHeatingCoolingState: function(powerOn, callback) {
		var url;
		var body;
		
		powerOn = parseInt(powerOn)
		
		if (!isNaN(powerOn)) {

			if (powerOn) {
				url = this.on_url;
				body = this.on_body;
				this.log("Setting power state to %s", powerOn);
			}

			else {
				url = this.off_url;
				body = this.off_body;
				this.log("Setting power state to off : %s", powerOn);
			}

			


			this.httpRequest(url, body, this.http_method, this.username, this.password, this.sendimmediately, function(error, response, responseBody) {
			if (error) {
			this.log('HTTP set power function failed: %s', error.message);
			callback(error);
			} else {
			url = this.setstatus_url;
			this.httpRequest(url + '/' + powerOn, body, this.http_method, this.username, this.password, this.sendimmediately, function(error, response, responseBody) {});
			this.log('HTTP set power function succeeded!');
			if (callback) {callback();}			
			}
			}.bind(this));


		}

	},

	getBrightness: function(callback) {
		if (!this.brightnesslvl_url) {
			this.log.warn("Ignoring request; No brightness level url defined.");
			callback(new Error("No brightness level url defined."));
			return;
		}		
			var url = this.brightnesslvl_url;
			this.log("Getting Brightness level");
	
			this.httpRequest(url, "", "GET", this.username, this.password, this.sendimmediately, function(error, response, responseBody) {
			if (error) {
				this.log('HTTP get brightness function failed: %s', error.message);
				callback(error);
			} else {			
				var binaryState = parseInt(responseBody);
				var level = binaryState;
				this.log("brightness state is currently %s", binaryState);
				callback(null, level);
			}
			}.bind(this));
	  },

	setBrightness: function(level, callback) {
		if (!this.brightness_url) {
			this.log.warn("Ignoring request; No brightness url defined.");
			callback(new Error("No brightness url defined."));
			return;
		}    
		
		if (parseInt(level) > 50) {
			var url = this.brightness_urlup; }
		else {
			var url = this.brightness_urldown; 
		}

	
		this.log("Setting brightness to %s", level);
	
		this.httpRequest(url, "", this.http_brightness_method, this.username, this.password, this.sendimmediately, function(error, response, body) {
		if (error) {
			this.log('HTTP brightness function failed: %s', error);
			callback(error);
		} else {
			this.log('HTTP brightness function succeeded!');
			callback();
		}
		}.bind(this));
	},

	identify: function(callback) {
		this.log("Identify requested!");
		callback(); // success
	},

	getServices: function() {
		
		var that = this;
		
		// you can OPTIONALLY create an information service if you wish to override
		// the default values for things like serial number, model, etc.
		var informationService = new Service.AccessoryInformation();

		informationService
		.setCharacteristic(Characteristic.Manufacturer, "HTTP Manufacturer")
		.setCharacteristic(Characteristic.Model, "HTTP Model")
		.setCharacteristic(Characteristic.SerialNumber, "HTTP Serial Number");
	
		switch (this.service) {
		case "Switch": 
			this.switchService = new Service.Switch(this.name);
			switch (this.switchHandling) {	
				//Power Polling
				case "yes":
					this.switchService
					.getCharacteristic(Characteristic.On)
					.on('get', this.getPowerState.bind(this))
					.on('set', this.setPowerState.bind(this));
					break;
				case "realtime":
					this.switchService
					.getCharacteristic(Characteristic.On)
					.on('get', function(callback) {callback(null, that.state)})
					.on('set', this.setPowerState.bind(this));
					break;
				default	:	
					this.switchService
					.getCharacteristic(Characteristic.On)	
					.on('set', this.setPowerState.bind(this));
					break;}
					return [this.switchService];
		case "Light":	
			this.lightbulbService = new Service.Lightbulb(this.name);
			switch (this.switchHandling) {
			//Power Polling
			case "yes" :
				this.lightbulbService
				.getCharacteristic(Characteristic.On)
				.on('get', this.getPowerState.bind(this))
				.on('set', this.setPowerState.bind(this));
				break;
			case "realtime":
				this.lightbulbService
				.getCharacteristic(Characteristic.On)
				.on('get', function(callback) {callback(null, that.state)})
				.on('set', this.setPowerState.bind(this));
				break;
			default:		
				this.lightbulbService
				.getCharacteristic(Characteristic.On)	
				.on('set', this.setPowerState.bind(this));
				break;
			}
		
			// Brightness Polling 
			if (this.brightnessHandling == "realtime") {
				this.log("REALTIME");
				this.lightbulbService 
				.addCharacteristic(new Characteristic.Brightness())
				.on('get', function(callback) {callback(null, that.currentlevel)})
				.on('set', this.setBrightness.bind(this));
			} else if (this.brightnessHandling == "yes") {
				this.lightbulbService
				.addCharacteristic(new Characteristic.Brightness())
			//	.on('get', this.getBrightness.bind(this))
				.on('set', this.setBrightness.bind(this));
			}
	
			return [informationService, this.lightbulbService];
			break;		

		case "StatelessProgrammableSwitch":	
			this.statelessProgrammableSwitchService = new Service.StatelessProgrammableSwitch(this.name);
			switch (this.switchHandling) {
			//Power Polling
			case "yes" :
				this.statelessProgrammableSwitchService
				.getCharacteristic(Characteristic.ProgrammableSwitchEvent)
				.on('get', this.getPowerState.bind(this))
			//	.on('set', this.setPowerState.bind(this));
				break;
			case "realtime":
				this.statelessProgrammableSwitchService
				.getCharacteristic(Characteristic.ProgrammableSwitchEvent)
				//.on('get', function(callback) {callback(null, that.state)})
				//.on('set', this.setPowerState.bind(this));
				break;
			default:		
				this.statelessProgrammableSwitchService
				.getCharacteristic(Characteristic.ProgrammableSwitchEvent)	
				//.on('set', this.setPowerState.bind(this));
				break;
			}	


		case "TemperatureSensor":
			this.temperatureService = new Service.TemperatureSensor(this.name);
			this.temperatureService
				.getCharacteristic(Characteristic.CurrentTemperature)
				.on('get', this.getTemperature.bind(this))
				.setProps({
					 minValue: this.minTemperature,
					 maxValue: this.maxTemperature
				});
			return [this.temperatureService];

		case "HumiditySensor":
			this.humidityService = new Service.HumiditySensor(this.name);
			this.humidityService
				.getCharacteristic(Characteristic.CurrentRelativeHumidity)
				.on('get', this.getHumidity.bind(this))
			return [this.humidityService];

		case "AirQualitySensor":
			this.airqualityService = new Service.AirQualitySensor(this.name);
			this.airqualityService
				.getCharacteristic(Characteristic.AirQuality)
				.on('get', this.getAirQuality.bind(this))
			return [this.airqualityService];

		case "LightsSensor":
			this.lightsService = new Service.LightSensor(this.name);
			this.lightsService
				.getCharacteristic(Characteristic.CurrentAmbientLightLevel)
				.on('get', this.getLights.bind(this))
			return [this.lightsService];


		case "Fan": 
			this.fanService = new Service.Fan(this.name);
			switch (this.switchHandling) {	
				//Power Polling
				case "yes":
					this.fanService
					.getCharacteristic(Characteristic.On)
					.on('get', this.getPowerState.bind(this))
					.on('set', this.setPowerState.bind(this));
					break;
				case "realtime":
					this.fanService
					.getCharacteristic(Characteristic.On)
					.on('get', function(callback) {callback(null, that.state)})
					.on('set', this.setPowerState.bind(this));
					break;
				default	:	
					this.fanService
					.getCharacteristic(Characteristic.On)	
					.on('set', this.setPowerState.bind(this));
					break;}
					return [this.fanService];

		case "Outlet": 
			this.outletService = new Service.Outlet(this.name);
			switch (this.switchHandling) {	
				//Power Polling
				case "yes":
					this.outletService
					.getCharacteristic(Characteristic.On)
					.on('get', this.getPowerState.bind(this))
					.on('set', this.setPowerState.bind(this));
					break;
				case "realtime":
					this.outletService
					.getCharacteristic(Characteristic.On)
					.on('get', function(callback) {callback(null, that.state)})
					.on('set', this.setPowerState.bind(this));
					break;
				default	:
					this.outletService
					.getCharacteristic(Characteristic.On)	
					.on('set', this.setPowerState.bind(this));
					break;}
					return [this.outletService];
		
		case "Thermostat": 
			this.thermostatService = new Service.Thermostat(this.name);
			switch (this.switchHandling) {	
				//Power Polling
				case "yes":
					this.thermostatService
						.getCharacteristic(Characteristic.CurrentTemperature)
						.on('get', this.getTemperature.bind(this));					
					this.thermostatService
						.getCharacteristic(Characteristic.TargetTemperature)
						.on('get', this.getTemperature.bind(this));
					this.thermostatService
						.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
						.on('get', this.getHeatingCoolingState.bind(this))
					this.thermostatService
						.getCharacteristic(Characteristic.TargetHeatingCoolingState)
						.on('set', this.setHeatingCoolingState.bind(this))
						.on('change', this.setHeatingCoolingState.bind(this), this.setHeatingCoolingState.bind(this));
					break;
				case "realtime":
					this.thermostatService
						.getCharacteristic(Characteristic.CurrentTemperature)
						.on('get', this.getTemperature.bind(this));
					this.thermostatService
						.getCharacteristic(Characteristic.TargetTemperature)
						.on('get', this.getTemperature.bind(this));						
					this.thermostatService
						.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
						.on('get', function(callback) {callback(null, that.CurrentHeatingCoolingState)})
					this.thermostatService
						.getCharacteristic(Characteristic.TargetHeatingCoolingState)
						.on('set', this.setHeatingCoolingState.bind(this))
						.on('change', this.setHeatingCoolingState.bind(this), this.setHeatingCoolingState.bind(this));
					break;
				default	:
					this.thermostatService
						.getCharacteristic(Characteristic.CurrentTemperature)
						.on('get', this.getTemperature.bind(this));
					this.thermostatService
						.getCharacteristic(Characteristic.TargetTemperature)
						.on('get', this.getTemperature.bind(this));						
					this.thermostatService
						.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
						.on('get', this.getHeatingCoolingState.bind(this))
						this.thermostatService
						.getCharacteristic(Characteristic.TargetHeatingCoolingState)
						.on('set', this.setHeatingCoolingState.bind(this))
						.on('change', this.setHeatingCoolingState.bind(this), this.setHeatingCoolingState.bind(this));
					break;}
					return [this.thermostatService];




		}
	}
};
