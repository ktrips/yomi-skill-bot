const line = require('@line/bot-sdk');
var request = require('request');
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
var dataTypeWords= "答え、問題、その他";
var dataCategoryWords = "漢字、英語、質問";

var skillName= "読みの神";
var kanjiSlot= ["漢字","かんじ","漢", "漢語"];
var engSlot  = ["English","english","英語","英","えいご","米語"];
var engWord  = {"N":"名詞","V":"動詞","A":"形容詞","O":"その他"};
var hyakuSlot= ["百人一首","かるた","カルタ","百人","一首"];
var kanNum   = {"一":1, "二":2, "三":3, "四":4, "五":5, "六":6, "１":1, "２":2, "３":3, "４":4, "５":5, "６":6};
var grades   = {"幼":"k", "小":"", "中":"j", "高":"h", "大":"u"};

//random_grade = "小"+str(random.randint(1,6));

var testSets= ["小3", "漢字", 2, "ちはや", "N", "ゆっくり"];
//[grade, subject, read number, hyaku word, answer, speed]
var default_read= 10;
var break_time  = 5;
var add_message = testSets[0]+"の"+testSets[1]+"を読み上げて！などと聞いてみて下さい！";
var help_message= skillName+"は、小・中学生の漢字や、中学の英語、百人一首などを読み上げます。"+add_message;
var end_message = skillName+"を使ってくれてありがとう！また何でも聞いてね！";

var prb_word = ["問題","問い","質問","Pr"]
var ans_word = ["答え","応え","回答","解答","解","応","答","An"]


var speaker = "クローバ";
var line_bot_url = "https://api.line.me/v2/bot";

var date = new Date();
var dd = ("0"+date.getDate()).slice(-2);
var year = date.getFullYear();
var month= ("0"+(date.getMonth()+1)).slice(-2);
var week = date.getDay();
var day  = ("0"+date.getDate()).slice(-2);
var hour = ("0"+date.getHours()).slice(-2);
var minute=("0"+date.getMinutes()).slice(-2);
var second=("0"+date.getSeconds()).slice(-2);
var timetext= year+"-"+month+"-"+day+" "+hour+":"+minute+":"+second;

exports.handler = function(event, context) {
    console.log('Received event:', JSON.stringify(event, null, 2));
    res = event.events[0];
    var msgReply= res.replyToken.toString();
  	var msgType = res.message.type;
  	var msgId   = res.message.id;
  	var msgOriginal = res.message.text;
  	var userId  = res.source.userId;
  	var userType= res.source.type;
  	var msgTime = timetext; //res.timestamp.toString();
  	var msgImage= line_bot_url + '/message/' + res.message.id +'/content';
    var displayName= "Noname"
    if (userType == 'user') {
        var opts = {
            url: line_bot_url + '/profile/' + userId,
            json: true,
            headers: {'Authorization': 'Bearer '+process.env.ACCESSTOKEN}
        };
        request.get(opts, function(error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log(body);
                displayName = body.displayName;
            } else {
              displayName = 'No name';
            }
        });
    } else {
      displayName = 'No name';
    }
    console.log(msgId+"-"+msgType+"-"+msgReply+"-"+userType+userId+"-"+msgTime+msgImage+displayName);

    async.waterfall([
        function recognize(callback) {
            if (msgType === 'text') {
            	console.log('rec text:' + msgOriginal.substr(0, 2));
            	if (msgOriginal.substr(0, 2) == "マル") {
            		callback(null, 'answer');
            	} else if (msgOriginal.substr(0, 2) == "クロ") {
                callback(null, 'problem');
              } else if (msgOriginal.substr(0, 2) == "問題") {
                callback(null, 'prob_up');
              } else if (msgOriginal.substr(0, 2) == "答え") {
                callback(null, 'ans_up');
            	} else if (msgOriginal.match(/^時間/)) {
                callback(null, 'time');
              } else {
                callback(null, 'prob_ask');
              }
            } else if (msgType === 'image') {
              callback(null, 'image');
            } else {
              callback(null, 'other');
            }
        },
        function run(data, callback) {
            console.log('run data:' + data);
            if (data === 'prob_up') {
              text = "\uDBC0\uDCB36では、↓下のメニューから、" + prb_word[0] + "の写真を撮るか\uDBC0\uDC6A、アップロードしてみて下さい。\uDBC0\uDCB3";
              callback(null, text);
            } else if (data === 'ans_up') {
              text = "\uDBC0\uDCB35では、↓下のメニューから、" + ans_word[0] + "の写真を撮るか\uDBC0\uDC6A、アップロードしてみて下さい。\uDBC0\uDCB3";
              callback(null, text);
            } else if (data === 'problem') {
              text = "LINEのクローバが無い人は、ここからゲットできますよ！\n" + "\uDBC0\uDC85 " + "https://ktri.ps/ClovaMini " + "\uDBC0\uDC5C";
              callback(null, text);
            } else if (data === 'answer') {
              text = "全10問中、3問正解の30点でした！もっとがんばりましょう" + "\uDBC0\uDC8E";
              callback(null, text);

            } else if (data === 'time') {
                console.log('run time');
                var text = timetext; //year+"年"+month+"月"+day+"日"+hour+"時"+minute+"分"+second+"秒";
                callback(null, text);
            } else if (data === 'prob_ask') {

                if (msgOriginal.match(/^漢字/)) {
						      var keySub = "kanji";
                  var keySubW= "漢字"
					      } else if (msgOriginal.match(/^英語/)) {
        				  keySub = "eng";
                  keySubW= "英語";
    				    } else {
        				  keySub = "kanji";
                  keySubW= "";
        			  }

                if ( msgOriginal.match(/^中/) ) {
                  var grdSeg = "j";
                  var grdSegW= "中学";
                } else if ( msgOriginal.match(/^高/) ) {
                  grdSeg = "h";
                  grdSegW= "高校";
                } else if ( msgOriginal.match(/^小/) ) {
                  grdSeg = "";
                  grdSegW= "小学";
                } else {
                  grdSeg = "";
                  grdSegW= "";
                }

                if ( msgOriginal.match(/\d{1}/) ) {
                  var keyGrd = msgOriginal.match(/\d{1}/);
                } else {
                  var keyGrd = 3;
                }
                var dataType = "problem";
                var dataTypeW= "問題";
    				    text = grdSegW + keyGrd + "年の" + keySubW + dataTypeW + ":\n";
    				    var KEY_NAME = keySub + grdSeg + keyGrd + ".json";
    					  console.log(KEY_NAME);

    				    var params = {
    					    Bucket: BUCKET_NAME,
    					    Key: KEY_NAME
    					  };
      					s3.getObject(params, function(err, data) {
      					    if (err) {
      					        console.log(err, err.stack);
      					        callback(null, err);
      					    } else {
      					        var objects = JSON.parse(data.Body.toString());
      					        //console.log(objects);
      					        /*for (var i = 0; i < 10; i++) {
      					        	var obj = objects[ Math.floor( Math.random() * objects.length ) ];
      					        	console.log(obj);
      					        	var word = obj["word"];
      					        	var read = obj["read"][0];
      					        	console.log(word, read);
      					        }*/
      					        var min = 0;
      					        var max = objects.length;
      					        for (var i = 0; i < 10; i++) {
        					        	var n = Math.floor( Math.random() * (max+1 - min) ) + min;
                          	var word   = objects[n]["word"];
                          	var read   = objects[n]["read"][0];
                          	var meaning= read["meaning"];
                          	var example= read["example"][0];
                          	console.log(word, meaning, example);
                          	text += word + "について" + example + ",\n";
      	                }

                        console.log("TableName:"+TableName + " id:"+msgId + " msgType:"+msgType + " msgReply:"+msgReply + " displayName:"+displayName + " dataType:" + dataType + " dataCategory:" + keySub + " text:"+text + " userId:"+userId + " msgTime:"+msgTime + " msgImage:"+msgImage);
                        dynamodb.putItem(
                            {"TableName": TableName,
                            "Item": {"id": {"S": msgId},
                                    "msgType": {"S": msgType},
                                    "msgReply": {"S": msgReply},
                                    "displayName": {"S": displayName},
                                    "dataType":{"S": dataType},
                                    "dataCategory":{"S": keySub},
                                    "text": {"S": text},
                                    "userId": {"S": userId},
                                    "msgTime": {"S": msgTime},
                                    "msgImage": {"S": msgImage} }
                            },
                            function (err, data) {
                                if (err) { console.log(err, err.stack);
                                } else { console.log("dynam"+data);
                                }
                            }
                        );

                        text = text + "\nこれを読んであげるか\uDBC0\uDC8F、「クローバ、読みの神を開いて、問題を読んで」と言ってみて下さい！"; //"\uDBC0\uDC84";
                        callback(null, text);
      					    }
      					});
            } else if (data === 'image') {
                async.waterfall([
                    function getImage(callback2) {
                        console.log('get image'+msgId);
                        var opts = {
                            url: line_bot_url + '/message/'+msgId+'/content',
              							headers: {
              								"Content-type": "application/json; charset=UTF-8",
              								"Authorization": " Bearer " + process.env.ACCESSTOKEN
              							},
              							method:'GET',
              							encoding: null
                        };
                        console.log(opts);
                        request(opts, function(error, response, body) {
                            if (!error && response.statusCode == 200) {
                                var img = body.toString('base64');
                                callback2(null, img);
                            } else {
                                callback2(error);
                            }
                        });
                    },
                    function sendCloudAPI(img, callback2) {
                       console.log('send cloud api');
                        var data = {
                            "requests":[
                                {
                                    "image":{"content": img},
                                    "features":[
                                        {"type": "TEXT_DETECTION", "maxResults": 3}
                                        /*{"type": "FACE_DETECTION", "maxResults": 3},
                                        {"type": "LABEL_DETECTION", "maxResults": 3},
                                        {"type": "LANDMARK_DETECTION", "maxResults": 5},
                                        {"type": "LOGO_DETECTION", "maxResults": 5},
                                        {"type": "SAFE_SEARCH_DETECTION", "maxResults": 5}*/

                                    ]
                                }
                            ]
                        };
                        var opts = {
                            url: 'https://vision.googleapis.com/v1/images:annotate?key=' + process.env.GAPKEY,
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify(data)
                        };
                        var text = '';
                        var text2= '';
                        request.post(opts, function (error, response, body) {
                            console.log(body);
                            body = JSON.parse(body);
                            var textAnnotations = body.responses[0].textAnnotations;
                            /*
                            var labelAnnotations = body.responses[0].labelAnnotations;
                            var faceAnnotations = body.responses[0].faceAnnotations;
                            var landmarkAnnotations = body.responses[0].landmarkAnnotations;
                            var logoAnnotations = body.responses[0].logoAnnotations;
                            var safeSearchAnnotation = body.responses[0].safeSearchAnnotation;
                            if (labelAnnotations !== undefined) {
                                for (var i = 0; i < labelAnnotations.length; i++) {
                                    text += '"' + labelAnnotations[i].description + '"' + " and \n";
                                }
                            }
                            if (faceAnnotations !== undefined) {
                                text += faceAnnotations.length + " persons and \n\n";
                            }
                            if (landmarkAnnotations !== undefined) {
                                text += landmarkAnnotations[0].description + " place \n\n";
                            }
                            */

                            if (textAnnotations !== undefined) {
                                for (var i = 1; i < textAnnotations.length; i++) {
                                	j = parseInt(i/10);
                                	var textAnnotate = textAnnotations[i].description.replace(/\n/g, ' ');
                                	console.log(textAnnotate);
                                	if (j < 1) {
                                		text += textAnnotate + ", ";
                                	} else if (1<= j < 2) {
                                		text2+= textAnnotate + ", ";
                                	}
                                }
                            }
                            text = text.replace(/\n+$/g,'');
                            text2= text2.replace(/\n+$/g,'');
                            var text12= text + text2;
                            console.log(text12);
                            var dataType = "problem";
                            var dataCategory="KanjiImage";
                            console.log("TableName:"+TableName + " id:"+msgId + " msgType:"+msgType + " msgReply:"+msgReply + " displayName:"+displayName + " dataType:" + dataType + " dataCategory:" + dataCategory + " text:"+text + " userId:"+userId + " msgTime:"+msgTime + " msgImage:"+msgImage);
                            dynamodb.putItem(
                                {"TableName": TableName,
                                  "Item": {"id": {"S": msgId},
                                        "msgType": {"S": msgType},
                                        "msgReply": {"S": msgReply},
                                        "displayName": {"S": displayName},
                                        "dataType":{"S": dataType},
                                        "dataCategory":{"S": dataCategory},
                                        "text": {"S": text},
                                        "userId": {"S": userId},
                                        "msgTime": {"S": msgTime},
                                        "msgImage": {"S": msgImage} }
                                },
                                function (err, data) {
                                    if (err) { console.log(err, err.stack);
                                    } else { console.log("dynamo:"+data); }
                                }
                            );

                            /*var dataType = "問題";
                            var message = displayName + "さんの" + dataType + "：\n" + text + "\n"
              		        	message += "「" + speaker + skillName + "を開いて、" + displayName + "の" + dataType + "を読んで」と言ってみて下さい！";*/
              		        	//var message2= dataType + "の続き2：\n" + text2

              		        	text = "画像から" + text.substr(0, 100) + "などを読み取りました。\nこれを問題として「読み上げ」たいですか？それとも、解答として「採点して」欲しいですか？"
                            callback2(null, text);
                        });
                    }

                ], function (err, result) {
                    callback(null, result);
                });

            } else {
                console.log('run else');
                var text = '分かりませんでした！';
                callback(null, text);
            }
        },
        function postToLine(text, callback) {
          console.log('run post: ' + text)
          const client = new line.Client({
            channelAccessToken: process.env.ACCESSTOKEN
          });

          const message_txt = {type: 'text', text: text}; //+"\uDBC0\uDC79"};

          const button_txt = {
          	  "type": "template",
              "altText": "Problem or Answer for the uploaded image",
              "template": {
                "type": "buttons",
              	"thumbnailImageUrl": "https://s3.amazonaws.com/senseipacket/yomikami108.jpg",
              	"title": text,
                "text": "この画像の文字は、読み上げたい問題ですか？",
                "actions": [
                	{"type": "message", "label": "問題", "text": "クローバ、読みの神を開いて、問題を読み上げて！と言ってみて下さい！"},
                	{"type": "message", "label": "答え", "text": "マル付けしますね、ちょっと待って下さい！"}
                ]
              }
          }

          const problem_txt = {
          	  "type": "template",
              "altText": "Problem or Answer?",
              "template": {
                "type": "confirm",
                "text": text,
                "actions": [
                	{"type": "message", "label": "読み上げ！", "text": "クローバ、読みの神を開いて、問題を読み上げて！と言ってみて下さい \uDBC0\uDC79"},
                	{"type": "message", "label": "採点して！", "text": "マル付けしますね、ちょっと待って下さい \uDBC0\uDC41 \uDBC0\uDC6C"}
                ]
              }
          }

          var post_text = "No post text!";
          if (msgType == 'image') {
          	post_text = problem_txt;
          } else if (msgType == 'text') {
          	post_text = message_txt;
          } else {
            post_text = message_txt;
          }
          client.replyMessage(res.replyToken, post_text)

          .then(() => {
            callback(null, {});
          })
          .catch((error) => {
            callback(null, {});
          });
        }
    ], function (err, result) {
    });
};
