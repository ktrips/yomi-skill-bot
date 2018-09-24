var clova  = require("love-clova");
const line = require('@line/bot-sdk');
var request= require('request');
var async = require('async');
var res;

var event;
var context;
var callback;
var https = require('https');

const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const BUCKET_NAME = 'senseipacket';
const fs = require('fs');

var dynamodb     = new AWS.DynamoDB({region: 'us-east-1'});
const TableName  = "senseiData";

const speaker = "クローバ";
const skill_name = "読みの神";
const line_bot_url = "https://api.line.me/v2/bot";

const KanjiSlot= ["漢字","かんじ","漢", "漢語", "漢検", "かんけん", "カンケン", "漢字検定"];
const KankenConv={10:"小1", 9:"小2", 8:"小3", 7:"小4", 6:"小5", 5:"小6", 4:"中1", 3:"中2", 2:"中3"};
const EngSlot  = ["English","english","英語","英","えいご","米語", "英検", "えいけん", "エイケン", "英語検定"];
const EikenConv= {5:"中1", 4:"中2", 3:"中3", 2.5:"高1", 2:"高2", 1.5:"高3", 1:"大"};
const HyakuSlot= ["百人一首","かるた","カルタ","百人","一首"];
const RandomGrades= ["小1","小2","小3","小4","小5","小6"];
const EngWord  = {"N":"名詞","V":"動詞","A":"形容詞","O":"その他"};
const kan_num  = {"一":1, "二":2, "三":3, "四":4, "五":5, "六":6,  "七":7,  "八":8,  "九":9,  "十":10, "１":1, "２":2, "３":3, "４":4, "５":5, "６":6};
const grades   = {"幼":"k", "小":"", "中":"j", "高":"h", "大":"u"};
var RandomGrade = RandomGrades[Math.floor(Math.random() * RandomGrades.length)];
const test_sets = [RandomGrade, "漢字", 2, "ちはや", "N", "ゆっくり"]; //[grade, subject, read number, hyaku word, answer, speed]
const default_read = 10;
const ans_flag = "N";
const break_time = 5;

var help_message = skill_name + "は、小・中学生の漢字や、中学の英語、漢検、英検、百人一首などを読み上げます。";
var add_message  = test_sets[0] + "の" + test_sets[1] + "を読み上げて！などと聞いてみて下さい！";
help_message = help_message + add_message;
var end_message  = skill_name + "を使ってくれてありがとう！また何でも聞いてね！";

function get_hyaku(WordSlot, callback) {
    console.log(WordSlot);
    const hyaku_url = 'http://api.aoikujira.com/hyakunin/get.php?fmt=json&key=';
    const url  = hyaku_url + WordSlot;
    const req = https.request(url, (res) => {
      res.on('data', chunk => {
        console.log("res:"+data);
        console.log(`BODY: ${chunk}`);
        res = JSON.parse(chunk);
        console.log(res.length);
        for (var i=0; i < res.length; i++) {
          console.log(res[i]);
          var kami   = res[i]["kami"];
          var simo   = res[i]["simo"];
          var sakusya= res[i]["sakusya"];
        }
        //callback(null, kami + simo);
        return kami+simo;
      });
    })
}

function get_read_text(SubjectSlot, GradeSlot, read_num, callback) {
  console.log(SubjectSlot, GradeSlot, read_num);
  if (SubjectSlot.match(/^漢字/)) {
    keySub = "kanji";
  } else if (SubjectSlot.match(/^英語/)) {
    keySub = "eng";
  } else if (SubjectSlot.match(/^百人/)) {
    keySub = "kanji";
  } else {
    keySub = "kanji";
  }
  //var keySub = kanji;
  if ( GradeSlot.match(/\d{1}/) ) {
    var keyGrd = GradeSlot.match(/\d{1}/);
  } else {
    var keyGrd = 3;
  }
  if ( GradeSlot.match(/^中/) ) {
    var grdSeg = "j";
    var grdSegW= "中学";
  } else if ( GradeSlot.match(/^高/) ) {
    grdSeg = "h";
    grdSegW= "高校";
  } else if ( GradeSlot.match(/^小/) ) {
    grdSeg = "";
    grdSegW= "小学";
  } else {
    grdSeg = "";
    grdSegW= "";
  }
  //var grdSeg = "";
  var text     = ""; //GradeSlot+"の"+SubjectSlot+":\n";
  var text_line= "LINE\n";
  var KEY_NAME = keySub + grdSeg + keyGrd + ".json";
  console.log(text, KEY_NAME);

  var data = fs.readFileSync('./files/'+KEY_NAME, 'utf-8');
  var objects = JSON.parse(data);
  //var objects = JSON.stringify(data); //JSON.parse(data.Body.toString());
  //console.log(objects);
  var min = 0;
  var max = objects.length;
  for (var i = 1; i < read_num+1; i++) {
      var n = Math.floor( Math.random() * (max+1 - min) ) + min;
      var word   = objects[n]["word"];
      var read   = objects[n]["read"][0];
      var meaning= read["maening"];
      var example= read["example"][0];
      var example_kanji= example.split("|")[0];
      var example_yomi = example.split("|")[1];
      console.log(word, meaning, example);
      text += word + "について、" + example_yomi + "、  ";
      text_line += "("+i+")"+example_yomi + "、答えは "+example_kanji+"\n";
  }
  var all_text = text + "|" + text_line;
  return all_text;
}


const LaunchRequestHandler = {
  //canHandle(handlerInput){
  canHandle: function(handlerInput){
    return handlerInput.requestEnvelope.isMatch('LaunchRequest');
  },
  //async handle(handlerInput){
  handle: function(handlerInput){
    var GradeSlots= ["小3", "中2", "4級"];
    var GradeSlot = GradeSlots[Math.floor(Math.random() * GradeSlots.length)];
    var SubjectSlots = ["漢字", "英語", "百人一首"];
    var SubjectSlot = SubjectSlots[Math.floor(Math.random() * SubjectSlots.length)];

    var all_text = get_read_text(test_sets[1], test_sets[0], test_sets[2]);
    var yomi_msg = all_text.split("|")[0]
    var msg = skill_name + "は、" + yomi_msg + add_message;
    console.log("out:"+msg);
    return handlerInput.responseBuilder.speak(msg).reprompt(msg).getResponse();
  }
}

/*
        if intent_name == "ReadIntent":
            GradeSlot = intent['slots']['Grade'].get('value')
            SubjectSlot= intent['slots']['Subject'].get('value')
            #NumberSlot = intent['slots']['Number'].get('value')
            NumberSlot = default_read #NumberSlot if NumberSlot.isdecimal() else defualt_read # is not None else default_read
            if GradeSlot is None:
                if SubjectSlot in KanjiSlot:
                    GradeSlot = "小"+str(random.randint(1,6))
                elif SubjectSlot in EngSlot:
                    GradeSlot = "中"+str(random.randint(1,3))
                else:
                    GradeSlot = "小3"
            if SubjectSlot in KanjiSlot + EngSlot:
              read_result, line_results = getRead.get_read(GradeSlot, SubjectSlot, NumberSlot)
              if read_result:
                message = GradeSlot + "の" + SubjectSlot + "を" + str(NumberSlot) + "個、" + str(break_time) + "秒おきに読み上げます！書き取りしてみて下さいね。"
                message+= "用意はいいですか？<break time=\"1s\" />ではスタート！　"
                message+= read_result
                message+= "これで" + str(NumberSlot) + "個読み上げました。ちゃんと書き取り出来ましたか？優しい人に丸つけしてもらって下さいね！また、"
                message+= add_message
                line_message = GradeSlot + SubjectSlot + "の問題:\n" + line_results.replace("<break time=\"5s\" />", "")
                data = {
                    "to": userid,
                    "messages": [
                        {
                            "type": "text",
                            "text": line_message
                        }
                    ]
                }
                requests.post(push_url, data=json.dumps(data), headers=headers)
                talk_message = str(message) # + "ラインにも通知しました！"
                # if chien train exists send it to LINE and close the conv
                endSession = False
              else:
                talk_message = SubjectSlot + "はありません！"
                talk_message+= add_message
                endSession = False #Continue the conv
            elif SubjectSlot in HyakuSlot:
                read_result = getRead.get_hyaku("")
                talk_message = SubjectSlot + "の上の句を読みます！では、「" + read_result[1]
                talk_message+= "」の下の句は？<break time=\"" + str(break_time) + "s\" /> この「"
                talk_message+= read_result[0] + "」さんが詠んだ下の句は、「" + read_result[2] + "」でした！また"
                talk_message+= add_message
                endSession = False
            else:
                talk_message = "ごめんなさい！分かりませんでした。"
                talk_message+= help_message
                endSession = False #Continue the conv

    else:
        if test_sets[1] in KanjiSlot + EngSlot:
            read_result, line_results = getRead.get_read(GradeSlot=test_sets[0], SubjectSlot=test_sets[1], NumberSlot=test_sets[2])
        else:
            read_result = getRead.get_hyaku(WordSlot=test_sets[3])
        #read_result.replace('<break time="5s" />', '')
        talk_message = skill_name + "は、" +test_sets[1] + "なら「"
        talk_message+= read_result + "」などを読み上げます！" if read_result else "読み上げがありません！"
        talk_message+= add_message
        endSession = False #PlainText
*/

const SessionEndedRequestHandler = {
  canHandle: function(handlerInput){
    return handlerInput.requestEnvelope.isMatch('SessionEndedRequest');
  },
  handle: function(handlerInput){
    var msg = end_message;
    return handlerInput.responseBuilder.speak(msg).reprompt(msg).getResponse();
  }
}

const ClovaGuideIntentHandler = {
  canHandle: function(handlerInput){
    return handlerInput.requestEnvelope.isMatch('Clova.GuideIntent');
  },
  handle: function(handlerInput){
    var msg = help_message; //"このスキルは漢字、英語、百人一種などを読み上げます。小3の漢字を読み上げて！などと聞いてみて下さい";
    return handlerInput.responseBuilder.speak(msg).reprompt(msg).getResponse();
  }
}

const ReadIntentHandler = {
  canHandle: function(handlerInput){
    return handlerInput.requestEnvelope.isMatch('ReadIntent');
  },
  handle: function(handlerInput){
      console.log('Request ReadIntent');
      var SubjectSlot= handlerInput.requestEnvelope.request.intent.slots.SubjectSlot.value;
      var GradeSlot  = handlerInput.requestEnvelope.request.intent.slots.GradeSlot.value;
      var NumberSlot = default_read;
      console.log(SubjectSlot, GradeSlot);
      var all_text = get_read_text(SubjectSlot, GradeSlot, default_read);
      var yomi_msg = all_text.split("|")[0]
      var line_msg = all_text.split("|")[1]
      var msg  = GradeSlot + "の" + SubjectSlot;
      line_msg = msg + line_msg;
      msg += "を" + NumberSlot + "個、読み上げます！書き取りしてみて下さいね。"; //" + break_time + "秒おきに
      msg += "用意はいいですか？　ではスタート！　"; //<break time=\"1s\" />
      msg += yomi_msg;
      msg += "これで" + NumberSlot + "個読み上げました。ちゃんと書き取り出来ましたか？優しい人に丸つけしてもらって下さいね！また、"
      msg += add_message

      async.waterfall([
          function post_line_msg(callback) {
              msg_txt = {
                "type": "text",
                "text": line_msg
              }
              console.log(line_msg, msg_txt);
              const client = new line.Client({
                channelAccessToken: process.env.ACCESSTOKEN
              });
              client.pushMessage(process.env.USERID, msg_txt)
              .then(() => {
                callback(null, {});
              })
              .catch((error) => {
                callback(null, {});
              });

              /*
              var data = JSON.stringify({
                 "to": process.env.USERID,//CHANNEL設定画面で確認
                 "messages": msg_txt
              });
              console.log("Line post done:"+data);

              console.log(data);
              opts = {
                  hostname: 'api.line.me',
                  path: '/v2/bot/message/push',
                  headers: {
                      "Content-type": "application/json; charset=UTF-8",
                      "Content-Length": Buffer.byteLength(data),
                      "Authorization": "Bearer " + process.env.ACCESSTOKEN //CHANNEL設定画面で確認
                  },
                  method: 'POST',
              };
              console.log(opts);

              var req = https.request(opts, function(res) {
                  res.on('data', function(res) {
                      console.log(res.toString());
                  }).on('error', function(e) {
                      console.log('ERROR: ' + e.stack);
                  });
              });
              req.write(data);
              req.end();*/
          }
        ], function (err, result) {
      });

      console.log("speak:"+msg);
      return handlerInput.responseBuilder.speak(msg).getResponse();
  }
}

const errorHandler = {
  canHandle: function(handlerInput){
    return true;
  },
  handle: function(handlerInput){
    var msg = "エラー発生!もう一度聞いてみて下さい！";
    return handlerInput.responseBuilder.speak(msg).reprompt(msg).getResponse();
  }
}
/*
exports.handler = clova.extensionBuilders
  .addRequestHandlers(LaunchRequestHandler,SessionEndedRequestHandler,ClovaGuideIntentHandler,ReadIntentHandler)
  .addErrorHandlers(errorHandler)
  .lambda()
*/
exports.handler = async function(event, content) {
  // 公開鍵を取得
  const certificateBody = getCertificateBody();

  // signatureを検証
  var headerSignature = event.headers.signaturecek || event.headers.SignatureCEK;
  checkSignature(certificateBody, headerSignature, JSON.stringify(event.requestParameters));

  // applicationIdを検証
  var applicationId = 'net.ktrips.yomi';
  checkApplicationId(event.requestParameters, applicationId);

  clova.extensionBuilders.addRequestHandlers(
    LaunchRequestHandler,
    SessionEndedRequestHandler,
    ClovaGuideIntentHandler,
    ReadIntentHandler
  )
    .addErrorHandlers(errorHandler)
  return clova.extensionBuilders.invoke(event.requestParameters);
};

// signatureを検証
function checkSignature(certificateBody, signature, requestParameters) {
  const { createVerify} = require('crypto')
  const veri = createVerify('RSA-SHA256');
  veri.update(requestParameters, 'utf8');

  if (!veri.verify(certificateBody, signature, 'base64')) {
    throw new Error('signatureが違うよ!! これはCEKからのリクエストじゃないかもよ!!');
  }
}

// applicationIdの検証
function checkApplicationId(jsonRequestBody, applicationId) {
  if (jsonRequestBody.context.System.application.applicationId !== applicationId) {
    throw new Error('ExtensionId(applicationId)が間違ってるよ');
  }
}

// ./signature-public-key.pemを読み込む
function getCertificateBody() {
  var fs = require('fs');
  var cert = fs.readFileSync('./signature-public-key.pem', 'utf8');
  return cert;
}
