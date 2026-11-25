"""Serve the existing Bifrost dashboard behind Render's HTTPS edge."""
import grp
import os
from pathlib import Path
import re
import subprocess

from bifrost_setup import private_write


CASPY_PORT = 8001
GATEWAY_PORT = 8080
CASPY_NAMESPACES = 'account|auth|campaigns|candy|datasets|game|market|metadata|mint|research|social'


def dashboard_origin(env):
    host = env.get('CASPY_BIFROST_DASHBOARD_HOST', '')
    if not host:
        return None
    if not re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.onrender\.com', host):
        raise ValueError('Choose the existing Render hostname for the Bifrost dashboard.')
    if env.get('RENDER_EXTERNAL_HOSTNAME') != host:
        raise ValueError('The Bifrost dashboard hostname must match this Render service.')
    return 'https://' + host


def prepare_proxy(env, origin, port, folder=Path('/run/caspy-proxy')):
    if port in (CASPY_PORT, GATEWAY_PORT):
        raise ValueError('The public port conflicts with an internal dashboard port.')
    username = env.get('BIFROST_ADMIN_USERNAME', '')
    password = env.get('BIFROST_ADMIN_PASSWORD', '')
    if (not re.fullmatch(r'[A-Za-z0-9_.@-]{1,128}', username)
            or len(password.encode()) < 16 or any(c in password for c in '\r\n\0')):
        raise ValueError('The Bifrost dashboard requires an admin username and a strong password.')

    result = subprocess.run(
        ['openssl', 'passwd', '-6', '-stdin'], input=password + '\n',
        text=True, capture_output=True, check=True,
    )
    folder.mkdir(mode=0o750, parents=True, exist_ok=True)
    folder.chmod(0o750)
    auth_file = folder / 'admin.htpasswd'
    private_write(auth_file, f'{username}:{result.stdout.strip()}\n')

    user = ''
    if os.geteuid() == 0:
        gid = grp.getgrnam('www-data').gr_gid
        os.chown(folder, -1, gid)
        os.chown(auth_file, -1, gid)
        auth_file.chmod(0o640)
        user = 'user www-data;'

    host = origin.removeprefix('https://')
    config = folder / 'nginx.conf'
    private_write(config, f'''
{user}
worker_processes 1;
pid {folder}/nginx.pid;
error_log /dev/stderr crit;
events {{ worker_connections 256; }}
http {{
    access_log off;
    absolute_redirect off;
    proxy_http_version 1.1;
    proxy_buffering off;
    proxy_read_timeout 310s;
    map $http_upgrade $upgrade_connection {{
        default upgrade;
        "" close;
    }}
    map "$request_method:$http_origin" $block_dashboard_request {{
        default 1;
        "GET:" 0;
        "HEAD:" 0;
        ~^[A-Z]+:{re.escape(origin)}$ 0;
    }}
    server {{
        listen 0.0.0.0:{port};
        server_name {host};
        location ~ ^/(health$|({CASPY_NAMESPACES})(/|$)) {{
            proxy_set_header Host $host;
            proxy_set_header Authorization "";
            proxy_pass http://127.0.0.1:{CASPY_PORT};
        }}
        location / {{
            if ($host != "{host}") {{ return 404; }}
            if ($block_dashboard_request) {{ return 403; }}
            auth_basic "Caspy Bifrost";
            auth_basic_user_file {auth_file};
            add_header Cache-Control "no-store" always;
            proxy_hide_header Cache-Control;
            proxy_set_header Host {host};
            proxy_set_header Authorization "";
            proxy_set_header X-BF-VK "";
            proxy_set_header X-Forwarded-Host {host};
            proxy_set_header X-Forwarded-Proto https;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $upgrade_connection;
            proxy_pass http://127.0.0.1:{GATEWAY_PORT};
        }}
    }}
}}
''')
    command = ['nginx', '-c', str(config), '-g', 'daemon off;']
    subprocess.run([*command, '-t'], check=True)
    return command
