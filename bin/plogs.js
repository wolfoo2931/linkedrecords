#!/usr/bin/env node

const readline = require('readline');
const colors = require('colors');

const req = {}

function timeOutput(timeInMs, padStart=0) {
  let text = `${timeInMs}ms`.padStart(padStart, ' ');
  let result = colors.bold(text);

  if(timeInMs >= 300) {
    result = colors.red(result);
  }

  return result.toString();
}

function logAggregate(agg) {
  if(!agg.logs[0]) {
    return;
  }

  const requestDoneLog = agg.logs.find((l) => l.msg === 'request completed' || l.msg === 'request errored')

  console.log('')
  console.log('')
  console.log(`Response Time: ${timeOutput(requestDoneLog?.responseTime)} Status: ${requestDoneLog?.res?.statusCode} - ${colors.bold(agg.logs[0]?.req?.method)} ${agg.logs[0]?.req?.url?.split('?')[0]}`);
  console.log(`${'url query'.padStart(13, ' ')}: ${JSON.stringify(agg.logs[0].req?.query).replaceAll(/\\"/g, '"')}`);

  if(process.env.LOG_LEVEL !== 'summary') {
    agg.logs.forEach(log => {
      if(log.queryTemplate) {
        console.log(`${timeOutput(log?.timeInMS, 13)} (Results ${log.results}): ${log.queryTemplate}`);
      } else if (log.err) {
        if (log.err.stack) {
          console.log(colors.red(log.err.stack.split('\n').map((l) => `    ${l}`).join('\n')));
        } else {
          console.log(colors.red(`${log.err.type}: ${log.err.message}`.split('\n').map((l) => `    ${l}`).join('\n')));
        }

      } else if(log.msg !== 'request completed' && log.msg !== 'request errored') {
        console.log(log)
      }
    })
  }

  console.log('')
  console.log('')
}

function processJSONLog(json) {
  if(json?.req?.id && !json?.req?.url?.startsWith('/ws/')) {
    req[json?.req?.id] =  req[json?.req?.id] || { logs: [] };
    req[json?.req?.id].logs.push(json);

    if(json.msg === 'request completed' || json.msg === 'request errored') {
      logAggregate(req[json?.req?.id]);
      delete req[json?.req?.id];
    }

  } else {
    if(process.env.LOG_LEVEL !== 'summary') {
      console.log(`WS${timeOutput(json?.timeInMS, 11)}: ${json?.queryTemplate}`);
    }
  }
}

function processTextLog(text) {
  console.log('text', text);
}

function processLog(log) {
  try {
    processJSONLog(JSON.parse(log));
  } catch (ex) {
    processTextLog(log)
  }
}

const rl = readline.createInterface({
  input: process.stdin,
});

rl.on('line', async (input) => {
  processLog(input);
});

rl.on('close', () => {
  console.log('End of input stream');
});