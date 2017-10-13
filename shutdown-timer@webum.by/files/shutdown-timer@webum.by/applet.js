//Shutdown-timer applet with timer

const Cinnamon = imports.gi.Cinnamon;
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const ModalDialog = imports.ui.modalDialog;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;


const Gettext = imports.gettext;
const _ = Gettext.gettext;



function ConfirmDialog(){
    this._init();
}

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
	__proto__: Applet.TextIconApplet.prototype,

	_init: function(orientation) {        
		Applet.TextIconApplet.prototype._init.call(this, orientation);

    		this.ArrayActions = {};
		this.ArrayActions['lock-screen'] = 'Lock screen';
		this.ArrayActions['log-out'] = 'Log Out';
		this.ArrayActions['suspend'] = 'Suspend';
		this.ArrayActions['hibernate'] = 'Hibernate';
		this.ArrayActions['restart'] = 'Restart';
		this.ArrayActions['shutdown'] = 'Shutdown';
		this.ArrayActions['restart-cinnamon'] = 'Restart Cinnamon';

    		this.ArrayIcons = {};
		this.ArrayIcons['lock-screen'] = 'system-lock-screen';
		this.ArrayIcons['log-out'] = 'system-log-out';
		this.ArrayIcons['suspend'] = 'system-lock-screen';
		this.ArrayIcons['hibernate'] = 'system-shutdown';
		this.ArrayIcons['restart'] = 'reload';
		this.ArrayIcons['shutdown'] = 'system-shutdown';
		this.ArrayIcons['restart-cinnamon'] = 'reload';


		this.setting = new Gio.Settings({ schema: 'org.cinnamon.applets.shutdown-timer@webum.by'});
		this.enable_label = this.setting.get_boolean('show-time-on-panel');
		
		this.timerDuration = 0;
    		this.timerStopped = true;
		this.applet_event = '';
		this.sec = 60;
		


    		this.set_applet_icon_symbolic_name("system-shutdown");
    		this.set_applet_tooltip(_("Shutdown-timer"));
		this.set_applet_label('');

   		this.menuManager = new PopupMenu.PopupMenuManager(this);
    		this.Mymenu = new Applet.AppletPopupMenu(this, orientation);
			
		this.timerMenuItem = new PopupMenu.PopupMenuItem(_("Minutes")+": 0         ", { reactive: false });
    		this.Mymenu.addMenuItem(this.timerMenuItem);	



		this.timerSlider = new PopupMenu.PopupSliderMenuItem(0);
       		this.timerSlider.connect('value-changed', Lang.bind(this, this.sliderChanged));
		
	        this.Mymenu.addMenuItem(this.timerSlider); 


		this.Mymenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

         	this.menuManager.addMenu(this.Mymenu);
                this.menuActions = new PopupMenu.PopupMenuSection(this);
		this.Mymenu.addMenuItem(this.menuActions);
		this.create_menu_actions();


		this.Mymenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());	

		this.timerSwitch = new PopupMenu.PopupSwitchMenuItem(_("Timer"));
    		this.timerSwitch.connect('toggled', Lang.bind(this, this.doTimerSwitch));
    		this.Mymenu.addMenuItem(this.timerSwitch);

    		this.MenuSettings = new PopupMenu.PopupMenuSection(this);
		this.createContextMenu();
		this._applet_context_menu.addMenuItem(this.MenuSettings);

    	},


    	on_applet_clicked: function(event) {
        	this.Mymenu.toggle();   
    	}, 


	create_menu_actions: function() {
		this.menuActions.removeAll();
		let items = this.setting.get_string('order').split(',');
		for (let i=0; i<items.length; i++) {
			let item = items[i];
			if (this.setting.get_boolean(item)) {
				this.menuActions.addAction(_(this.ArrayActions[item]), Lang.bind(this, function(event) {this.doEvent(item);}));
			}
		}
	},


	createContextMenu: function () {
		this.MenuSettings.removeAll();
		let switchButton = new PopupMenu.PopupSwitchMenuItem(_('Show time on panel'));
		switchButton.setToggleState(this.setting.get_boolean('show-time-on-panel'));
    		switchButton.connect('toggled', Lang.bind(this, this.set_label));

		this.MenuSettings.addMenuItem(switchButton);
		this.MenuSettings.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		let items = this.setting.get_string('order').split(',');
		for (let i=0; i<items.length; i++) {
			let item = items[i];
			let switchButton = new PopupMenu.PopupSwitchMenuItem(_(this.ArrayActions[item]));
			switchButton.setToggleState(this.setting.get_boolean(item));
    			switchButton.connect('toggled', Lang.bind(this, function(event) {this.switchEvent(item);}));
			this.MenuSettings.addMenuItem(switchButton);
		}
    		
	},
  
   	set_label: function() {
		this.setting.set_boolean('show-time-on-panel', !this.setting.get_boolean('show-time-on-panel'));
		this.enable_label = this.setting.get_boolean('show-time-on-panel');
		if (!this.enable_label) {this.set_applet_label('');}
		else {this.set_applet_label(this.timerDuration.toString());}
	},	

//----------------------------------------
// ----> timer 
//----------------------------------------


    	doStartTimer: function() {
		if (this.timerDuration == 0) return;
		if (this.timerDuration >= 60) {this.timerLastValue = 60;}
		else if (this.timerDuration >= 30) {this.timerLastValue = 30;}
		else if (this.timerDuration >= 15) {this.timerLastValue = 15;}
		else if (this.timerDuration >= 10) {this.timerLastValue = 10;}
		else if (this.timerDuration >= 5) {this.timerLastValue = 5;}
		else if (this.timerDuration >= 2) {this.timerLastValue = 2;}
		else if (this.timerDuration >= 1) {this.timerLastValue = 1;}

		this.timerStopped = false;

		this.timerSwitch.setToggleState(true);
		this.startTime = this.getCurrentTime();
		this.endTime = this.startTime + this.timerDuration * 60 * 1000;
		if (this.timerDuration != this.timerLastValue){
			Util.spawnCommandLine("notify-send -i " + this.ArrayIcons[this.applet_event] + " 'Shutdown applet:' 'To " + this.ArrayActions[this.applet_event] +" left '" + this.timerDuration + "' minutes'");
		}
		if (this.enable_label) {this.set_applet_label(this.timerDuration.toString());}
		this.doUpdateUI();
    	},


	doTimerSwitch: function(item) {
        	if (item.state) {
            		if (this.timerDuration == 0 || this.timerStopped) {
                		this.timerSwitch.setToggleState(false);
                		return;
            		}         
        	} 
		else {
            		this.doStopTimer();
		}
    	},

         
    	getCurrentTime: function() {
        	let d = new Date();
	    	let x = Math.floor(d.getTime());
	    	return x;
    	},

    	doStopTimer: function() {
        	this.timerSwitch.setToggleState(false);
		this.set_applet_tooltip(_('Shutdown-timer'));
		this.set_applet_label('');
		this.timerDuration = 0;
		this.timerSlider.setValue(0);
		this.timerMenuItem.label.text = _('Minutes')+": 0         ";
		Util.spawnCommandLine("notify-send -i dialog-information 'Shutdown applet:' 'The timer has been stopped'");
		this.timerStopped = true;
        	
    	},

	doUpdateUI: function() {
        	if (this.timerStopped) return;

        	this.timerDuration = Math.round( (this.endTime - this.getCurrentTime()) / 60000);
		let message = '';
		if (this.timerDuration <= 1) {
			message = "notify-send -i " + this.ArrayIcons[this.applet_event] + " 'Shutdown applet:' 'To " + this.ArrayActions[this.applet_event] +" left " + this.sec.toString() + " seconds'";
			switch (this.sec) {
				case 60:
					this.sec = 30;
					break;

				case 30:
					this.sec = 15;
					break;

				case 15:
					this.sec = 16;
					break;

				case 16:
					this.doTimerExpired();
					return;
					break;					
			}
		}
		else {
			this.sec = 60;
			message = "notify-send -i " + this.ArrayIcons[this.applet_event] + " 'Shutdown applet:' 'To " + this.ArrayActions[this.applet_event] +" left '" + this.timerDuration + "' minutes'";
		}

        	

        	let timeStr = "Minutes to " + this.ArrayActions[this.applet_event] +": " + this.timerDuration;
		this.timerMenuItem.label.text = timeStr;
        	this.set_applet_tooltip(_(timeStr));
		
		if(this.timerLastValue == this.timerDuration) {
			Util.spawnCommandLine(message);
			switch (this.timerDuration) {
				case 60:
					this.timerLastValue = 30;
			  		break;
				case 30:
					this.timerLastValue = 15;
			  		break;
				case 15:
					this.timerLastValue = 10;
			  		break;
				case 10:
					this.timerLastValue = 5;
			  		break;
				case 5:
					this.timerLastValue = 2;
			  		break;
				case 2:
					this.timerLastValue = 1;

			  		break;
				case 1:
					this.timerLastValue = 0;
			  		break;
			}
		}
		if (this.enable_label) {this.set_applet_label(this.timerDuration.toString());}
        	Mainloop.timeout_add_seconds(this.sec, Lang.bind(this, this.doUpdateUI));
    	},

   	doTimerExpired: function() {
		this.doStopTimer();
		this.doEventFinal();   
    	},

    	sliderChanged: function(slider, value) {

		if (!this.timerStopped) {this.doStopTimer();}
		let position = parseFloat(value);
		this.timerDuration = Math.round(position/0.8333 * 100);

		if (this.timerDuration != 0) {
			this.timerMenuItem.label.text = _("Minutes to <click action>") + ": " + this.timerDuration;
		}	
		else {
			this.timerMenuItem.label.text = _('Minutes')+": 0         ";
		}
    	},

//----------------------------------------
// <------
//----------------------------------------



//----------------------------------------
// ----> actions events 
//----------------------------------------

	switchEvent: function (item) {
		this.setting.set_boolean(item, !this.setting.get_boolean(item));
		//this.createContextMenu();
		this.create_menu_actions();
	},

	doEvent: function(action) {
		this.applet_event=action;

		if (this.timerDuration==0 && this.timerStopped) {
			this.doEventFinal();	
		}
		else {
			this.doStartTimer();	
		}
	},



	doEventFinal: function() {
		switch (this.applet_event) {
			case 'lock-screen':
				Util.spawnCommandLine("dbus-send --session --print-reply --type=method_call --dest=org.gnome.ScreenSaver /org/gnome/ScreenSaver org.gnome.ScreenSaver.Lock");
		  		break;

			case 'log-out':
		  		Util.spawnCommandLine("dbus-send --session --print-reply --type=method_call --dest=org.gnome.SessionManager /org/gnome/SessionManager org.gnome.SessionManager.Logout uint32:1");
		  		break;

			case 'suspend':
		  		Util.spawnCommandLine("dbus-send --system --print-reply --dest=org.freedesktop.UPower /org/freedesktop/UPower org.freedesktop.UPower.Suspend");
		  		break;

			case 'hibernate':
				Util.spawnCommandLine("dbus-send --system --print-reply --dest=org.freedesktop.UPower /org/freedesktop/UPower org.freedesktop.UPower.Suspend");
		  		break;

			case 'restart':
				Util.spawnCommandLine("dbus-send --system --print-reply --dest=org.freedesktop.ConsoleKit /org/freedesktop/ConsoleKit/Manager org.freedesktop.ConsoleKit.Manager.Restart");
		  		break;

			case 'shutdown':
		  		Util.spawnCommandLine("dbus-send --system --print-reply --dest=org.freedesktop.ConsoleKit /org/freedesktop/ConsoleKit/Manager org.freedesktop.ConsoleKit.Manager.Stop");
		  		break;

			case 'restart-cinnamon':
		  		global.reexec_self();
		  		break;
		}
		
	},

//###########################################################


};


function main(metadata, orientation) {  
    let myApplet = new MyApplet(orientation);
    return myApplet;      
}
