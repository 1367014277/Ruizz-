export async function onRequestPost({ request }) {
  try {
    const { username, password, data } = await request.json();
    if (!username || !password) {
      return Response.json({ ok: false, msg: '请填写账号和密码' }, { status: 400 });
    }

    const auth = 'Basic ' + btoa(username + ':' + password);
    const baseUrl = 'https://dav.jianguoyun.com/dav/RuizzNavBackup/';
    const fileName = 'ruizz-nav-backup.json';

    // 先创建目录（忽略已存在错误）
    await fetch(baseUrl.replace(/\/$/, ''), {
      method: 'MKCOL',
      headers: { 'Authorization': auth }
    });

    // 上传文件
    const res = await fetch(baseUrl + fileName, {
      method: 'PUT',
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json'
      },
      body: data
    });

    if (res.status === 401 || res.status === 403) {
      return Response.json({ ok: false, msg: '账号或密码错误' }, { status: res.status });
    }
    if (res.status >= 200 && res.status < 300 || res.status === 201 || res.status === 204) {
      return Response.json({ ok: true, msg: '备份成功！' });
    }
    return Response.json({ ok: false, msg: '备份失败，状态码：' + res.status });
  } catch (err) {
    return Response.json({ ok: false, msg: '网络错误：' + err.message }, { status: 500 });
  }
}
