
const Applet = imports.ui.applet;
const ModalDialog = imports.ui.modalDialog;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Settings = imports.ui.settings;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const uuid = "brightness-and-gamma-applet@cardsurf";
const AppletDirectory = imports.ui.appletManager.applets[uuid];
const AppletGui = AppletDirectory.appletGui;
const AppletConstants = AppletDirectory.appletConstants
const ShellUtils = AppletDirectory.shellUtils;
const Files = AppletDirectory.files;
const FilesCsv = AppletDirectory.filesCsv;
const MinXrandrVersion = 1.4;
const MinRandrVersion = 1.2;

// Translation support
Gettext.bindtextdomain(uuid, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(uuid, str);
}

function Output(output_name, is_connected) {
    this._init(output_name, is_connected);
};

Output.prototype = {
    _init: function(output_name, is_connected) {
        this.output_name = output_name;
        this.is_connected = is_connected;
    },
}

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
};

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.panel_orientation = orientation;
        this.applet_directory = this._get_applet_directory();
        this.values_directory = this.applet_directory + "values/";
        this.is_running = true;

        this.screen_outputs = {};
        this.menu_item_screen_position = 0;
        this.menu_item_output_position = 1;
        this.menu_item_screen = null;
        this.menu_item_output = null;
        this.menu_sliders = null;
        this.file_schema = "file://";
        this.home_shortcut = "~";
        this.xrandr_name = "xrandr";
        this.randr_name = "RandR";
        this.xrandr_regex = new RegExp(this.xrandr_name, "i");
        this.randr_regex = new RegExp(this.randr_name, "i");
        this.version_regex = new RegExp("[0-9]+[\.][0-9]+","i");
        this.screen_regex = new RegExp("screen.*:","i");
        this.number_regex = new RegExp("[0-9]+","");
        this.output_line_separator = " ";
        this.output_name_index = 0;
        this.output_status_index = 1;
        this.output_connected = "connected";
        this.output_disconnected = "disconnected";
        this.gamma_separator = ":";
        this.filepath_last_values = "";
        this.file_last_values = null;

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.default_screen_name = "";
        this.default_output_index = -1;
        this.minimum_brightness = 10;
        this.maximum_brightness = 100;
        this.minimum_gamma = 10;
        this.maximum_gamma = 100;
        this.default_save_every = 60;
        this.screen_name = this.default_screen_name;
        this.output_index = this.default_output_index;
        this.brightness = this.maximum_brightness;
        this.gamma_red = this.maximum_gamma;
        this.gamma_green = this.maximum_gamma;
        this.gamma_blue = this.maximum_gamma;
        this.save_every = this.default_save_every;
        this.update_scroll = true;
        this.scroll_step = 5;
        this.options_type = AppletConstants.OptionsType.ALL;
        this.gui_icon_filepath = "";
        this.apply_startup = true;
        this.apply_every = 0;

        this._init_dependencies_satisfied();
    },

    _get_applet_directory: function() {
        let directory = GLib.get_home_dir() + "/.local/share/cinnamon/applets/" + uuid + "/";
        return directory;
    },

    _init_dependencies_satisfied: function () {
        let satisfied = this._check_dependencies();
        if(satisfied) {
            this._run_dependencies_satisfied();
        }
    },

    _check_dependencies: function() {
        return this._check_xrandr() && this._check_randr();
    },

    _check_xrandr: function() {
        let xrandr_satisfied = this._xrandr_available() && this._xrandr_version_satisfied();
        if(!xrandr_satisfied) {
            let dependencies = this._get_dependencies(this.xrandr_name, MinXrandrVersion);
            this._show_dialog_dependencies(dependencies);
            return false;
        }
        return true;
    },

    _xrandr_available: function() {
        let process = new ShellUtils.ShellOutputProcess(["which", this.xrandr_name]);
        let output = process.spawn_sync_and_get_output();
        return output.length > 0;
    },

    _xrandr_version_satisfied: function() {
        let lines = this._get_xrandr_version_lines();
        let line = this.get_line_or_empty_string(lines, this.xrandr_regex);
        return this._is_version_satisfied(line, MinXrandrVersion);
    },

    _get_xrandr_version_lines: function() {
        let process = new ShellUtils.ShellOutputProcess([this.xrandr_name, "--version"]);
        let output = process.spawn_sync_and_get_output();
        let lines = output.split('\n');
        return lines;
    },

    get_line_or_empty_string: function(lines, regex) {
        for(let line of lines) {
            if(regex.test(line)) {
                return line;
            }
        }
        return "";
    },

    _is_version_satisfied: function(line, min_version) {
        if(this.version_regex.test(line)) {
            let matches = line.match(this.version_regex);
            let version_match = matches[0];
            return parseFloat(version_match) >= min_version;
        }
        return false;
    },

    _get_dependencies: function(dependency, min_version) {
        return ">= " + dependency + " " + min_version;
    },

    _show_dialog_dependencies: function(dependencies) {
        let dialog_message = uuid + "\n\n" + _("The following packages were not found:") + "\n\n" +
                             dependencies + "\n\n" + _("Please install the above packages to use the applet");
        let dialog = new ModalDialog.NotifyDialog(dialog_message);
        dialog.open();
    },

    _check_randr: function() {
        let randr_satisfied = this._randr_version_satisfied();
        if(!randr_satisfied) {
            let dependencies = this._get_dependencies(this.randr_name, MinRandrVersion);
            this._show_dialog_dependencies(dependencies);
            return false;
        }
        return true;
    },

    _randr_version_satisfied: function() {
        let lines = this._get_xrandr_version_lines();
        let line = this.get_line_or_empty_string(lines, this.randr_regex);
        return this._is_version_satisfied(line, MinRandrVersion);
    },







    _run_dependencies_satisfied: function () {
        this._init_layout();
        this._bind_settings();
        this._connect_signals();
        this._init_filepaths();
        this._init_files();
        this._init_values();
        this._init_screen_outputs();
        this._init_screen_output();
        this._init_context_menu();
        this._init_menu_sliders();
        this._init_gui();
        this._update_xrandr_startup();

        this.run();
    },

    _init_layout: function () {
        this._enable_hotizontal_vertical_layout();
    },

    _enable_hotizontal_vertical_layout: function() {
        let supported = this.is_vertical_layout_supported();
        if(supported) {
            this._try_enable_hotizontal_vertical_layout();
        }
    },

    is_vertical_layout_supported: function() {
        return this._is_set_allowed_layout_defined();
    },

    _is_set_allowed_layout_defined: function() {
        return this.is_function_defined(this.setAllowedLayout);
    },

    is_function_defined: function(reference) {
        return typeof reference === "function";
    },

    _try_enable_hotizontal_vertical_layout: function() {
        try {
             this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        }
        catch(e) {
            global.log("Error while enabling vertical and horizontal layout: " + e);
        }
    },

    _bind_settings: function () {
        for(let [binding, property_name, callback] of [
                        [Settings.BindingDirection.IN, "apply_startup", null],
                        [Settings.BindingDirection.IN, "apply_every", null],
                        [Settings.BindingDirection.IN, "save_every", null],
                        [Settings.BindingDirection.IN, "update_scroll", null],
                        [Settings.BindingDirection.IN, "scroll_step", null],
                        [Settings.BindingDirection.IN, "minimum_brightness", this.on_brightness_range_changed],
                        [Settings.BindingDirection.IN, "maximum_brightness", this.on_brightness_range_changed],
                        [Settings.BindingDirection.IN, "minimum_gamma", this.on_gamma_range_changed],
                        [Settings.BindingDirection.IN, "maximum_gamma", this.on_gamma_range_changed],
                        [Settings.BindingDirection.IN, "options_type", this.on_options_type_changed],
                        [Settings.BindingDirection.IN, "gui_icon_filepath", this.on_gui_icon_changed] ]){
                this.settings.bindProperty(binding, property_name, property_name, callback, null);
        }
    },

    on_brightness_range_changed: function () {
        let value = this.get_range_value(this.minimum_brightness, this.maximum_brightness, this.brightness);
        let outside = this.brightness != value;
        this.brightness = value;
        this.menu_sliders.update_items_brightness();
        this.update_brightness_active(outside);
    },

    get_range_value: function (min_value, max_value, value) {
        if(value < min_value) {
            return min_value;
        }
        if(value > max_value) {
            return max_value;
        }
        return value;
    },

    update_brightness_active: function (outside) {
        let active = this.is_brightness_active();
        if(active) {
            this.update_xrandr_outside(outside);
        }
    },

    is_brightness_active: function () {
        return this.options_type == AppletConstants.OptionsType.ALL ||
               this.options_type == AppletConstants.OptionsType.BRIGHTNESS;
    },

    update_xrandr_outside: function (outside) {
        if(outside) {
            this.update_xrandr();
        }
    },

    on_gamma_range_changed: function () {
        let outside = false;
        outside = this.on_gamma_red_range_changed() || outside;
        outside = this.on_gamma_green_range_changed() || outside;
        outside = this.on_gamma_blue_range_changed() || outside;
        this.update_gamma_active(outside);
    },

    on_gamma_red_range_changed: function () {
        let value = this.get_range_value(this.minimum_gamma, this.maximum_gamma, this.gamma_red);
        let outside = this.gamma_red != value;
        this.gamma_red = value;
        this.menu_sliders.update_items_gamma_red();
        return outside;
    },

    on_gamma_green_range_changed: function () {
        let value = this.get_range_value(this.minimum_gamma, this.maximum_gamma, this.gamma_green);
        let outside = this.gamma_green != value;
        this.gamma_green = value;
        this.menu_sliders.update_items_gamma_green();
        return outside;
    },

    on_gamma_blue_range_changed: function () {
        let value = this.get_range_value(this.minimum_gamma, this.maximum_gamma, this.gamma_blue);
        let outside = this.gamma_blue != value;
        this.gamma_blue = value;
        this.menu_sliders.update_items_gamma_blue();
        return outside;
    },

    update_gamma_active: function (outside) {
        let active = this.is_gamma_active();
        if(active) {
            this.update_xrandr_outside(outside);
        }
    },

    is_gamma_active: function () {
        return this.options_type == AppletConstants.OptionsType.ALL ||
               this.options_type == AppletConstants.OptionsType.GAMMA;
    },

    on_options_type_changed: function () {
        this._init_menu_sliders();
    },

    on_gui_icon_changed: function () {
        this.set_gui_icon();
    },

    set_gui_icon: function () {
        let path = this.remove_file_schema(this.gui_icon_filepath);
        path = this.replace_tilde_with_home_directory(path);
        let exists = this.file_exists(path);
        if (exists) {
            this.set_applet_icon_path(path);
        }
    },

    remove_file_schema: function (path) {
        path = path.replace(this.file_schema, "");
        return path;
    },

    replace_tilde_with_home_directory: function (path) {
        let home_directory = GLib.get_home_dir();
        path = path.replace(this.home_shortcut, home_directory);
        return path;
    },

    file_exists: function (path) {
        return GLib.file_test(path, GLib.FileTest.EXISTS);
    },

    _connect_signals: function() {
        try {
            this.actor.connect('scroll-event', Lang.bind(this, this.on_mouse_scroll));
        }
        catch(e) {
            global.log("Error while connecting signals: " + e);
        }
    },

    on_mouse_scroll: function(actor, event) {
        if(this.update_scroll) {
            let direction = event.get_scroll_direction();
            if (direction == Clutter.ScrollDirection.UP) {
                this.increase_brightness_scroll();
            }
            else {
                this.decrease_brightness_scroll();
            }
        }
    },

    increase_brightness_scroll: function() {
        let value = this.brightness + this.scroll_step;
        this.update_brightness_scroll(value);
    },

    update_brightness_scroll: function(value) {
        value = this.get_range_value(this.minimum_brightness, this.maximum_brightness, value);
        if(value != this.brightness) {
            this.update_brightness(value);
            this.menu_sliders.update_items_brightness();
        }
    },

    decrease_brightness_scroll: function() {
        let value = this.brightness - this.scroll_step;
        this.update_brightness_scroll(value);
    },

    // Override
    on_applet_clicked: function(event) {
        this.menu_sliders.toggle();
    },

    // Override
    on_applet_removed_from_panel: function() {
        this.save_last_values();
        this.is_running = false;
    },

    _init_gui: function () {
        this.set_gui_icon();
    },

    _init_screen_outputs: function () {
        let lines = this.list_screen_outputs();
        lines =  lines.split('\n');

        for(let i = 0; i < lines.length; ++i) {
            let line = lines[i];
            if(this._is_screen_line(line)) {
                let screen_name = this._parse_screen_name(line);
                let start_index = i + 1;
                let outputs = this._parse_outputs(lines, start_index);
                this.screen_outputs[screen_name] = outputs;
                i += outputs.length;
            }
        }
    },

    list_screen_outputs: function () {
        let process = new ShellUtils.ShellOutputProcess([this.xrandr_name, "--query"]);
        let output = process.spawn_sync_and_get_output();
        return output;
    },

    _is_screen_line: function (line) {
        return this.screen_regex.test(line);
    },

    _parse_screen_name: function (line) {
        let matches = line.match(this.screen_regex);
        let screen_name = matches[0];
        let last_character_index = screen_name.length - 1;
        screen_name = screen_name.substring(0, last_character_index);
        return screen_name;
    },

    _parse_outputs: function (lines, start_index) {
        let outputs = [];
        for(let i = start_index; i < lines.length; ++i) {
            let line = lines[i];
            if(this._is_output_line(line)) {
                let output = this._parse_output(line);
                outputs.push(output);
            }
            else if(this._is_screen_line(line)) {
                break;
            }
        }
        return outputs;
    },

    _is_output_line: function (line) {
        let strings = line.split(this.output_line_separator);
        return strings.length >= 2 && (strings[this.output_status_index] == this.output_connected ||
                                       strings[this.output_status_index] == this.output_disconnected);
    },

    _parse_output: function (line) {
        let strings = line.split(this.output_line_separator);
        let output_name = strings[this.output_name_index];
        let is_connected = strings[this.output_status_index] == this.output_connected ? true : false;
        let output = new Output(output_name, is_connected);
        return output;
    },

    _init_screen_output: function () {
        let is_default = this.is_screen_output_default();
        if(is_default) {
            this.set_connected_screen();
        }
    },

    is_screen_output_default: function () {
        return this.screen_name == this.default_screen_name && this.output_index == this.default_output_index;
    },

    set_connected_screen: function () {
        for(let screen_name in this.screen_outputs) {
            let outputs = this.screen_outputs[screen_name];
            if(this.set_connected_output(outputs)) {
                this.screen_name = screen_name;
                return true;
            }
        }
        return false;
    },

    set_connected_output: function (outputs) {
        for(let i = 0; i < outputs.length; ++i) {
            let output = outputs[i];
            if(output.is_connected) {
                this.output_index = i;
                return true;
            }
        }
        return false;
    },

    _init_filepaths: function () {
        this.filepath_last_values = this.values_directory + 'last_values.csv';
    },

    _init_files: function () {
        this.file_last_values = new FilesCsv.LastValuesFileCsv(this.filepath_last_values);
        if(!this.file_last_values.exists()) {
            this.file_last_values.create();
        }
    },

    _init_values: function () {
        this.load_last_values();
    },

    load_last_values: function() {
        try {
            let rows = this.file_last_values.get_last_value_rows();
            if(rows.length > 0) {
                let row = rows[0];
                this.screen_name = row.screen_name;
                this.output_index = row.output_index;
                this.brightness = row.brightness;
                this.gamma_red = row.gamma_red;
                this.gamma_green = row.gamma_green;
                this.gamma_blue = row.gamma_blue;
            }
        }
        catch(e) {
            global.log("Error while loading last values from a file: " + e);
        }
    },

    _init_context_menu: function () {
        this._init_menu_item_screen();
        this._init_menu_item_output();
    },

    _init_menu_item_screen: function () {
        let screen_names = this.get_screen_names();
        this.menu_item_screen = new AppletGui.RadioMenuItem(_("Screen"), screen_names);
        this.menu_item_screen.set_callback_option_clicked(this, this.on_menu_item_screen_clicked);
        this.set_menu_item_screen_option();
        this._applet_context_menu.addMenuItem(this.menu_item_screen, this.menu_item_screen_position);
    },

    get_screen_names: function () {
        let screen_names = [];
        for(let screen_name in this.screen_outputs) {
            screen_names.push(screen_name);
        }
        return screen_names;
    },

    on_menu_item_screen_clicked: function (option_name, option_index) {
        if(this.screen_name != option_name) {
            this.screen_name = option_name;
            this._update_menu_item_output();
            this.update_xrandr();
        }
    },

    set_menu_item_screen_option: function () {
        let valid = this.is_screen_valid();
        if(valid) {
            this.menu_item_screen.set_active_option_name(this.screen_name);
        }
    },

    is_screen_valid: function () {
        return this.dictionary_contains(this.screen_outputs, this.screen_name);
    },

    dictionary_contains: function (dictionary, key) {
        return key in dictionary;
    },

    _update_menu_item_output: function (screen_name) {
        this.menu_item_output.destroy();
        this._init_menu_item_output();
    },

    _init_menu_item_output: function () {
        let output_names = this.get_output_names();
        this.menu_item_output = new AppletGui.RadioMenuItem(_("Output"), output_names);
        this.menu_item_output.set_callback_option_clicked(this, this.on_menu_item_output_clicked);
        this.set_menu_item_output_option();
        this._applet_context_menu.addMenuItem(this.menu_item_output, this.menu_item_output_position);
    },

    get_output_names: function () {
        let valid = this.is_screen_valid();
        if(valid) {
            let outputs = this.screen_outputs[this.screen_name];
            return outputs.map(function(output) { return output.output_name; });
        }
        return [];
    },

    on_menu_item_output_clicked: function (option_name, option_index) {
        if(this.output_index != option_index) {
            this.output_index = option_index;
            this.update_xrandr();
        }
    },

    set_menu_item_output_option: function () {
        let valid = this.is_screen_output_valid();
        if(valid) {
            this.menu_item_output.set_active_option_index(this.output_index);
        }
    },

    is_screen_output_valid: function () {
        return this.is_screen_valid() && this.is_output_valid();
    },

    is_output_valid: function () {
        return this.output_index >= 0 && this.output_index < this.screen_outputs[this.screen_name].length;
    },

    _init_menu_sliders: function () {
        this.menu_sliders = new AppletGui.MenuSliders(this, this.panel_orientation);
    },

    update_brightness: function(value) {
        this.brightness = value;
        this.update_xrandr();
    },

    update_gamma_red: function(value) {
        this.gamma_red = value;
        this.update_xrandr();
    },

    update_gamma_green: function(value) {
        this.gamma_green = value;
        this.update_xrandr();
    },

    update_gamma_blue: function(value) {
        this.gamma_blue = value;
        this.update_xrandr();
    },

    _update_xrandr_startup: function () {
        if(this.apply_startup) {
            this.update_xrandr();
        }
    },

    update_xrandr: function () {
        let valid = this.is_screen_output_valid();
        if(valid) {
            let argv = this.get_xrandr_argv();
            this.spawn_xrandr_process(argv);
        }
    },

    get_xrandr_argv: function () {
        let screen_parameter = this._get_screen_parameter();
        let output_parameter = this._get_output_parameter();
        let brightness_parameter = this._get_brightness_parameter();
        let gamma_parameter = this._get_gamma_parameter();

        let argv = [this.xrandr_name, "--screen", screen_parameter,
                                      "--output", output_parameter,
                                      "--brightness", brightness_parameter,
                                      "--gamma", gamma_parameter];
        return argv;
    },

    _get_screen_parameter: function() {
        let matches = this.number_regex.test(this.screen_name) ? this.screen_name.match(this.number_regex) : ["0"];
        let screen_index = matches.length > 0 ? matches[0] : "0";
        let parameter = screen_index.toString();
        return parameter;
    },

    _get_output_parameter: function() {
        let output = this.get_active_output();
        let parameter = output.output_name;
        return parameter;
    },

    get_active_output: function () {
        let outputs = this.screen_outputs[this.screen_name];
        let output = outputs[this.output_index];
        return output;
    },

    _get_brightness_parameter: function() {
        return this._get_scaled_parameter(this.brightness);
    },

    _get_scaled_parameter: function(number) {
        number = number / 100;
        let parameter = number.toString();
        return parameter;
    },

    _get_gamma_parameter: function() {
        let parameter_red = this._get_scaled_parameter(this.gamma_red);
        let parameter_green = this._get_scaled_parameter(this.gamma_green);
        let parameter_blue = this._get_scaled_parameter(this.gamma_blue);
        let parameter = parameter_red + this.gamma_separator + parameter_green + this.gamma_separator + parameter_blue;
        return parameter;
    },

    spawn_xrandr_process: function (argv) {
        let xrandr_process = new ShellUtils.ShellOutputProcess(argv);
        let output = xrandr_process.spawn_sync_and_get_error();
        if(output > 0) {
            global.log("Error while updating brightness and gamma: " + output + ". Command line arguments: " + argv);
        }
    },






    run: function () {
        this._run_apply_values_running();
        this._run_save_last_values_running();
    },

    _run_apply_values_running: function () {
        if(this.is_running) {
            this._apply_values();
        }
    },

    _apply_values: function () {
        if(this.apply_every > 0) {
            this.update_xrandr();
            Mainloop.timeout_add(1000 * this.apply_every, Lang.bind(this, this._run_apply_values_running));
        }
        else {
            Mainloop.timeout_add(1000, Lang.bind(this, this._run_apply_values_running));
        }
    },

    _run_save_last_values_running: function () {
        if(this.is_running) {
            this._run_save_last_values();
        }
    },

    _run_save_last_values: function () {
        if(this.save_every > 0) {
            this.save_last_values();
            Mainloop.timeout_add(this.save_every * 1000, Lang.bind(this, this._run_save_last_values_running));
        }
    },

    // Save last values to a CSV file instead of using Settings.bind function to prevent high CPU usage in Cinnamon 3.2+
    save_last_values: function() {
        try {
            let rows = [ new FilesCsv.LastValuesRowCsv(this.screen_name, this.output_index, this.brightness,
                                                       this.gamma_red, this.gamma_green, this.gamma_blue)   ];
            this.file_last_values.overwrite(rows);
        }
        catch(e) {
            global.log("Error while saving last values to a file: " + e);
        }
    },

};








function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
    return myApplet;
}



