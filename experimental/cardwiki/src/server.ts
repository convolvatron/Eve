import fs = require("fs");
import path = require("path");
import express = require('express');
import * as app from "./app";
import * as runtime from "./runtime";
import * as parser from "./parser";
import * as bootstrap from "./bootstrap";

let WebSocketServer = require('ws').Server;
let wss = new WebSocketServer({ port: 8080 });

let eve = app.eve;

try {
  fs.statSync("server.evedb");
  eve.load(fs.readFileSync("server.evedb").toString());
} catch(err) {}

let diff = eve.diff();
diff.addMany("foo", [{a: "bar"}, {a: "baz"}]);
eve.applyDiff(diff);

let clients = {};

wss.on('connection', function connection(ws) {

  //when we connect, send them all the pages.
  ws.send(JSON.stringify({kind: "load", time: (new Date()).getTime(), me: "server", data: eve.serialize()}));

  ws.on('close', function() {
    delete clients[ws.me];
  });

  ws.on('message', function incoming(message) {
    console.log('received: %s', message);
    let parsed = JSON.parse(message);
    if(parsed.kind === "code") {
      try {
          let views = parser.parseDSL(parsed.data);
          let viewIds = Object.keys(views);
          for(let viewId of viewIds) {
              let view = views[viewId];
              eve.asView(view);
          }
          let results = eve.find(viewIds[0]);
          console.log(eve.tables[viewIds[0]], results, views[viewIds[0]].exec(), eve.find("foo"));
          ws.send(JSON.stringify({kind: "code result", me: "server", data: results}));
          for(let viewId of viewIds) {
              let view = views[viewId];
              eve.removeView(viewId);
          }
      } catch(e) {
          console.log(e.stack);
          ws.send(JSON.stringify({kind: "code error", me: "server", data: e.message}));
      }
    } else if(parsed.kind === "changeset") {
      let diff = eve.diff();
      diff.tables = parsed.data;
      eve.applyDiff(diff);
      // dispatch and store.
      for(let client in clients) {
        if(client === parsed.me) continue;
        if(!clients[client]) continue;
        clients[client].send(message);
      }
      // store
      fs.writeFileSync("server.evedb", eve.serialize());
    } else if(parsed.kind === "connect") {
      clients[parsed.data] = ws;
      ws.me = parsed.data;
    }
  });
});

var httpserver = express();
httpserver.use("/bin", express.static(__dirname + '/../bin'));
httpserver.use("/css", express.static(__dirname + '/../css'));
httpserver.use("/node_modules", express.static(__dirname + '/../node_modules'));
httpserver.use("/vendor", express.static(__dirname + '/../vendor'));
httpserver.use("/fonts", express.static(__dirname + '/../fonts'));

httpserver.get("/", (req, res) => {
  res.sendFile(path.resolve(__dirname + "/../editor.html"));
})

httpserver.listen(process.env.PORT || 3000);