// v0.51 (Mason #29: "I want to see people talking to each other, not a list; type my own words; the townsfolk should
// understand what I said; invite real friends to play"): what people say.
// - convoScript(): a few lines back and forth when you do something with someone (shown as speech bubbles over your
//   heads in the scene, then kept in the person's sheet).
// - understand() + talkReply(): you type a text in the phone; a small set of keyword rules works out what you meant
//   (hello, how are you, want to play tennis, I'm tired…) and they answer in their own way (their traits, their mood
//   today, how well you know each other). When there's a real AI (D274) only these two change.
// The words are here (both languages); the timings are TALK in data.js.

const TALK_LINES = {
  zh: {
    open: {
      greet: ['嗨，{name}！', '{name}，你好呀～', '哈喽，好久不见！'],
      chat: ['今天过得怎么样？', '最近镇上好热闹啊', '你吃饭了吗？'],
      ask: ['最近还好吗？', '最近在忙什么呀？', '这几天睡得好吗？'],
      compliment: ['你今天精神真好！', '你家院子真漂亮', '你这身衣服好好看'],
      highfive: ['来，击个掌！', '耶，give me five！'],
      hug: ['来抱一个～', '见到你真高兴，抱抱！'],
      joke: ['讲个笑话：西红柿为什么脸红？因为它看见沙拉没穿衣服！', '为什么小鸡要过马路？去对面下蛋呀！', '我昨天走了一万步……全是在梦里'],
      face: ['看我的鬼脸！😝', '嘿嘿，看这边～'],
      tickle: ['挠挠你！', '哈，抓到你了～'],
      interest: ['你喜欢{topic}吗？', '最近我迷上了{topic}', '我们聊聊{topic}吧！'],
      deep: ['其实最近我有点累……', '跟你说个心里话', '有时候我觉得，慢一点也挺好'],
      plans: ['改天一起去公园吧？', '周末一起去公园走走？'],
      gift: ['这个{item}送给你！', '带了点{item}给你～'],
      tease: ['你是不是又偷吃零食啦？😏', '哟，今天打扮得这么好看？'],
    },
    ok: {
      greet: ['嗨！见到你真好', '哈喽～今天天气真不错', '嘿！你来啦'],
      chat: ['挺好的！刚从公园回来', '还不错呀，你呢？', '吃了，好饱～'],
      ask: ['挺好的，谢谢关心！', '在忙着种菜呢，你呢？', '睡得不错，精神满满'],
      compliment: ['哇，谢谢你！好开心', '真的吗？你也很棒！', '嘿嘿，被你发现了'],
      highfive: ['啪！✋', '耶！'],
      hug: ['我也很高兴见到你', '暖暖的～'],
      joke: ['哈哈哈哈哈', '噗——你太好笑了', '哈哈，我要讲给别人听'],
      face: ['哈哈哈，你好傻', '看我的！🤪'],
      tickle: ['哈哈哈别挠了', '痒痒痒！'],
      shared: ['我也超喜欢{topic}！', '{topic}？我最爱了！'],
      polite: ['还挺有意思的，不过我更喜欢{their}', '{topic}还行，我比较爱{their}'],
      deep: ['谢谢你愿意告诉我，我懂', '我也有过这种时候，别担心', '有我在呢'],
      plans: ['好呀！公园见', '一言为定！'],
      gift: ['哇，{item}！谢谢你', '太贴心了，谢谢！'],
      tease: ['哈哈，被你抓到了', '你才是！'],
    },
    bad: {
      greet: ['哦，嗨。'], chat: ['嗯……我在忙'], ask: ['还行吧'], compliment: ['呃……谢谢？'], highfive: ['呃，算了吧'],
      hug: ['哎，别这样……'], joke: ['……不好笑'], face: ['这有点幼稚'], tickle: ['别碰我！'], deep: ['呃……我不知道说什么'],
      plans: ['这几天没空，抱歉'], tease: ['这一点也不好笑'], noshare: ['我对{topic}没什么兴趣……我喜欢{their}'], gift: ['谢谢'],
    },
    bored: ['你今天已经说过好几遍啦……', '嗯……又是这个呀'],
    grumpy: ['今天心情不太好，改天吧', '嗯。'],
    meOk: { any: ['哈哈，太好了', '真开心～', '下次再聊！'], plans: ['那就说定了！'], joke: ['我还有好多笑话呢'], gift: ['你喜欢就好！'], deep: ['谢谢你听我说'] },
    meBad: ['啊，抱歉……', '好吧，那改天', '呃……'],
    hi: ['嗨，{name}！', '{name}！你也在这儿'], hiBack: ['哦，是你呀！最近好吗？', '嗨～真巧！', '嘿！一起走走？'],
  },
  en: {
    open: {
      greet: ['Hi, {name}!', 'Hey {name}~', 'Hello! Long time no see!'],
      chat: ['How’s your day going?', 'Town’s busy lately, huh?', 'Have you eaten yet?'],
      ask: ['How have you been?', 'What are you up to these days?', 'Sleeping well lately?'],
      compliment: ['You look great today!', 'Your yard is so pretty', 'Love that outfit'],
      highfive: ['High five!', 'Up top!'],
      hug: ['Come here, hug!', 'So good to see you, hug!'],
      joke: ['Why did the tomato blush? It saw the salad dressing!', 'Why did the chicken cross the road? To lay an egg on the other side!', 'I walked ten thousand steps yesterday… in my dreams'],
      face: ['Look at my silly face! 😝', 'Hehe, look over here~'],
      tickle: ['Tickle tickle!', 'Ha, got you~'],
      interest: ['Do you like {topic}?', 'I’m really into {topic} lately', 'Let’s talk {topic}!'],
      deep: ['Honestly, I’ve been a bit tired lately…', 'Can I tell you something?', 'Sometimes slowing down feels nice'],
      plans: ['Let’s go to the park some time?', 'Park walk this weekend?'],
      gift: ['This {item} is for you!', 'I brought you some {item}~'],
      tease: ['Have you been sneaking snacks again? 😏', 'Ooh, dressed up today?'],
    },
    ok: {
      greet: ['Hi! So good to see you', 'Hello~ lovely day', 'Hey! You made it'],
      chat: ['Pretty good! Just back from the park', 'Not bad, you?', 'Just ate, so full~'],
      ask: ['Doing well, thanks for asking!', 'Busy with the garden, you?', 'Sleeping great, full of energy'],
      compliment: ['Aw, thank you! That made my day', 'Really? You’re great too!', 'Hehe, you noticed'],
      highfive: ['Slap! ✋', 'Yeah!'],
      hug: ['Good to see you too', 'So cozy~'],
      joke: ['Hahahaha', 'Pfft, you’re hilarious', 'Ha, I’m telling everyone that one'],
      face: ['Haha, you goof', 'My turn! 🤪'],
      tickle: ['Haha stop it', 'That tickles!'],
      shared: ['I love {topic} too!', '{topic}? My favourite!'],
      polite: ['That’s fun, but I’m more into {their}', '{topic} is okay, I prefer {their}'],
      deep: ['Thanks for telling me, I get it', 'I’ve been there too, don’t worry', 'I’m here for you'],
      plans: ['Sure! See you at the park', 'It’s a deal!'],
      gift: ['Wow, {item}! Thank you', 'So sweet of you, thanks!'],
      tease: ['Haha, busted', 'Look who’s talking!'],
    },
    bad: {
      greet: ['Oh. Hi.'], chat: ['Hmm… I’m busy'], ask: ['Fine, I guess'], compliment: ['Uh… thanks?'], highfive: ['Eh, maybe not'],
      hug: ['Hey, not now…'], joke: ['…Not funny'], face: ['That’s a bit childish'], tickle: ['Don’t!'], deep: ['Uh… I don’t know what to say'],
      plans: ['I’m busy these days, sorry'], tease: ['That’s not funny at all'], noshare: ['I’m not really into {topic}… I like {their}'], gift: ['Thanks'],
    },
    bored: ['You’ve said that a few times today…', 'Hmm… this again?'],
    grumpy: ['Not in a great mood today, another time', 'Mm.'],
    meOk: { any: ['Haha, great', 'That’s so nice~', 'Talk soon!'], plans: ['It’s a date!'], joke: ['I’ve got loads more'], gift: ['Glad you like it!'], deep: ['Thanks for listening'] },
    meBad: ['Ah, sorry…', 'Okay, another time', 'Um…'],
    hi: ['Hi, {name}!', '{name}! You’re here too'], hiBack: ['Oh, it’s you! How are you?', 'Hey~ what a surprise!', 'Hey! Walk together?'],
  },
};

const talkL = () => TALK_LINES[curLang() === 'en' ? 'en' : 'zh'];
const pickLine = (arr, seed) => (arr && arr.length ? arr[Math.abs(Math.floor(seed)) % arr.length] : '');
const fillLine = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined ? v[k] : m));

// A few lines back and forth for one social thing (doSocial's result r).
function convoScript(id, act, g, r) {
  const L = talkL(), w = whoIs(id), seed = Math.random() * 1000;
  const v = { name: w ? w.name : '', topic: r.topic ? nm(INTERESTS[r.topic]) : '', their: r.tells ? nm(INTERESTS[r.tells]) : '', item: act === 'gift' && g ? barnInfo(g).name : '' };
  const open = fillLine(pickLine(L.open[act] || L.open.chat, seed), v);
  let reply;
  if (act === 'interest') reply = r.shared ? pickLine(L.ok.shared, seed) : r.ok ? pickLine(L.ok.polite, seed) : pickLine(L.bad.noshare, seed);
  else if (r.ok) reply = pickLine(L.ok[act] || L.ok.chat, seed);
  else if (r.bored) reply = pickLine(L.bored, seed);
  else if (moodOf(id) === 'grumpy') reply = pickLine(L.grumpy, seed);
  else reply = pickLine(L.bad[act] || L.bad.chat, seed);
  const close = r.ok ? pickLine(L.meOk[act] || L.meOk.any, seed + 1) : pickLine(L.meBad, seed + 1);
  return [{ me: true, text: open }, { me: false, text: fillLine(reply, v) }, { me: true, text: fillLine(close, v) }];
}
// Walking up to someone: hello, hello.
function talkGreet(id) {
  const L = talkL(), w = whoIs(id), s = Math.random() * 100;
  return [{ me: true, text: fillLine(pickLine(L.hi, s), { name: w ? w.name : '' }) }, { me: false, text: pickLine(L.hiBack, s + 1) }];
}

// ---------- texting in your own words ----------
// What you meant, from keywords (Chinese or English, whatever the app's language). First match in this order wins.
const INTENTS = [
  ['bye', /再见|拜拜|晚安|回头见|下次聊|\bbye\b|see (you|ya)|good ?night|\bgn\b|talk later/i],
  ['sad', /难过|伤心|不开心|心情不好|烦|压力|孤单|寂寞|哭|\bsad\b|upset|stress|lonely|bad day|\bcry/i],
  ['love', /想你|喜欢你|爱你|miss you|love you/i],
  ['play', /打球|网球|篮球|足球|保龄|高尔夫|钓鱼比赛|游泳比赛|卡拉|唱歌|本垒打|一起玩|玩一局|比一场|tennis|basketball|soccer|football|bowling|golf|karaoke|\bsing|derby|\bplay\b|\brace\b/i],
  ['meet', /公园|见面|出来玩|出来走|散步|一起走|来我家|park|meet( up)?|hang out|come over|\bwalk together/i],
  ['thanks', /谢谢|多谢|感谢|\bthank|\bthx\b|\bty\b/i],
  ['sorry', /对不起|抱歉|不好意思|\bsorry\b/i],
  ['joke', /笑话|讲个笑|搞笑|\bjoke|funny/i],
  ['askLike', /你喜欢什么|你的爱好|你爱好|兴趣是|你平时|what do you like|your hobb|what are you into/i],
  ['how', /怎么样|还好吗|好吗|最近|在干嘛|在做什么|忙什么|干啥|how are|how’s it|how's it|what'?s up|wyd|what are you (doing|up to)/i],
  ['tired', /困|累|没睡|睡不着|好晚|tired|sleepy|can'?t sleep|exhausted/i],
  ['steps', /步|走路|跑步|健身|运动|锻炼|steps|\brun\b|running|gym|workout|exercise/i],
  ['food', /吃|饭|饿|餐厅|咖啡|奶茶|披萨|汉堡|\beat|food|lunch|dinner|breakfast|hungry|coffee|pizza|burger/i],
  ['weather', /天气|下雨|下雪|太阳|好热|好冷|weather|\brain|\bsnow|sunny|\bhot\b|\bcold\b/i],
  ['farm', /菜|种地|收成|鸡|奶牛|农场|果树|farm|crop|veggie|harvest|chicken|\bcow\b/i],
  ['pet', /狗|猫|宠物|\bdog|\bcat\b|\bpet\b|puppy|kitten/i],
  ['work', /上班|工作|老板|打工|下班|\bwork|\bjob\b|\bboss\b|\bshift/i],
  ['compliment', /漂亮|好看|厉害|真棒|好棒|帅|可爱|酷|\bnice\b|\bcool\b|great|awesome|beautiful|pretty|cute|amazing/i],
  ['happy', /开心|高兴|太好了|哈哈|嘻嘻|耶|happy|\byay\b|haha|\blol\b|great day/i],
  ['greet', /你好|您好|嗨|哈喽|早上好|早安|中午好|晚上好|\bhello\b|\bhi\b|\bhey\b|good (morning|afternoon|evening)|\byo\b/i],
  ['yes', /^(好|好的|好啊|可以|行|没问题|嗯嗯?|ok|okay|sure|yes|yeah|yep)[!！。.~～]*$/i],
];
// which game you asked about (for 'play')
const PLAY_WORDS = [['tennis', /网球|tennis/i], ['basketball', /篮球|basketball/i], ['soccer', /足球|soccer|football/i], ['bowling', /保龄|bowling/i], ['golf', /高尔夫|golf/i], ['karaoke', /卡拉|唱歌|karaoke|\bsing/i], ['fishing', /钓鱼|fish/i], ['derby', /本垒打|棒球|derby|baseball/i], ['race', /游泳|swim|\brace\b/i]];
const HOBBY_WORDS = [['music', /音乐|唱歌|歌|music|song/i], ['books', /书|看书|阅读|book|read/i], ['movies', /电影|movie|film/i], ['art', /画画|画|art|paint|draw/i], ['travel', /旅行|旅游|出去玩|travel|trip/i], ['games', /游戏|game/i], ['garden', /种花|花园|garden|flower/i], ['sport', /运动|sport/i], ['pets', /宠物|pet/i], ['food', /美食|好吃|food|cook/i]];
function understand(text) {
  const s = String(text || '').trim();
  if (!s) return { intent: 'none' };
  const hit = INTENTS.find(([, re]) => re.test(s));
  const out = { intent: hit ? hit[0] : 'other' };
  const pw = PLAY_WORDS.find(([, re]) => re.test(s)); if (pw) out.game = pw[0];
  const hw = HOBBY_WORDS.find(([, re]) => re.test(s)); if (hw) out.hobby = hw[0];
  if (out.intent === 'other' && out.hobby) out.intent = 'hobby';
  if (/[?？吗呢]$/.test(s) && out.intent === 'other') out.intent = 'question';
  return out;
}
const REPLIES = {
  zh: {
    greet: ['嗨！{me}，今天怎么样？', '哈喽～找我有事吗？', '嘿！在呢'],
    how: ['挺好的！今天{doing}', '还不错，刚{doing}，你呢？', '一般般，有点忙'],
    thanks: ['不客气～', '小事一桩！', '应该的 😄'],
    sorry: ['没关系啦', '没事没事，别放在心上'],
    joke: ['哈哈，那我也讲一个：为什么书很冷？因为它有很多“页”（夜）', '你先讲！我等着笑'],
    askLike: ['我喜欢{l1}和{l2}！', '平时就爱{l1}，还有{l2}'],
    hobby: ['{hobby}？我也喜欢！', '{hobby}挺有意思的，不过我更爱{l1}'],
    hobbyMine: ['{hobby}？我也喜欢！下次一起'],
    tired: ['早点休息呀，睡好了明天才有精神', '累了就歇歇，别硬撑'],
    steps: ['厉害！我今天也走了不少', '一起加油！我也想多运动'],
    food: ['说得我都饿了 🍔', '我刚吃过，美食广场的面不错'],
    weather: ['今天{weather}呢', '是啊，{weather}'],
    farm: ['我的菜也快熟了 🥕', '种地真的很治愈'],
    pet: ['好想摸摸你的宠物！', '宠物最可爱了 🐶'],
    work: ['上班辛苦啦！', '我也在努力打工赚钱呢'],
    compliment: ['哇，谢谢你！', '嘿嘿，你也很棒！'],
    happy: ['哈哈，看你开心我也开心', '太好了！'],
    sad: ['怎么了？想聊聊吗？我在', '抱抱你，会好起来的', '要不要出来走走？散散心'],
    love: ['哈哈，我也想你啦', '你真会说话 😊'],
    bye: ['拜拜～下次聊！', '好的，回头见！', '晚安，好梦～'],
    yes: ['好嘞 👍', '嗯嗯！'],
    question: ['这个嘛……我也不太确定', '好问题！让我想想'],
    other: ['哈哈，是吗？', '嗯嗯，然后呢？', '真的假的！', '有意思～'],
    cold: ['嗯。', '哦。', '知道了'],
    grumpy: ['今天有点烦，改天聊吧'],
    meetOk: ['好呀！公园见 🌳', '走！我这就去公园'], meetDone: ['今天已经约过啦，明天吧'], meetNo: ['今天有点忙，改天吧'],
    playOk: ['好啊！来{place}找我，一起{game} 🙌', '没问题！{place}见'], playNo: ['今天不太想玩，改天吧'], playWork: ['我在上班，下班再说～'],
    doing: ['去了趟公园', '收了点菜', '看了部电影', '在家看书', '做了顿饭', '去健身了'],
  },
  en: {
    greet: ['Hi {me}! How’s it going?', 'Hello~ what’s up?', 'Hey! I’m here'],
    how: ['Pretty good! I {doing} today', 'Not bad, just {doing}, you?', 'So-so, a bit busy'],
    thanks: ['Any time~', 'No problem!', 'Of course 😄'],
    sorry: ['It’s okay', 'No worries, really'],
    joke: ['Haha, here’s one: why are books always cold? They have so many pages… of drafts!', 'You first! I’m ready to laugh'],
    askLike: ['I love {l1} and {l2}!', 'Mostly {l1}, and {l2}'],
    hobby: ['{hobby}? Me too!', '{hobby} is fun, but I’m more into {l1}'],
    hobbyMine: ['{hobby}? I love it too! Let’s do it together sometime'],
    tired: ['Get some rest, sleep well and you’ll feel better', 'Take a break, don’t push it'],
    steps: ['Nice! I walked a lot today too', 'Let’s keep it up! I want to move more too'],
    food: ['Now I’m hungry 🍔', 'Just ate, the noodles at the food court are good'],
    weather: ['It’s {weather} today', 'Yeah, {weather}'],
    farm: ['My veggies are nearly ready too 🥕', 'Farming is so relaxing'],
    pet: ['I want to pet your pet!', 'Pets are the best 🐶'],
    work: ['Work’s tough, hang in there!', 'I’m working hard for coins too'],
    compliment: ['Aw, thank you!', 'Hehe, you’re great too!'],
    happy: ['Haha, you being happy makes me happy', 'Yay!'],
    sad: ['What’s up? Want to talk? I’m here', 'Sending a hug, it’ll get better', 'Want to go for a walk? Clear your head'],
    love: ['Haha, I miss you too', 'You’re sweet 😊'],
    bye: ['Bye~ talk soon!', 'Okay, see you!', 'Good night, sweet dreams~'],
    yes: ['Okay 👍', 'Mm-hm!'],
    question: ['Hmm… not sure, honestly', 'Good question! Let me think'],
    other: ['Haha, really?', 'Mm-hm, and then?', 'No way!', 'Interesting~'],
    cold: ['Mm.', 'Oh.', 'Okay'],
    grumpy: ['Bit of a bad day, talk later'],
    meetOk: ['Sure! See you at the park 🌳', 'On my way to the park!'], meetDone: ['We already met up today, tomorrow?'], meetNo: ['Busy today, another time'],
    playOk: ['Yes! Find me at the {place}, let’s play {game} 🙌', 'Sure! See you at the {place}'], playNo: ['Don’t feel like playing today, another time'], playWork: ['I’m at work, after my shift~'],
    doing: ['went to the park', 'picked some veggies', 'saw a film', 'read at home', 'cooked dinner', 'went to the gym'],
  },
};
const GAME_NAMES = { tennis: { zh: '网球', en: 'tennis' }, basketball: { zh: '篮球', en: 'basketball' }, soccer: { zh: '足球', en: 'soccer' }, bowling: { zh: '保龄球', en: 'bowling' }, golf: { zh: '迷你高尔夫', en: 'mini golf' }, karaoke: { zh: '卡拉 OK', en: 'karaoke' }, fishing: { zh: '钓鱼', en: 'fishing' }, derby: { zh: '本垒打', en: 'home run derby' }, race: { zh: '游泳比赛', en: 'a swim race' }, claw: { zh: '抓娃娃', en: 'the claw machine' } };
// Where each game is played (for "come to the …")
const PLAY_PLACE = { tennis: 'park', basketball: 'park', soccer: 'park', bowling: 'bowling', golf: 'amuse', karaoke: 'amuse', fishing: 'lake', derby: 'stadium', race: 'aquatic' };
// Their answer to what you texted, and what it did: { text, meet?, play? }
function talkReply(id, text) {
  const R = REPLIES[curLang() === 'en' ? 'en' : 'zh'], U = understand(text), w = whoIs(id), seed = hashStr(text + id + now());
  const ints = interestsOf(id), v = { me: S.me.name || '', l1: nm(INTERESTS[ints[0]]), l2: nm(INTERESTS[ints[1]]), hobby: U.hobby ? nm(INTERESTS[U.hobby]) : '', weather: t('w_' + weatherNow().kind) };
  v.doing = pickLine(R.doing, seed + 3);
  const say = (k, x) => fillLine(pickLine(R[k] || R.other, seed), { ...v, ...(x || {}) });
  const rel = relOf(id), md = moodOf(id), out = { intent: U.intent };
  if (rel < 0 && !['sorry', 'thanks', 'sad'].includes(U.intent)) { out.text = say('cold'); return out; }   // you're not on good terms
  if (md === 'grumpy' && seed % 3 === 0 && !['sad', 'sorry'].includes(U.intent)) { out.text = say('grumpy'); return out; }
  if (U.intent === 'meet') {
    if (String(id).startsWith('work_') || (w && w.tf && w.tf.job)) { out.text = say('playWork'); return out; }
    const r = meetInPark(id); out.text = say(r === 'ok' ? 'meetOk' : 'meetDone'); out.meet = r === 'ok'; return out;
  }
  if (U.intent === 'play') {
    const game = U.game || 'tennis', will = sportWillPlay(id), place = nm(placeInfo(PLAY_PLACE[game]) || PLACE_INFO.park);
    if (will !== 'ok') { out.text = say('playNo'); return out; }
    if (String(id).startsWith('work_')) { out.text = say('playWork'); return out; }
    S.invites = S.invites || {}; S.invites[id] = { k: game, until: now() + TALK.inviteKeep * HOUR };
    out.text = say('playOk', { place, game: nm(GAME_NAMES[game]) });
    out.play = game; return out;
  }
  if (U.intent === 'askLike') { const K = knownOf(id); ints.forEach(k => { if (!K.int.includes(k)) K.int.push(k); }); }
  if (U.intent === 'hobby' && U.hobby && ints.includes(U.hobby)) { out.text = say('hobbyMine'); const K = knownOf(id); if (!K.int.includes(U.hobby)) K.int.push(U.hobby); return out; }
  out.text = say(U.intent === 'none' ? 'other' : U.intent);
  return out;
}
