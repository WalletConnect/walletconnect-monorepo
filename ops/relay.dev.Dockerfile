FROM walletconnect/relay:base
RUN npm install -g nodemon
USER node
CMD ["nodemon", "/relay/dist"]
