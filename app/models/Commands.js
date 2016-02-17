// An singleton that contains and manages the sending of picpilot commands
var picpilot_config=require('../../config/picpilot-config');
var Network=require('../Network');
var Logger=require('../util/Logger');
var Validator=require('../util/Validator');

var Commands={
  checkConnection: function(){ //to make sure the data relay connection exists first (otherwise we'll prob get weird errors)
    if(Network.connections['data_relay']){
      return true;
    }
    else{
      Logger.warn('Cannot send command as the data_relay connection has not yet been established');
      return false;
    }
  },
  sendProtectedCommand:function(command){
    Network.connections['data_relay'].write(command+':'+picpilot_config.get('command_password')+'\r\n');
  },
  sendCommand: function(command, value){
    if(this.checkConnection()){
      Network.connections['data_relay'].write(command+':'+value+'\r\n');
    }
  },
  sendRoll: function(roll){
    if(Validator.isValidRoll(roll)){
      this.sendCommand('set_rollAngle',roll);
    }
    else{
      Logger.error('Command to not sent since invalid roll value detected! Roll:'+roll);
    }
  },
  sendPitch: function(pitch){
    if(Validator.isValidPitch(pitch)){
      this.sendCommand('set_pitchAngle',pitch);
    }
    else{
      Logger.error('Command to not sent since invalid pitch value detected! Pitch:'+pitch);
    }
  },
  sendHeading: function(heading){
    if(Validator.isValidHeading(heading)){
      this.sendCommand('set_heading',heading);
    }
    else{
      Logger.error('Command to not sent since invalid heading value detected! Heading:'+heading);
    }
  },
  sendAltitude:function(altitude){
    if(Validator.isValidAltitude(altitude)){
      this.sendCommand('set_altitude',altitude);
    }
    else{
      Logger.error('Command to not sent since invalid altitude value detected! Altitude:'+altitude);
    }
  },
  sendThrottle:function(throttle){
    if(Validator.isValidThrottle(throttle)){
      this.sendCommand('set_throttle',throttle);
    }
    else{
      Logger.error('Command to not sent since invalid throttle value detected! Throttle:'+throttle);
    }
  },
  sendFlap:function(flap){
    if(Validator.isValidFlap(flap)){
      this.sendCommand('set_flap',flap);
    }
    else{
      Logger.error('Command to not sent since invalid flap value detected! Flap Setpoint:'+flap);
    }
  },
  sendKPGain: function(type,gain){
    if(Validator.isValidNumber(gain)){
      this.sendCommand('set_'+type+'KPGain',gain);
    }
    else{
      Logger.error('Command to not sent since invalid gain value detected! Gain value:'+gain);
    }
  },
  sendKIGain: function(type, gain){
    if(Validator.isValidNumber(gain)){
      this.sendCommand('set_'+type+'KIGain',gain);
    }
    else{
      Logger.error('Command to not sent since invalid gain value detected! Gain value:'+gain);
    }
  },
  sendKDGain: function(type, gain){
    if(Validator.isValidNumber(gain)){
      this.sendCommand('set_'+type+'KDGain',gain);
    }
    else{
      Logger.error('Command to not sent since invalid gain value detected! Gain value:'+gain);
    }
  },
  sendPathGain: function(gain){
    if(Validator.isValidNumber(gain)){
      this.sendCommand('set_pathGain',gain);
    }
    else{
      Logger.error('Command to not sent since invalid path gain value detected! Gain value:'+gain);
    }
  },
  sendOrbitGain: function(gain){
    if(Validator.isValidNumber(gain)){
      this.sendCommand('set_orbitGain',gain);
    }
    else{
      Logger.error('Command to not sent since invalid orbit gain value detected! Gain value:'+gain);
    }
  },
  showGain: function(value){
    if(Validator.isValidNumber(value)){
      this.sendCommand('set_showGain',value);
    }
    else{
      Logger.error('Command to not sent since invalid show gain value detected! Value:'+value);
    }
  }
}

module.exports=Commands;