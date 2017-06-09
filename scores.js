const config = JSON.parse(fs.readFileSync('config.json'));
var redis = require('redis');
var http = require('http');
var https = require('https');
var request = require("request");
var restler = require("restler");
const Recognize = require('recognize');
const vk = new (require('vk-io'));
var fs = require('fs');
var client = redis.createClient();
const token = config.vk_token;  

client.on('connect', function() {
    console.log('Redis client connected!');
    vk.setToken(token);
    
});

const recognize = new Recognize('rucaptcha', {
    key: config.rucaptcha
});

recognize.balanse(function(price)
{
    console.log('RuCaptcha Balance: ', price);
});

function SendCaptcha(src, callback){
    download(src, 'captcha.png', function(){
 		fs.readFile('./captcha.png', function(err, data){
    		recognize.solving(data, function(err, id, code)
    		{
				return callback(code,id);
      	   });
		});
	});   
}

vk.setCaptchaHandler((src,again) => {
    SendCaptcha(src, function(code,id) { 
        again(code)
        .catch(() => {
            recognize.report(id,function(err, answer)
        	{     	
            console.log("report captcha!");
                });
        });                         
    });
});

function uploadPic(path, callback) {
	request.get("https://api.vk.com/method/photos.getMessagesUploadServer?access_token="+token+"&v=5.64", function (err, res, body)
	{
   		var sd = JSON.parse(body);
    	var link = sd["response"]["upload_url"];	
    	var album = sd["response"]["aid"];	
    	var user = sd["response"]["mid"];	
		fs.stat(path, function(err, stats) {
    		restler.post(link, {
        	multipart: true,
        	data: {
        		"photo": restler.file(path, null, stats.size, null, "multipart/form-data")
        	}
        }).on("complete", function(data) {
        	data = JSON.parse(data);
        	var server  = data.server;
        	var photos = data.photo;
        	var hash = data.hash;
        	request.get("https://api.vk.com/method/photos.saveMessagesPhoto?server="+server+"&photo="+photos+"&hash="+hash+"&access_token="+token+"&v=5.64", function (err, res, body)
        	{
				var data = JSON.parse(body);
    			callback("photo"+data["response"][0]["owner_id"]+"_"+data["response"][0]["id"]);
    		});
        });
    });   
 });
}

client.on("message", function(channel, message) {
	newScore = JSON.parse(message);
	if(newScore.score.pp<250)
		return;
	var beatmapPicPath = newScore.beatmap.beatmapSetID+".jpg";
	var beatmapPic = fs.createWriteStream(beatmapPicPath);
	https.get("https://assets.ppy.sh/beatmaps/"+newScore.beatmap.beatmapSetID+"/covers/cover.jpg", function(response) {
 		response.pipe(beatmapPic);
 		setTimeout(function () {
 			uploadPic(beatmapPicPath, function(doc) {
					let msg = newScore.user.username + " | "+newScore.beatmap.song_name+" "+getScoreMods(newScore.score.mods)+" "+ScoreInfo(newScore)+" "+"#"+newScore.score.rank+" | "+newScore.score.pp+"pp";
 					vk.api.messages.send({
						chat_id:12,
						message:msg, 
						attachment:doc
					});
 					fs.unlinkSync(beatmapPicPath);	
 			});	
 		}, 1200);	
	});	
});

function ScoreInfo(newScore){
	let acc = newScore.score.accuracy * 100;
	if (acc == 100) return "SS"
	acc = "("+acc.toFixed(2)+"%)";
	let fc = getFc(newScore.score.combo,newScore.beatmap.max_combo,newScore.score.missess);
	return acc+" "+fc;
}

function getFc(combo, maxCombo, misses){
	var TotalCombo = combo+"/"+maxCombo;
	if(misses == 0){
		if(combo+12 < maxCombo) return TotalCombo+" SB"; else return "FC";
	}else{
		if (misses < 8)
			return  TotalCombo+" "+misses+"xMiss";  
		else return TotalCombo;
	}
}

function getScoreMods(m) {
	var r = '';
	var hasNightcore = false, hasPF = false;
	if (m & NoFail) {
		r += 'NF';
	}
	if (m & Easy) {
		r += 'EZ';
	}
	if (m & NoVideo) {
		r += 'NV';
	}
	if (m & Hidden) {
		r += 'HD';
	}
	if (m & HardRock) {
		r += 'HR';
	}
	if (m & Nightcore) {
		r += 'NC';
		hasNightcore = true;
	}
	if (!hasNightcore && (m & DoubleTime)) {
		r += 'DT';
	}
    if (m & Perfect) {
		r += 'PF';
        hasPF = true;
	}
	if (m & Relax) {
		r += 'RX';
	}
	if (m & HalfTime) {
		r += 'HT';
	}
	if (m & Flashlight) {
		r += 'FL';
	}
	if (m & Autoplay) {
		r += 'AP';
	}
	if (m & SpunOut) {
		r += 'SO';
	}
	if (m & Relax2) {
		r += 'AP';
	}
	if (!hasPF && (m & SuddenDeath)) {
		r += 'SD';
	}
	if (m & Key4) {
		r += '4K';
	}
	if (m & Key5) {
		r += '5K';
	}
	if (m & Key6) {
		r += '6K';
	}
	if (m & Key7) {
		r += '7K';
	}
	if (m & Key8) {
		r += '8K';
	}
	if (m & keyMod) {
		r += '';
	}
	if (m & FadeIn) {
		r += 'FD';
	}
	if (m & Random) {
		r += 'RD';
	}
	if (m & LastMod) {
		r += 'CN';
	}
	if (m & Key9) {
		r += '9K';
	}
	if (m & Key10) {
		r += '10K';
	}
	if (m & Key1) {
		r += '1K';
	}
	if (m & Key3) {
		r += '3K';
	}
	if (m & Key2) {
		r += '2K';
	}
    if (m & SCOREV2) {
		r += 'V2';
	}
	if (r.length > 0) {
		return "+ "+r;
	} else {
		return '';
	}
}

var None = 0;
var NoFail = 1;
var Easy = 2;
var NoVideo = 4;
var Hidden = 8;
var HardRock = 16;
var SuddenDeath = 32;
var DoubleTime = 64;
var Relax = 128;
var HalfTime = 256;
var Nightcore = 512;
var Flashlight = 1024;
var Autoplay = 2048;
var SpunOut = 4096;
var Relax2 = 8192;
var Perfect = 16384;
var Key4 = 32768;
var Key5 = 65536;
var Key6 = 131072;
var Key7 = 262144;
var Key8 = 524288;
var keyMod = 1015808;
var FadeIn = 1048576;
var Random = 2097152;
var LastMod = 4194304;
var Key9 = 16777216;
var Key10 = 33554432;
var Key1 = 67108864;
var Key3 = 134217728;
var Key2 = 268435456;
var SCOREV2 = 536870912;

//Subscribe to redis pubsub
client.subscribe("scores:new_score");

