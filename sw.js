/* Met à jour ilv.html, test1.html et index.html sans passer par le cache
   de 10 minutes de GitHub Pages. Ne lit ni n'écrit localStorage. */
var REPO = "Musti75/boulanger-app";
var TTL = 120000;
var memory = Object.create(null);

var PAGES = {
  "": "index.html",
  "index.html": "index.html",
  "ilv.html": "ilv.html",
  "test1.html": "test1.html",
  "version.json": "version.json"
};

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

function pageName(pathname) {
  var last = pathname.split("/").pop();
  return Object.prototype.hasOwnProperty.call(PAGES, last) ? PAGES[last] : null;
}

function decodeBase64(b64) {
  var bin = atob(String(b64).replace(/\s/g, ""));
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function makeResponse(bytes, contentType) {
  return new Response(bytes.slice(), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store"
    }
  });
}

function contentType(name) {
  return name === "version.json" ? "application/json; charset=utf-8" : "text/html; charset=utf-8";
}

function fromApi(name) {
  var hit = memory[name];
  if (hit && Date.now() - hit.time < TTL) return Promise.resolve(makeResponse(hit.bytes, hit.type));
  return fetch("https://api.github.com/repos/" + REPO + "/contents/" + encodeURIComponent(name) + "?ref=main", {
    cache: "no-store",
    headers: { "Accept": "application/vnd.github+json" }
  }).then(function (response) {
    if (!response.ok) throw new Error("api");
    return response.json();
  }).then(function (data) {
    if (!data || data.encoding !== "base64" || !data.content) throw new Error("shape");
    var bytes = decodeBase64(data.content);
    var type = contentType(name);
    var text = new TextDecoder("utf-8").decode(bytes);
    if (name === "version.json") {
      var parsed = JSON.parse(text);
      if (!parsed || typeof parsed.version !== "string") throw new Error("version");
    } else if (text.indexOf("APP_BUILD") === -1) {
      throw new Error("html");
    }
    memory[name] = { time: Date.now(), bytes: bytes, type: type };
    return makeResponse(bytes, type);
  });
}

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  var name = pageName(url.pathname);
  if (!name) return;
  event.respondWith(fromApi(name).catch(function () {
    return fetch(request);
  }));
});
