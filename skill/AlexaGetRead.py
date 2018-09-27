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
s3 = boto3.resource('s3')
BUCKET_NAME= 'senseipacket'

skill_name = "読みの神"

KanjiSlot= ["漢字","かんじ","漢", "漢語", "漢検", "かんけん", "カンケン", "漢字検定"]
KankenConv={10:"小1", 9:"小2", 8:"小3", 7:"小4", 6:"小5", 5:"小6", 4:"中1", 3:"中2", 2:"中3"}
EngSlot  = ["English","english","英語","英","えいご","米語", "英検", "えいけん", "エイケン", "英語検定"]
EikenConv= {5:"中1", 4:"中2", 3:"中3", 2.5:"高1", 2:"高2", 1.5:"高3", 1:"大"}
HyakuSlot= ["百人一首","かるた","カルタ","百人","一首"]

"""f    = open("readConv.json")
rdata= json.load(f)
f.close()"""

EngWord  = {"N":"名詞","V":"動詞","A":"形容詞","O":"その他"}
kan_num  = {"一":1, "二":2, "三":3, "四":4, "五":5, "六":6,  "七":7,  "八":8,  "九":9,  "十":10, "１":1, "２":2, "３":3, "４":4, "５":5, "６":6}

grades   = {"幼":"k", "小":"", "中":"j", "高":"h", "大":"u"}

ans_flag = "N"
break_time = 5

def get_hyaku(WordSlot):
    print(WordSlot)
    hyaku_url = 'http://api.aoikujira.com/hyakunin/get.php?fmt=json&key='
    url  = hyaku_url + WordSlot
    res  = requests.get(url)
    datas= res.json()
    #res = urllib2.urlopen(url)
    #datas=json.loads(res.read())
    random.shuffle(datas)
    result = []
    for data in datas:
        kami   = data["kami"]
        simo   = data["simo"]
        sakusya=data["sakusya"]
        result = [sakusya, kami, simo]
    return result

def get_read(GradeSlot, SubjectSlot, NumberSlot):
    if SubjectSlot in KanjiSlot:
        KeySub = "kanji"
    elif SubjectSlot in EngSlot:
        KeySub = "eng"
    else:
        KeySub = "other"
    GrdSeg = ""
    for k, v in grades.items():
        if GradeSlot.find(k) > -1:
            GrdSeg = v
    KeyGrd = re.sub(r'\D', '', GradeSlot)
    if KeyGrd == "":
        for k, v in kan_num.items():
            if GradeSlot.find(k) > -1:
                KeyGrd = v
            else:
                KeyGrd = 3
    KEY_NAME = KeySub + GrdSeg +str(KeyGrd) + ".json"
    print(GrdSeg, GradeSlot, KeyGrd, KEY_NAME)
    break_time = 0 if NumberSlot in [1,2,3] else 5
    
    obj = s3.Object(BUCKET_NAME, KEY_NAME)
    #print(obj.key)
    response = obj.get()
    body = response['Body'].read()
    #datas = body.decode('utf-8')
    datas = json.loads(body)
    random.shuffle(datas)
    #print(datas)
        
    words  = ""
    results= ""
    line_results= ""
    for i, data in enumerate(datas):
        if i < NumberSlot:
            words = data["word"]
            reads = data["read"]
            random.shuffle(reads)
            read_examples = ""
            line_examples = ""
            for j, read in enumerate(reads):
                if j < 1:
                    meanings = read["maening"]
                    for k,v in EngWord.items():
                        if k == meanings[0]:
                            mean = v
                    #mean = [v for k,v in EngWord.items() if k == meanings[0]]
                    examples = read["example"]
                    random.shuffle(examples)
                    print(str(i)+words+str(j)+meanings+examples[0])
                    read_examples += examples[0].split('|')[1] if SubjectSlot in KanjiSlot else mean + "の " +examples[0]
                    read_examples += "、<break time=\"" + str(break_time) + "s\" />"
                    read_answers = "答えは "
                    read_answers+= words if SubjectSlot in EngSlot else examples[0].split('|')[0]
                    read_answers+= "\n"
                    line_examples+= "("+str(i+1)+") " + read_examples + read_answers
                    read_examples+= read_answers if ans_flag == "Y" else ""
            results += words + "について、" if SubjectSlot in KanjiSlot else ""
            results += read_examples
            line_results += line_examples
    print(results, line_results)
    return results, line_results
