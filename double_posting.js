const ga = require("golos-addons");
const global = ga.global;
const golosjs = ga.golos.golos;

global.initApp("filltestnet", "config.json5");

const dopost = require("./dopost");
const log = global.getLogger("posting");

const CONFIG = global.CONFIG;

ga.golos.setWebsocket(CONFIG.websocket);
ga.golos.setChainId(CONFIG.chain_id);
ga.golos.setPrefix(CONFIG.prefix);


async function run_prod() {

}

async function run_testnet() {
    const post = {
        parent_author: '',
        parent_permlink: 'ru--abrakadabra',
        author: 'fish00335',
        permlink: "post-" + (new Date()).toISOString().replace(/[^0-9]/g, ''),
        title: 'permlink-double-posting-post',
        body: 'root post',
        json_metadata: '{}'
    }
    await global.sleep(50);
    const comment1 = {
        parent_author: 'fish00335',
        parent_permlink: post.permlink,
        author: 'minnow00091',
        permlink: "comment-" + (new Date()).toISOString().replace(/[^0-9]/g, ''),
        title: 'comment 1',
        body: 'root post',
        json_metadata: '{}'
    }
    const comment2 = {
        parent_author: 'fish00335',
        parent_permlink: post.permlink,
        author: 'minnow00092',
        permlink: "comment-" + (new Date()).toISOString().replace(/[^0-9]/g, ''),
        title: 'comment 2',
        body: 'root post',
        json_metadata: '{}'
    }
    const comment3 = {
        parent_author: 'fish00335',
        parent_permlink: post.permlink,
        author: 'minnow00093',
        permlink: "comment-" + (new Date()).toISOString().replace(/[^0-9]/g, ''),
        title: 'comment 3',
        body: 'root post',
        json_metadata: '{}'
    }
    const comment4 = {
        parent_author: 'fish00335',
        parent_permlink: post.permlink,
        author: 'minnow00094',
        permlink: "comment-" + (new Date()).toISOString().replace(/[^0-9]/g, ''),
        title: 'comment 4',
        body: 'root post',
        json_metadata: '{}'
    }

    await test(
        post, "5KbzQNawUY3XRbfQ5bHqaAXX8bXq1aRmAwp1jsNN4fK9yuBmd9Y",
        comment1, "5KbzQNawUY3XRbfQ5bHqaAXX8bXq1aRmAwp1jsNN4fK9yuBmd9Y",
        comment2, "5KbzQNawUY3XRbfQ5bHqaAXX8bXq1aRmAwp1jsNN4fK9yuBmd9Y",
        comment3, "5KbzQNawUY3XRbfQ5bHqaAXX8bXq1aRmAwp1jsNN4fK9yuBmd9Y",
        comment4, "5KbzQNawUY3XRbfQ5bHqaAXX8bXq1aRmAwp1jsNN4fK9yuBmd9Y",
    );
}

async function test(post, post_key,
    comment1, comment1_key,
    comment2, comment2_key,
    comment3, comment3_key,
    comment4, comment4_key,
) {
    log.info("create post");
    await dopost.push_op(["comment", post]);
    await dopost.execute(post_key);
    await global.sleep(1000 * 6);
    log.info("create comment1");
    await dopost.push_op(["comment",comment1]);
    //await dopost.execute(comment1_key);
    log.info("create comment2");
    await dopost.push_op(["comment",comment2]);
    //await dopost.execute(comment2_key);

    log.info("create comment3");
    await dopost.push_op(["comment", comment3]);
    //await dopost.execute(comment3_key);

    log.info("create comment4");
    await dopost.push_op(["comment", comment4]);
    await dopost.execute(comment4_key);
    process.exit(0);
}

run_testnet();
