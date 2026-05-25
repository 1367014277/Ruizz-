export async function onRequestPost({ request }) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return Response.json({ ok: false, msg: '请填写账号和密码' }, { status: 400 });
    }

    const auth = 'Basic ' + btoa(username + ':' + password);
    const res = await fetch('https://dav.jianguoyun.com/dav/', {
      method: 'PROPFIND',
      headers: {
        'Authorization': auth,
        'Depth': '0',
        'Content-Type': 'application/xml'
      },
      body: '<?xml version="1.0"?><propfind xmlns="DAV:"><prop><resourcetype/></prop></propfind>'
    });

    // 207 = Multi-Status（WebDAV 成功响应）
    if (res.status === 207 || res.status === 200) {
      return Response.json({ ok: true, msg: '账号验证成功！' });
    }
    if (res.status === 401 || res.status === 403) {
      return Response.json({ ok: false, msg: '账号或密码错误' });
    }
    return Response.json({ ok: false, msg: '验证失败，状态码：' + res.status });
  } catch (err) {
    return Response.json({ ok: false, msg: '网络错误：' + err.message }, { status: 500 });
  }
}
