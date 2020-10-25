FROM nginx:1.17-alpine

RUN apk add --update --no-cache openssl-dev libffi-dev  musl-dev python3-dev py3-pip gcc openssl bash && \
  ln -fs /dev/stdout /var/log/nginx/access.log && \
  ln -fs /dev/stdout /var/log/nginx/error.log

RUN pip3 install certbot-dns-cloudflare

COPY ./nginx.conf /etc/nginx/nginx.conf
COPY ./letsencrypt.conf /etc/nginx/letsencrypt.conf
COPY ./dhparams.pem /etc/ssl/dhparams.pem
COPY ./entry.sh /root/entry.sh

ENTRYPOINT ["/bin/bash", "/root/entry.sh"]
