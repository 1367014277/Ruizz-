const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const JGY_HOST = 'dav.jianguoyun.com';
const JGY_PATH = '/dav/RuizzNavBackup/ruizz-nav-backup.json';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

// 代理请求到坚果云 WebDAV
function jgyRequest(method, auth, body, subPath, cb) {
  const fullPath = '/dav/' + (subPath || 'RuizzNavBackup/ruizz-nav-backup.json');
  const authStr = 'Basic ' + Buffer.from(auth.username + ':' + auth.password).toString('base64');
  const headers = { 'Authorization': authStr };
  if (body) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(body);
  }
  const options = {
    hostname: JGY_HOST,
    port: 443,
    path: fullPath,
    method: method,
    headers: headers
  };
  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => cb(null, res.statusCode, data));
  });
  req.on('error', (err) => cb(err));
  if (body) req.write(body);
  req.end();
}

// 读取请求体
function readBody(req, cb) {
  let body = '';
  req.on('data', (chunk) => body += chunk);
  req.on('end', () => {
    try { cb(null, JSON.parse(body)); }
    catch (e) { cb(e); }
  });
}

// 发送 JSON 响应
function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  // ===== 验证账号 =====
  if (urlPath === '/proxy/verify' && req.method === 'POST') {
    readBody(req, (err, body) => {
      if (err || !body.username || !body.password) return send(res, 400, { ok: false, msg: '缺少账号或密码' });
      jgyRequest('PROPFIND', body, '<?xml version="1.0"?><propfind xmlns="DAV:"><prop><resourcetype/></prop></propfind>', '', (err, status) => {
        if (err) return send(res, 500, { ok: false, msg: '网络错误：' + err.message });
        if (status === 401 || status === 403) return send(res, 401, { ok: false, msg: '账号或密码错误' });
        if (status >= 200 && status < 300) return send(res, 200, { ok: true, msg: '账号验证成功！' });
        return send(res, 200, { ok: true, msg: '账号验证成功（状态码 ' + status + '）' });
      });
    });
    return;
  }

  // ===== 备份到云端 =====
  if (urlPath === '/proxy/backup' && req.method === 'POST') {
    readBody(req, (err, body) => {
      if (err || !body.username || !body.password || !body.data) return send(res, 400, { ok: false, msg: '缺少参数' });
      // 先 MKCOL 创建目录（忽略已存在错误）
      jgyRequest('MKCOL', body, '', 'RuizzNavBackup/', (err, status) => {
        // 201=创建成功 405=目录已存在 200/207=成功
        jgyRequest('PUT', body, body.data, 'RuizzNavBackup/ruizz-nav-backup.json', (err, status) => {
          if (err) return send(res, 500, { ok: false, msg: '网络错误：' + err.message });
          if (status === 401 || status === 403) return send(res, 401, { ok: false, msg: '账号或密码错误' });
          if (status >= 200 && status < 300) return send(res, 200, { ok: true, msg: '备份成功！' });
          return send(res, 500, { ok: false, msg: '备份失败，状态码：' + status });
        });
      });
    });
    return;
  }

  // ===== 从云端恢复 =====
  if (urlPath === '/proxy/restore' && req.method === 'POST') {
    readBody(req, (err, body) => {
      if (err || !body.username || !body.password) return send(res, 400, { ok: false, msg: '缺少账号或密码' });
      jgyRequest('GET', body, '', 'RuizzNavBackup/ruizz-nav-backup.json', (err, status, data) => {
        if (err) return send(res, 500, { ok: false, msg: '网络错误：' + err.message });
        if (status === 401 || status === 403) return send(res, 401, { ok: false, msg: '账号或密码错误' });
        if (status === 404) return send(res, 404, { ok: false, msg: '云端没有备份文件，请先备份' });
        if (status >= 200 && status < 300) {
          try { JSON.parse(data); return send(res, 200, { ok: true, msg: '恢复成功！', data: data }); }
          catch (e) { return send(res, 500, { ok: false, msg: '云端备份文件格式错误' }); }
        }
        return send(res, 500, { ok: false, msg: '下载失败，状态码：' + status });
      });
    });
    return;
  }

  // ===== 静态文件服务 =====
  let relativePath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  let filePath = path.join(__dirname, relativePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not Found'); return; }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('\n✅ Ruizz-nav 本地服务器已启动（含坚果云代理）');
  console.log('📎 请打开浏览器访问: http://localhost:' + PORT);
  console.log('🛑 关闭此窗口即可停止服务器\n');
});
