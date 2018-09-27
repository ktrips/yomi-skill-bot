import urllib.parse
import boto3
from datetime import datetime
import random
import re

import requests
import os
import urllib.request
import json
#from bs4 import BeautifulSoup
#s3 = boto3.resource('s3')
#BUCKET_NAME= 'senseipacket'

import getRead

# LINE Messaging Reply
line_url = "https://api.line.me/v2/bot/message"
reply_url= line_url + "/reply"
push_url = line_url + "/push"
# LINE Token
token = os.environ["CHANNEL_ACCESS_TOKEN"]
userid= os.environ["USER_ID"]
headers = {
    "Authorization" : "Bearer "+ token,
    "Content-type": "application/json"
}
skill_name = "読みの神"

KanjiSlot= ["漢字","かんじ","漢", "漢語", "漢検", "かんけん", "カンケン", "漢字検定"]
KankenConv={10:"小1", 9:"小2", 8:"小3", 7:"小4", 6:"小5", 5:"小6", 4:"中1", 3:"中2", 2:"中3"}
EngSlot  = ["English","english","英語","英","えいご","米語", "英検", "えいけん", "エイケン", "英語検定"]
EikenConv= {5:"中1", 4:"中2", 3:"中3", 2.5:"高1", 2:"高2", 1.5:"高3", 1:"大"}
HyakuSlot= ["百人一首","かるた","カルタ","百人","一首"]

test_sets = ["小"+str(random.randint(1,6)), "漢字", 2, "ちはや", "N", "ゆっくり"] #[grade, subject, read number, hyaku word, answer, speed]
default_read = 10
break_time = 5

help_message = skill_name + "は、小・中学生の漢字や、中学の英語、漢検、英検、百人一首などを読み上げます。"
add_message  = test_sets[0] + "の" + test_sets[1] + "を読み上げて！などと聞いてみて下さい！"
help_message+= add_message
end_message  = skill_name + "を使ってくれてありがとう！また何でも聞いてね！"


def get_welcome_response(GradeSlot, SubjectSlot, NumberSlot):
    read_result = getRead.get_read(GradeSlot, SubjectSlot, NumberSlot)
    talk_message+= read_result+"などを読み上げますか？" if read_result else "がありません！"
    data = {
        "to": userid,
        "messages": [
            {
                "type": "text",
                "text": talk_message
            }
        ]
    }
    #requests.post(push_url, data=json.dumps(data), headers=headers)
    # リマインドメッセージがない場合は何をリマインドするか確認する
    return talk_message

def lambda_handler(event, context):
    if event['request']['type'] == "IntentRequest":
        intent = event['request']['intent']
        print(intent)
        intent_name  = intent['name']
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
        elif intent_name == "AMAZON.HelpIntent":
            talk_message = help_message
            endSession = False
        elif intent_name == "AMAZON.CancelIntent" or intent_name == "AMAZON.StopIntent":
            talk_message = end_message
            endSession = True
        else:
            raise ValueError("Invalid intent")
            endSession = True

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

    response = {
        'version': '1.0',
        'response': {
            'outputSpeech': {
                'type': 'SSML',
                'ssml': '<speak>'+talk_message+'</speak>'
            },
            "shouldEndSession": endSession
        }
    }
    return response
