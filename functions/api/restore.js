export async function onRequestPost({ request }) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return Response.json({ ok: false, msg: '请填写账号和密码' }, { status: 400 });
    }

    const auth = 'Basic ' + btoa(username + ':' + password);
    const fileUrl = 'https://dav.jianguoyun.com/dav/RuizzNavBackup/ruizz-nav-backup.json';

    const res = await fetch(fileUrl, {
      method: 'GET',
      headers: { 'Authorization': auth }
    });

    if (res.status === 401 || res.status === 403) {
      return Response.json({ ok: false, msg: '账号或密码错误' }, { status: res.status });
    }
    if (res.status === 404) {
      return Response.json({ ok: false, msg: '云端没有备份文件，请先备份' }, { status: 404 });
    }
    if (!res.ok) {
      return Response.json({ ok: false, msg: '下载失败，状态码：' + res.status }, { status: res.status });
    }

    const data = await res.text();
    return Response.json({ ok: true, data: data });
  } catch (err) {
    return Response.json({ ok: false, msg: '网络错误：' + err.message }, { status: 500 });
  }
}
