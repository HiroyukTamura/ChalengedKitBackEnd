var pw = 'ss954a0120777777'
var url = 'https://us-central1-wordsupport3.cloudfunctions.net/backUp'

function timeTrigger() {
  var body = UrlFetchApp.fetch(url, makeOption());
  Logger.log(body.getContentText());
}

function makeOption(){
  Logger.log("makeOption()");
  
  var postData = {
    "pw": pw,
  }
  
  var options = {
    "method" : "post",
    "headers" : {
      "Content-Type" : "application/json",
    },
    "payload" : JSON.stringify(postData)
  };
  
  return options;
}
