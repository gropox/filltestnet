const fs = require("fs");

const global = require("basescript");

const CONFIG = global.CONFIG;
const golosjs = require("golos-js");

//const golosjs = require("steem");

//golosjs.config.set("websocket", CONFIG.websocket);
//golosjs.config.set("address_prefix", CONFIG.prefix);
//golosjs.config.set("chain_id", CONFIG.chain_id);

const log = global.getLogger("dopost");

let OPERATIONS = [];
let TR_COUNTER = 1;

async function write_op_log(opBody) {
    fs.appendFile("op.log", JSON.stringify({
        tr_nr : TR_COUNTER,
        parent_author: opBody.parent_author,
        parent_permlink: opBody.parent_permlink,
        author: opBody.author,
        permlink: opBody.permlink
    })+"\n", function (err) {
        if (err) throw err;
    });    
}

async function push_op(op) {
    OPERATIONS.push(op);
}

async function comment(parent_author, parent_permlink, author, permlink, title, body, json_metadata) {
    log.info("add comment", author, permlink, parent_author, parent_permlink);
    log.info("\tOPERATIONS", OPERATIONS.length);
    for (let op of OPERATIONS) {
        log.info("tr op", op[0]);
        if (op[0] == "comment") {
            if (
                op[1].parent_author == parent_author
                && op[1].parent_permlink == parent_permlink
                && op[1].author == author
                && op[1].permlink == permlink
            ) {
                log.warn("duplicate", JSON.stringify(op[1]));
                return;
            }
        }
    }
    log.info("\tadded comment");
    const op = ["comment",
    {
        parent_author,
        parent_permlink,
        author,
        permlink,
        title,
        body,
        json_metadata : JSON.stringify(json_metadata)
    }];
    push_op(op);
}


async function comment_payout_beneficiaries(
    author,
    permlink,
    max_accepted_payout,
    percent_steem_dollars,
    allow_votes,
    allow_curation_rewards,
    comment_payout_beneficiaries) {
    return;

    const comment_options = [
        "comment_options",
        {
            author,
            permlink,
            max_accepted_payout,
            percent_steem_dollars,
            allow_votes,
            allow_curation_rewards,
            extensions: [
                [0, comment_payout_beneficiaries]
            ]
            
        }
    ];
    OPERATIONS.push(comment_options);
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

async function execute(key) {
    if (OPERATIONS.length > 0) {
        for (let op of OPERATIONS) {
            if (op[0] == "comment") {
                write_op_log(op[1]);
            }
        }
        try {
            log.debug("execute OPERATIONS", TR_COUNTER, OPERATIONS);
            await send(
                {
                    extensions: [],
                    operations: OPERATIONS
                },
                { "posting": key });
            OPERATIONS = [];
            TR_COUNTER++;
            log.debug("ops after", OPERATIONS.length);
            return;
        } catch (e) {
            log.error("Ошибка отправки транзакции", OPERATIONS, e);
            process.exit(1);
        }
    }

}

module.exports.push_op = push_op;
module.exports.comment = comment;
module.exports.comment_payout_beneficiaries = comment_payout_beneficiaries;
module.exports.execute = execute;

