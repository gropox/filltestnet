const global = require("basescript");

const log = global.getLogger("users");

const CONFIG = global.CONFIG;

const USER_NAMES = {
    fish: [],
    minnow: [],
    dolphin: [],
    orca: [],
    whale: []
}

function pad(num) {
    var s = "000000000" + num;
    return s.substr(s.length - 5);
}

function _generateNames() {
    for (let species in CONFIG.user_distribution) {
        for (let i = 0; i < CONFIG.user_distribution[species]; i++) {
            USER_NAMES[species].push(species + pad(i));
        }
    }
}

function getUserNames(species) {
    return USER_NAMES[species];
}

_generateNames();

module.exports.getUserNames = getUserNames;