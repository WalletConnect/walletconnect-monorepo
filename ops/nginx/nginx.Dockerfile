FROM nginx:1.19-alpine

RUN apk add --update --no-cache openssl-dev libffi-dev  musl-dev python3-dev py3-pip gcc openssl bash && \
  ln -fs /dev/stdout /var/log/nginx/access.log && \
  ln -fs /dev/stdout /var/log/nginx/error.log

RUN CRYPTOGRAPHY_DONT_BUILD_RUST=1 pip3 install certbot-dns-cloudflare

COPY ./nginx.conf /etc/nginx/nginx.conf
COPY ./letsencrypt.conf /etc/nginx/letsencrypt.conf
COPY ./dhparams.pem /etc/nginx/dhparams.pem
COPY ./entry.sh /entry.sh

ENV nginxDirs="/etc/letsencrypt \
  /etc/nginx \
  /etc/nginx/servers \
  /run/secrets \
  /var/www \
  /var/cache/nginx \
  /var/log \
  /var/lib/letsencrypt"

RUN mkdir -p $nginxDirs
RUN chown -R nginx:nginx /entry.sh $nginxDirs
USER nginx
ENTRYPOINT /entry.sh
