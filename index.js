
const express = require('express');
const app = express();

const bodyParser = require('body-parser');
const axios = require('axios');
const qs = require('qs');
require('dotenv').config();

const rawBodyBuffer = (req, res, buf, encoding) => {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || 'utf8');
  }
};
app.use(bodyParser.urlencoded({verify: rawBodyBuffer, extended: true }));
app.use(bodyParser.json({ verify: rawBodyBuffer }));

const apiUrl = 'https://slack.com/api';

/* Handling events */

app.post('/events', (req, res) => {
    
  // App setting validation
  if (req.body.type === 'url_verification') {
    res.send(req.body.challenge);
  }

  // Events 

   else if (req.body.type === 'event_callback') {
    res.sendStatus(200);

    const {bot_id, text, user, channel} = req.body.event; 
    if(!text) return;

    let regex = /(^\/)/;
    if(bot_id || regex.test(text)) return;
    if(req.body.event.subtype==='channel_join' || req.body.event.subtype==='bot_add' || req.body.event.subtype==='bot_remove' ) return;
    analyzeTextByDLApi(text, user, channel);
    
  }
  
});
function analyzeTextByDLApi(text, user, channel)
{

      var jsonString = JSON.stringify({
        id:  "",
        language: "en",
        text: text
      });
      var input= "["+ jsonString + "]";       

      var sentimentUrl=process.env.DL_SENTIMENT;
      var config = {
        method: 'post',
        headers:  {
            "Content-Type": "application/json",
            "API_KEY" :process.env.API_KEY
        }
      };
      var final = "";
      var username= "";
      axios.post(sentimentUrl , input, config)
      .then(function (response) {
        var result = JSON.stringify(response.data);
        var finalResult= JSON.parse(result);
         final = finalResult[0].predictions[0].prediction ;
         console.log(final);
         
         axios.post('https://slack.com/api/users.info?token='+ process.env.SLACK_ACCESS_TOKEN +'&user='+ user +'&pretty=1')
          .then(function (response) {
            username = response.data.user.name;
            var emoji = "";
            if(final==='positive')
            {
              emoji = ':slightly_smiling_face:';
            }
            else if(final==='negative'){
              emoji = ':white_frowning_face:';
            }
            axios.post('https://slack.com/api/chat.postMessage?token='+ process.env.SLACK_ACCESS_TOKEN +'&channel=' +channel+ '&text='+username +' sent a '+final+ ' message ' + emoji +'&pretty=1');
          }) 
      })   
}


const server = app.listen(process.env.PORT || 443 || 'https://deeplearning-slackbot-dev.azurewebsites.net/events', () => {
  console.log('Express server listening on port %d in %s mode', server.address().port, app.settings.env);

});
