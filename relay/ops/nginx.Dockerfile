FROM nginx:1.17-alpine

RUN apk add --update --no-cache certbot openssl bash && \
  ln -fs /dev/stdout /var/log/nginx/access.log && \
  ln -fs /dev/stdout /var/log/nginx/error.log

COPY ./ops/nginx.conf /etc/nginx/nginx.conf
COPY ./ops/dhparams.pem /etc/ssl/dhparams.pem
COPY ./ops/entry.sh /root/entry.sh

ENTRYPOINT ["/bin/bash", "/root/entry.sh"]
