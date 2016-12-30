cordova.define('cordova/plugin_list', function(require, exports, module) {
module.exports = [
    {
        "file": "plugins/cordova-plugin-ble/ble.js",
        "id": "cordova-plugin-ble.BLE",
        "pluginId": "cordova-plugin-ble",
        "clobbers": [
            "evothings.ble"
        ]
    },
    {
        "file": "plugins/cordova-plugin-x-toast/www/Toast.js",
        "id": "cordova-plugin-x-toast.Toast",
        "pluginId": "cordova-plugin-x-toast",
        "clobbers": [
            "window.plugins.toast"
        ]
    },
    {
        "file": "plugins/cordova-plugin-x-toast/test/tests.js",
        "id": "cordova-plugin-x-toast.tests",
        "pluginId": "cordova-plugin-x-toast"
    },
    {
        "file": "plugins/hu.dpal.phonegap.plugins.PinDialog/www/pin.js",
        "id": "hu.dpal.phonegap.plugins.PinDialog.PinDialog",
        "pluginId": "hu.dpal.phonegap.plugins.PinDialog",
        "merges": [
            "window.plugins.pinDialog"
        ]
    },
    {
        "file": "plugins/cordova-plugin-dialogs/www/notification.js",
        "id": "cordova-plugin-dialogs.notification",
        "pluginId": "cordova-plugin-dialogs",
        "merges": [
            "navigator.notification"
        ]
    },
    {
        "file": "plugins/cordova-plugin-listpicker/www/ListPicker.js",
        "id": "cordova-plugin-listpicker.ListPicker",
        "pluginId": "cordova-plugin-listpicker",
        "clobbers": [
            "window.plugins.listpicker"
        ]
    },
    {
        "file": "plugins/cordova-plugin-statusbar/www/statusbar.js",
        "id": "cordova-plugin-statusbar.statusbar",
        "pluginId": "cordova-plugin-statusbar",
        "clobbers": [
            "window.StatusBar"
        ]
    },
    {
        "file": "plugins/com.verso.cordova.clipboard/www/clipboard.js",
        "id": "com.verso.cordova.clipboard.Clipboard",
        "pluginId": "com.verso.cordova.clipboard",
        "clobbers": [
            "cordova.plugins.clipboard"
        ]
    },
    {
        "file": "plugins/cordova-plugin-cszbar/www/zbar.js",
        "id": "cordova-plugin-cszbar.zBar",
        "pluginId": "cordova-plugin-cszbar",
        "clobbers": [
            "cloudSky.zBar"
        ]
    }
];
module.exports.metadata = 
// TOP OF METADATA
{
    "cordova-plugin-statusbar": "2.0.0",
    "com.verso.cordova.clipboard": "0.1.0",
    "cordova-plugin-cszbar": "1.3.2"
}
// BOTTOM OF METADATA
});