import io

with io.open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

target = """        if (response.ok) {
            state.adminConfig = await response.json();
            renderApp();
        }"""

replacement = """        if (response.ok) {
            state.adminConfig = await response.json();
            const gId = document.getElementById('setting-google-id');
            if (gId && state.adminConfig.google_client_id) gId.value = state.adminConfig.google_client_id;
            
            const fId = document.getElementById('setting-facebook-id');
            if (fId && state.adminConfig.facebook_app_id) fId.value = state.adminConfig.facebook_app_id;
            
            const sHost = document.getElementById('setting-smtp-host');
            if (sHost && state.adminConfig.smtp_host) sHost.value = state.adminConfig.smtp_host;
            
            const sPort = document.getElementById('setting-smtp-port');
            if (sPort && state.adminConfig.smtp_port) sPort.value = state.adminConfig.smtp_port;
            
            const sUser = document.getElementById('setting-smtp-user');
            if (sUser && state.adminConfig.smtp_user) sUser.value = state.adminConfig.smtp_user;
            
            const sPass = document.getElementById('setting-smtp-pass');
            if (sPass && state.adminConfig.smtp_pass) sPass.value = state.adminConfig.smtp_pass;
            
            const sSender = document.getElementById('setting-smtp-sender');
            if (sSender && state.adminConfig.smtp_sender) sSender.value = state.adminConfig.smtp_sender;
        }"""

content = content.replace(target, replacement)

with io.open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("done")
