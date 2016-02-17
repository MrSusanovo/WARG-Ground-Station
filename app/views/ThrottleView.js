var Template=require('../util/Template');
var Logger=require('../util/Logger');
var TelemetryData=require('../models/TelemetryData');
var Validator=require('../util/Validator');
var Commands=require('../models/Commands');

module.exports=function(Marionette){

  return Marionette.ItemView.extend({
    template:Template('ThrottleView'),
    className:'throttleView', 

    ui:{
      throttle:'.throttle-value',
      yaw:'.yaw-value',
      yaw_setpoint:'.yaw-setpoint-value',
      flap:'.flap-value',
      roll_rate_rad:'.roll-rate-value-rad',
      pitch_rate_rad:'.pitch-rate-value-rad',
      yaw_rate_rad:'.yaw-rate-value-rad',
      roll_rate_deg:'.roll-rate-value-deg',
      pitch_rate_deg:'.pitch-rate-value-deg',
      yaw_rate_deg:'.yaw-rate-value-deg',
      throttle_input:'.throttle-form input',
      flap_input:'.flap-form input'
    },
    events:{
      'submit .flap-form':'sendSetFlapCommand',
      'submit .throttle-form':'sendSetThrottleCommand'
    },
    initialize: function(){
      this.on_telemetry_callback=null;
    },
    onRender:function(){
      this.on_telemetry_callback=this.onTelemetryCallback.bind(this);
      TelemetryData.addListener('data_received',this.on_telemetry_callback);
    },
    onTelemetryCallback: function(data){
      this.setThrottle(data.throttle_setpoint);
      this.setYaw(data.yaw);
      this.setYawSetpoint(data.int_yaw_setpoint);
      //this.setFlap(data.flap_setpoint); //NOTE: this isnt implemented yet
      this.setFlap(46.586); //TODO: remove this after

      this.setYawRate(data.yaw_rate);
      this.setRollRate(data.roll_rate);
      this.setPitchRate(data.pitch_rate);
    },
    onBeforeDestroy:function(){
      TelemetryData.removeListener('data_received',this.on_telemetry_callback);
    },
    setThrottle: function(num){
      if(Validator.isValidThrottle(num)){
        this.ui.throttle.text(Number(num).toFixed(1));
      }else{
        Logger.warn('Invalid throttle setpoint value received! Throttle:' +num);
        this.ui.throttle.text('Invalid');
      }
    },
    setYaw: function(num){
      if(Validator.isValidYaw(num)){
        this.ui.yaw.text(Number(num).toFixed(1));
      }else{
        Logger.warn('Invalid yaw value received! Yaw:'+num);
        this.ui.yaw.text('Invalid');
      }
    },
    setYawSetpoint: function(num){
      if(Validator.isValidYaw(num)){
        this.ui.yaw_setpoint.text(Number(num).toFixed(1));
      }else{
        Logger.warn('Invalid yaw setpoint value received! Yaw Setpoint: '+num);
        this.ui.yaw_setpoint.text('Invalid');
      }
    },
    setPitchRate: function(num){
      if(Validator.isValidNumber(num)){
        var rad=Number(num);
        var degrees=Number(num)*180/Math.PI;
        this.ui.pitch_rate_rad.text(rad.toFixed(1));
        this.ui.pitch_rate_deg.text(degrees.toFixed(1));
      }else{
        Logger.warn('Invalid pitch rate value received!  Pitch Rate: '+num);
        this.ui.pitch_rate_rad.text('Invalid');
        this.ui.pitch_rate_deg.text('Invalid');
      }
    },
    setYawRate: function(num){
      if(Validator.isValidNumber(num)){
        var rad=Number(num);
        var degrees=Number(num)*180/Math.PI;
        this.ui.yaw_rate_rad.text(rad.toFixed(1));
        this.ui.yaw_rate_deg.text(degrees.toFixed(1));
      }else{
        Logger.warn('Invalid yaw rate value received!  Yaw Rate: '+num);
        this.ui.yaw_rate_rad.text('Invalid');
        this.ui.yaw_rate_deg.text('Invalid');
      }
    },
    setRollRate: function(num){
      if(Validator.isValidNumber(num)){
        var rad=Number(num);
        var degrees=Number(num)*180/Math.PI;
        this.ui.roll_rate_rad.text(rad.toFixed(1));
        this.ui.roll_rate_deg.text(degrees.toFixed(1));
      }else{
        Logger.warn('Invalid roll rate value received!  Roll Rate: '+num);
        this.ui.roll_rate_rad.text('Invalid');
        this.ui.roll_rate_deg.text('Invalid');
      }
    },
    setFlap: function(num){
      if(Validator.isValidFlap(num)){
        this.ui.flap.text(Number(num).toFixed(1));
      }else{
        Logger.warn('Invalid flap setpoint value received! Flap Setpoint: '+num);
        this.ui.flap.text('Invalid');
      }
    },
    sendSetThrottleCommand: function(e){
      e.preventDefault();
      Commands.sendThrottle(this.ui.throttle_input.val());
      this.ui.throttle_input.val('');
    },
    sendSetFlapCommand: function(e){
      e.preventDefault();
      Commands.sendFlap(this.ui.flap_input.val());
      this.ui.flap_input.val('');
    }
  });
};