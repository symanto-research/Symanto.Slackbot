

const express = require('express');
const app = express();

const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();

const rawBodyBuffer = (req, res, buf, encoding) => {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || 'utf8');
  }
};
app.use(bodyParser.urlencoded({ verify: rawBodyBuffer, extended: true }));
app.use(bodyParser.json({ verify: rawBodyBuffer }));

/* Handling events */

app.get('/health', (req, res) => {
  res.send('Server is running');
});

app.post('/events', (req, res) => {

  // App setting validation
  if (req.body.type === 'url_verification') {
    res.send(req.body.challenge);
  }

  // Events 
  else if (req.body.type === 'event_callback') {
    res.sendStatus(200);

    const { bot_id, text, user, channel } = req.body.event;
    if (!text) return;

    let regex = /(^\/)/;
    if (bot_id || regex.test(text)) return;
    if (req.body.event.subtype === 'channel_join' || req.body.event.subtype === 'bot_add' || req.body.event.subtype === 'bot_remove') return;

    // Get workspace language

    axios.post('https://slack.com/api/conversations.info?token=' + process.env.SLACK_ACCESS_TOKEN + '&channel=' + channel + '&include_locale=true&pretty=1')
      .then((response) => {
        let locale = response.data.channel.locale;
        analyzeTextByDLApi(text, user, channel, locale);
      })
  }

});

const analyzeTextByDLApi = (text, user, channel, locale) => {
  const jsonString = JSON.stringify({
    id: "",
    language: "",
    text: text
  });
  const input = "[" + jsonString + "]";

  const languageDetection = process.env.DL_LANGUAGEDETECTION;
  const sentimentUrl = process.env.DL_SENTIMENT;

  const config = {
    method: 'post',
    headers: {
      "Content-Type": "application/json",
      "API_KEY": process.env.API_KEY
    }
  };

  axios.post(languageDetection, input, config)
    .then((response) => {

      const lang = response.data[0].detected_language;
      if (lang === "en" || lang === "de" || lang === "es") {
        const sentimentJson = JSON.stringify({
          id: "",
          language: lang,
          text: text
        });
        const sentimentInput = "[" + sentimentJson + "]";
        axios.post(sentimentUrl, sentimentInput, config)
          .then((response) => {
            const result = JSON.stringify(response.data);
            const finalResult = JSON.parse(result);
            const final = finalResult[0].predictions[0].prediction;

            axios.post('https://slack.com/api/users.info?token=' + process.env.SLACK_ACCESS_TOKEN + '&user=' + user + '&pretty=1')
              .then((response) => {
                var username = response.data.user.name;
                var realname = response.data.user.real_name;
                if (realname) {
                  username = realname;
                }
                let emoji;
                if (final === 'positive') {
                  emoji = ':slightly_smiling_face:';
                }
                else if (final === 'negative') {
                  emoji = ':white_frowning_face:';
                }
                var finalMessage;
                if (locale === "en-GB" || locale === "en-US") {
                  finalMessage = username + ' sent a ' + final + ' message ' + emoji
                }
                else if (locale === "de-DE") {
                  finalMessage = username + ' hat eine ' + final + ' Nachricht gesendet ' + emoji
                }

                else if (locale === "es-ES") {
                  finalMessage = username + ' envió un mensaje ' + final + " " + emoji
                }
                else {
                  finalMessage = username + ' sent a ' + final + ' message ' + emoji
                }

                axios.post('https://slack.com/api/chat.postMessage?token=' + process.env.SLACK_ACCESS_TOKEN + '&channel=' + channel + '&text=' + encodeURIComponent(finalMessage) + '&pretty=1');
              })
          })
      }
      else {
        var notSupported;
        if (locale === "en-GB" || locale === "en-US") {
          notSupported = "language is not supported. Supported languages are: en,de,es";
        }
        else if (locale === "de-DE") {
          notSupported = "Sprache wird nicht unterstützt. Unterstützte Sprachen sind: en, de, es"
        }

        else if (locale === "es-ES") {
          notSupported = "El idioma no es compatible. Los idiomas admitidos son: en, de, es"
        }
        
        const config = {
          method: 'post',
          headers: {
            "Content-Type": "application/json;charset=utf-8"
          }
        };
        axios.post('https://slack.com/api/chat.postMessage?token=' + process.env.SLACK_ACCESS_TOKEN + '&channel=' + channel + '&text=' + encodeURIComponent(notSupported) + '&pretty=1', config);

      }

    })
}


const server = app.listen(process.env.PORT || 80, () => {
  console.log('Express server listening on port %d in %s mode', server.address().port, app.settings.env);
});
