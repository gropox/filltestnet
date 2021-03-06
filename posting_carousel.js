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

const Users = require("./users");
var loremIpsum = require('lorem-ipsum');

const MAX_DELAY = 1000 * 60 * 15; //1 hour
const MAX_COMMENT_DEPTH = 12;
const MAX_POSTS = 50;
const MIN_POST_INTERVAL = 1000 * 60;
const MAX_POST_INTERVAL = 1000 * 60 * 5;

//Задает одну и туже последовательность. Поменять, если уже запускался.
let SEED = Math.ceil(Math.random() * 1000);

function random() {
    var x = Math.sin(SEED++) * 10000;
    return x - Math.floor(x);
}

/**
 * К А Р У С Е Л Ь
 * 
 * Случайный автор пишет пост.
 * 
 * N пользователей закрепляются за постом на голосование через случайный промежуток времени.
 * N пользователей закрепляются за постом на комментирование через случайный промежуток времени.
 * 
 */

ALLUSERS = [
    ...Users.getUserNames("fish"),
    ...Users.getUserNames("minnow"),
    ...Users.getUserNames("dolphin"),
    ...Users.getUserNames("orca"),
    ...Users.getUserNames("whale")];

const TAGS = loremIpsum({count: 20, units: 'words', random}).split(" ");
for (let i = 0; i < TAGS.length; i++) {
    TAGS[i] = TAGS[i].toLowerCase();
}

log.debug("TAGS", TAGS);

const PIPELINE = [];

class TimedUser {
    constructor(user) {
        this.user = user;
        this.timeout = Date.now() + (1000*6) + Math.floor((1-Math.pow(random(),random())) * MAX_DELAY);
    }
}

let PERMLINK_COUNTER = Math.floor(random() * 3000000);

class Post {
    constructor(author, parent_permlink, parent_author, level) {
        this.author = author;
        this.parent_author = parent_author;
        if (!this.parent_author) {
            this.parent_author = "";
        }
        this.parent_permlink = parent_permlink;
        this.level = level?level:0;
        this.commentators = [];
        this.voters = [];
        this.generateRandom();
        log.info("created post", this.author, this.permlink, this.parent_permlink, this.voters.length, this.commentators.length);
    }

    generateRandom() {
        this.permlink = "permlink-" + PERMLINK_COUNTER++;
        this.title = loremIpsum({
            count: 1                      // Number of words, sentences, or paragraphs to generate. 
            , units: 'sentences'            // Generate words, sentences, or paragraphs. 
            , sentenceLowerBound: 2         // Minimum words per sentence. 
            , sentenceUpperBound: 5        // Maximum words per sentence. 
            , paragraphLowerBound: 3        // Minimum sentences per paragraph. 
            , paragraphUpperBound: 7        // Maximum sentences per paragraph. 
            , random
        });   
        this.body = loremIpsum({
            count: 1                      // Number of words, sentences, or paragraphs to generate. 
            , units: 'paragraphs'            // Generate words, sentences, or paragraphs. 
            , sentenceLowerBound: 2         // Minimum words per sentence. 
            , sentenceUpperBound: 5        // Maximum words per sentence. 
            , paragraphLowerBound: 3        // Minimum sentences per paragraph. 
            , paragraphUpperBound: 7        // Maximum sentences per paragraph.
            , random
        });

        this.body += `

owner: "5JMUYvoLdT6LKqQdpU5gWQ8S9PqPPy8mDCoN9o6BYktdENo3sGa",
active: "5KkkgDP5nePBXjv88igBS6mJU7NWvpXjk7UrxD6CeqMFRtRpaCV",
posting: "5KbzQNawUY3XRbfQ5bHqaAXX8bXq1aRmAwp1jsNN4fK9yuBmd9Y",
memo : "5KdTUas4PcBXhebwBdFcNTq3rNGbRxyJkXD7xL7fAcwuP5tXuJr"        
`;

        this.addVoters();
        this.addCommentators();
    }

    addVoters() {
        const COUNT = (MAX_COMMENT_DEPTH - this.level) * ((random()) * 3);
        log.trace("COUNT VOTE", COUNT, ALLUSERS.length);
        while (this.voters.length < COUNT) {
            const idx = parseInt(random() * ALLUSERS.length); 
            const voter = ALLUSERS[idx];
            this.addVoter(voter);
        }
    }

    addCommentators() {
        const COUNT = (MAX_COMMENT_DEPTH - this.level) * ((random())* 2);
        log.trace("COUNT COMM", COUNT, ALLUSERS.length);
        while (this.commentators.length < COUNT) {
            const idx = parseInt(random() * ALLUSERS.length);
            const commentator = ALLUSERS[idx];
            this.addCommentator(commentator);
        }
    }

    checkExists(arr, user) {
        for (let tu of arr) {
            if (tu.user == user) {
                return true;
            }
        }
        return false;
    }

    sortUsers(users) {
        users.sort((a, b) => {
            return a.timeout - b.timeout 
        });
    }

    addVoter(voter) {
        if (!this.checkExists(this.voters, voter)) {
            this.voters.push(new TimedUser(voter));
            this.sortUsers(this.voters);
        }
    }

    addCommentator(commentator) {
        if (!this.checkExists(this.commentators, commentator)) {
            this.commentators.push(new TimedUser(commentator));
            this.sortUsers(this.commentators);
        }
    }

    async broadcast() {
        log.debug("broadcast comment", this.author);
        dopost.comment(this.parent_author, this.parent_permlink, this.author, this.permlink, this.title, this.body, {});
        dopost.comment_payout_beneficiaries(this.author, this.permlink, "1000000.000 GBG", 0, true, true,
            {
                beneficiaries: [
                    { account: "fish00000", weight: 1000 }
                    , { account: "fish00001", weight: 1000 }
                    , { account: "fish00002", weight: 500 }
                    , { account: "fish00003", weight: 500 }
                ]
            });


        log.debug("execute comment", this.author);
        await dopost.execute(CONFIG.user.pkeys.posting);
    }
}


async function processVotes(post, block) {
    let content = await golosjs.api.getContentAsync(post.author, post.permlink);
    log.debug("content", content);
    if (content.permlink != post.permlink || content.mode == "archived") {
        post.voters = [];
        return;
    }
    while (post.voters.length > 0 && post.voters[0].timeout < Date.now()) {
        const voter = post.voters.shift();
        if (block.includes(voter.user)) {
            await global.sleep(500);
        } else {
            block.push(voter.user);
        }        
        log.info("\tvote", voter.user, "for", post.author, post.permlink);
        try {
            await golosjs.broadcast.voteAsync(CONFIG.user.pkeys.posting, voter.user, post.author, post.permlink, 10000);
        } catch (e) {
            log.error(ga.golos.getExceptionCause(e));
        }            
    }
}

async function processComments(post, block) {
    const props = await golosjs.api.getDynamicGlobalPropertiesAsync();
    let content = await golosjs.api.getContentAsync(post.author, post.permlink);
    if (content.permlink != post.permlink || Date.parse(content.created) < Date.parse(props.time) - (1000*60*60)) {
        log.warn("no comments", content ? content.created : "no content", post.author, post.permlink);
        post.commentators = [];
        return;
    }
    while (post.commentators.length > 0 && post.commentators[0].timeout < Date.now()) {
        const commentator = post.commentators.shift();
        if (block.includes(commentator.user)) {
            await global.sleep(21 * 1000);
        } else {
            block.push(commentator.user);
        }
        log.info("\tcomment", commentator.user, "on", post.author, post.permlink);
        const comment = new Post(commentator.user, post.permlink, post.author, post.level + 1);
        try {
            await comment.broadcast();
            PIPELINE.push(comment);
        } catch (e) {
            log.error(ga.golos.getExceptionCause(e));
        }
    }
}

async function processPipline() {
    const votes = [];
    const comments = [];
    for (let i = 0; i < PIPELINE.length; i++) {
        const post = PIPELINE.shift();
        log.debug("workout post", post.author, post.permlink, post.level, post.voters.length, post.commentators.length);
        await processVotes(post, votes);
        await processComments(post, comments);
        if (post.voters.length > 0 || post.commentators.length > 0) {
            log.trace("\tpush back");
            PIPELINE.push(post);
        } else {
            log.info("\tpost done", post.author, post.permlink);
        }
    }
}

async function run() {

    nextPost = () => {
        return nextPostTime = Date.now() + ((random() * (MAX_POST_INTERVAL - MIN_POST_INTERVAL)) + MIN_POST_INTERVAL);
    }

    log.info("SEED", SEED);
    let nextPostTime = 0;
    while (true) {
        let cnt = 0;
        for (let p of PIPELINE) {
            if (p.level == 0) {
                cnt++;
            }
        }
        const properties = await golosjs.api.getDynamicGlobalPropertiesAsync();
        //log.info("head_block", properties.head_block_number);
        //log.info("head_block transactions", await golosjs.api.getBlockAsync(properties.head_block_number).transactions);
        //log.info("head_block ops", await golosjs.api.getOpsInBlockAsync(properties.head_block_number, false));
        //log.info("posts in pipeline", cnt, MAX_POSTS);
        if (cnt < MAX_POSTS && nextPostTime < Date.now()) {
            const rnd_user = ALLUSERS[Math.floor(random() * ALLUSERS.length)];
            const rnd_tag = TAGS[Math.floor(random() * TAGS.length)];
            for (let i = 0; i < 5; i++) {
                let post = new Post(rnd_user, rnd_tag);
                let doPost = true;
                for (let pp of PIPELINE) {
                    if (post.author == pp.author && pp.parent_author == "") {
                        //пост того же автора еще в обработке, в следущий раз.
                        doPost = false;
                    }
                }
                if (doPost) {
                    try {
                        await post.broadcast();
                        PIPELINE.push(post);
                        lastPostTime = Date.now();
                        nextPostTime = Date.now() + ((random() * (MAX_POST_INTERVAL - MIN_POST_INTERVAL)) + MIN_POST_INTERVAL);                        
                    } catch (e) {
                        log.error(ga.golos.getExceptionCause(e));
                    }
                    break;
                }
            }
        }

        await processPipline();

        await global.sleep(1000);
    }
}


run();
