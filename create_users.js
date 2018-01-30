const ga = require("golos-addons");
const global = ga.global;
const golosjs = ga.golos.golos;

global.initApp("filltestnet", "config.json5");

const log = global.getLogger("index.js");

const CONFIG = global.CONFIG;

ga.golos.setWebsocket(CONFIG.websocket);
ga.golos.setChainId(CONFIG.chain_id);
ga.golos.setPrefix(CONFIG.prefix);

const Users = require("./users");

const OPS_PER_TRANSACTION = 25;

let OPERATIONS = [];

const GP = {
    fish: "100.000 GOLOS",
    minnow: "1000.000 GOLOS",
    dolphin: "10000.000 GOLOS",
    orca: "100000.000 GOLOS",
    whale: "1000000.000 GOLOS"
}

async function account_create(species, new_account_name) {
    const account_create = ["account_create", {
        fee: GP[species],
        creator: CONFIG.initminer.account,
        new_account_name,
        owner: CONFIG.user.keys.owner,
        active: CONFIG.user.keys.active,
        posting: CONFIG.user.keys.posting,
        memo_key: CONFIG.user.keys.memo_key,
        json_metadata: JSON.stringify({})
    }];
    log.trace(account_create);
    OPERATIONS.push(account_create);
}


async function _prepareTransaction(tx) {
    const properties = await golosjs.api.getDynamicGlobalPropertiesAsync();
    const chainDate = new Date(properties.time + 'Z');
    const refBlockNum = properties.head_block_number - 3 & 0xFFFF;

    const block = await golosjs.api.getBlockAsync(properties.head_block_number - 2);
    const headBlockId = block.previous;
    return Object.assign({
        ref_block_num: refBlockNum,
        ref_block_prefix: new Buffer(headBlockId, 'hex').readUInt32LE(4),
        expiration: new Date(chainDate.getTime() + 60 * 1000)
    }, tx);
};

async function send(tx, privKeys) {
    var transaction = await _prepareTransaction(tx);
    log.debug('Signing transaction (transaction, transaction.operations)', transaction, transaction.operations);
    const signedTransaction = golosjs.auth.signTransaction(transaction, privKeys);
    log.debug('Broadcasting transaction (transaction, transaction.operations)', transaction, transaction.operations);
    await golosjs.api.broadcastTransactionWithCallbackAsync(function () { }, signedTransaction);
};

async function commit() {
    if (OPERATIONS.length > 0) {
        log.info("commit", OPERATIONS.length);
        try {
            await send(
                {
                    extensions: [],
                    operations: OPERATIONS
                },
                { "active": CONFIG.initminer.keys.active });
            OPERATIONS = [];
            return;
        } catch (e) {
            log.error("Ошибка отправки транзакции", e);
            process.exit(1);
        }
    }    
}

async function createUsers(species, userList) {
    log.info("create", species, userList.length);
    for (let u of userList) {
        account_create(species, u);
        if (OPERATIONS.length >= OPS_PER_TRANSACTION) {
            await commit();
            OPERATONS = [];
        }
    }
    if (OPERATIONS.length > 0) {
        await commit();
        OPERATIONS = [];
    }
}




async function run() {
    for (let species of ["whale", "orca", "dolphin", "minnow", "fish"]) {
        log.debug(species, Users.getUserNames(species).length);
        await createUsers(species, Users.getUserNames(species))
    }

    log.info("DONE");
    process.exit(0);
}


run();