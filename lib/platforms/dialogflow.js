var _ = require('underscore');
var moment = require('moment');
var { ChatExpress, ChatLog } = require('chat-platform');
var utils = require('../../lib/helpers/utils');
var when = utils.when;

var Dialogflow = new ChatExpress({
  transport: 'dialogflow',
  bundle: true,
  transportDescription: 'Dialogflow',
  chatIdKey: function(payload) {
    if (payload != null && payload.session != null) {
      return payload.session.split('/')[4];
    }
  },
  userIdKey: function(payload) {
    if (payload != null && payload.session != null) {
      return payload.session.split('/')[4];
    }
  },
  language: function(payload) {
    if (payload != null && payload.queryResult != null && payload.queryResult.languageCode != null) {
      return payload.queryResult.languageCode;
    }
  },
  tsKey: function() {
    return moment();
  },

  routes: {
    '/redbot/dialogflow': function(req, res) {

      //if (req.body.request != null && req.body.request != null) {
        // eslint-disable-next-line no-console
        //console.log(prettyjson.render(req.body.request));
      //}

      var cloned = _.clone(req.body);

      // include http response in the original message, will be used to send response
      cloned.getResponse = function() {
        return res;
      };

      this.receive(cloned);
    },
    '/redbot/dialogflow/test': function(req, res) {
      res.send('ok');
    }
  },
  routesDescription: {
    '/redbot/dialogflow': 'Use this as Service Endpoint in the Dialogflow Console',
    '/redbot/dialogflow/test': 'Use this to test that your SSL (with certificate or ngrok) is working properly, should answer "ok"'
  }
});

var parseIntent = function(request) {

  // set the intent
  var intent = {
    intent: request.queryResult.intent.displayName,
    variables: {}
  };

  // extract slots
  for (const key in request.queryResult.parameters) {
    intent.variables[key] = request.queryResult.parameters[key];
  };

  return intent;
};

Dialogflow.in(function(message) {

  console.info(message);

  var payload = message.originalMessage;

  return new Promise(function(resolve) {
    // store the skill id in case it serves multiple skills
    if (payload.session != null) {
      message.originalMessage.applicationId = payload.session.split('/')[1];
    }

     _.extend(message.payload, { type: 'intent' }, parseIntent(payload));

    resolve(message);
  });

});

Dialogflow.out(function(message) {
  var server = this;
  var payload = _.isArray(message.payload) ? message.payload : [message.payload];
  return new Promise(function(resolve) {
    var response = message.originalMessage.getResponse();

    var dialogflowMessage = server.responseEnvelope();

    var messagePayload = _(payload).findWhere({ type: 'message' });

    dialogflowMessage.fulfillmentMessages.push(server.messagePayload(messagePayload));

    //console.log('------------------');
    //console.log(alexaMessage);
    //console.log('------------------');

    response.send(dialogflowMessage);
    resolve(message);
  });
});

Dialogflow.mixin({
  responseEnvelope: function() {
    return {
      fulfillmentMessages: []
    };
  },
  messagePayload: function(payload) {
    return {
      text: {
        text: [
          payload.content
        ]
      }
    };
  }
});

// log messages, these should be the last
Dialogflow.out(function(message) {
  var options = this.getOptions();
  var logfile = options.logfile;
  var chatContext = message.chat();
  if (!_.isEmpty(logfile)) {
    return when(chatContext.all())
      .then(function(variables) {
        var chatLog = new ChatLog(variables);
        return chatLog.log(message, logfile);
      });
  }
  return message;
});

Dialogflow.in('*', function(message) {
  var options = this.getOptions();
  var logfile = options.logfile;
  var chatContext = message.chat();
  if (!_.isEmpty(logfile)) {
    return when(chatContext.all())
      .then(function(variables) {
        var chatLog = new ChatLog(variables);
        return chatLog.log(message, logfile);
      });
  }
  return message;
});

Dialogflow.registerMessageType('message', 'Message', 'Send a plain text message');

module.exports = Dialogflow;





