var redis = require('redis');
var http = require('http');
var https = require('https');
var request = require("request");
var restler = require("restler");
const Recognize = require('recognize');
var osu = new(require("./osu_utils.js"));
const vk = new (require('vk-io'));
var fs = require('fs');
const config = JSON.parse(fs.readFileSync('config.json'));
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
					let msg = newScore.user.username + " | "+newScore.beatmap.song_name+" "+osu.getScoreMods(newScore.score.mods)+" "+ScoreInfo(newScore)+" "+"#"+newScore.score.rank+" | "+newScore.score.pp+"pp";
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
		if (misses < 10)
			return  TotalCombo+" "+misses+"xMiss";  
		else return TotalCombo;
	}
}


//Subscribe to redis pubsub
client.subscribe("scores:new_score");












